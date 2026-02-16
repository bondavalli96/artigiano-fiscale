import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function sumTotal(rows: { total: number }[] | null): number {
  return (rows || []).reduce((s, r) => s + (r.total || 0), 0);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function extractCity(address: string | null): string {
  if (!address) return "N/D";
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/^\d{5}\s*/, "").trim() || "N/D";
  }
  return address.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { artisanId, period = "month", locale = "it" } = await req.json();

    if (!artisanId) {
      return new Response(
        JSON.stringify({ error: "artisanId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    // Calculate date ranges based on period
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;
    let lastYearStart: Date;
    let lastYearEnd: Date;

    if (period === "quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      previousStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
      previousEnd = new Date(currentStart.getTime() - 1);
      lastYearStart = new Date(now.getFullYear() - 1, currentQuarter * 3, 1);
      lastYearEnd = new Date(
        now.getFullYear() - 1,
        (currentQuarter + 1) * 3,
        0,
        23, 59, 59
      );
    } else if (period === "year") {
      currentStart = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      lastYearStart = previousStart;
      lastYearEnd = previousEnd;
    } else {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23, 59, 59
      );
      lastYearStart = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        1
      );
      lastYearEnd = new Date(
        now.getFullYear() - 1,
        now.getMonth() + 1,
        0,
        23, 59, 59
      );
    }

    // --- QUERIES ---
    // Current period income
    const { data: curIncome } = await supabase
      .from("invoices_active")
      .select("total, client:clients(name, address)")
      .eq("artisan_id", artisanId)
      .eq("status", "paid")
      .gte("paid_at", currentStart.toISOString());

    // Current period expenses
    const { data: curExpenses } = await supabase
      .from("invoices_passive")
      .select("total, category")
      .eq("artisan_id", artisanId)
      .gte("created_at", currentStart.toISOString());

    // Current period quotes
    const { data: curQuotes } = await supabase
      .from("quotes")
      .select("status")
      .eq("artisan_id", artisanId)
      .gte("created_at", currentStart.toISOString());

    // Previous period income
    const { data: prevIncome } = await supabase
      .from("invoices_active")
      .select("total")
      .eq("artisan_id", artisanId)
      .eq("status", "paid")
      .gte("paid_at", previousStart.toISOString())
      .lte("paid_at", previousEnd.toISOString());

    // Previous period expenses
    const { data: prevExpenses } = await supabase
      .from("invoices_passive")
      .select("total")
      .eq("artisan_id", artisanId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    // Same period last year income
    const { data: lyIncome } = await supabase
      .from("invoices_active")
      .select("total")
      .eq("artisan_id", artisanId)
      .eq("status", "paid")
      .gte("paid_at", lastYearStart.toISOString())
      .lte("paid_at", lastYearEnd.toISOString());

    // Same period last year expenses
    const { data: lyExpenses } = await supabase
      .from("invoices_passive")
      .select("total")
      .eq("artisan_id", artisanId)
      .gte("created_at", lastYearStart.toISOString())
      .lte("created_at", lastYearEnd.toISOString());

    // --- FISCAL STATS QUERIES ---

    // SdI status breakdown (all invoices, not just current period)
    const { data: allInvoices } = await supabase
      .from("invoices_active")
      .select("sdi_status, digital_stamp, digital_stamp_amount, reverse_charge, status, created_at, paid_at, payment_due, total")
      .eq("artisan_id", artisanId);

    // Fiscal profile for tax estimate
    const { data: fiscalProfile } = await supabase
      .from("fiscal_profiles")
      .select("regime, coefficient")
      .eq("artisan_id", artisanId)
      .single();

    // Fiscal year tracking
    const currentYear = now.getFullYear();
    const { data: yearTracking } = await supabase
      .from("fiscal_year_tracking")
      .select("total_revenue, total_expenses, invoice_count")
      .eq("artisan_id", artisanId)
      .eq("year", currentYear)
      .single();

    // --- CALCULATE ORIGINAL STATS ---
    const income = sumTotal(curIncome);
    const expenses = sumTotal(curExpenses);
    const margin = income - expenses;
    const invoiceCount = (curIncome || []).length;
    const quoteCount = (curQuotes || []).length;
    const acceptedQuotes = (curQuotes || []).filter(
      (q: { status: string }) => q.status === "accepted"
    ).length;
    const acceptanceRate =
      quoteCount > 0 ? Math.round((acceptedQuotes / quoteCount) * 100) : 0;
    const avgInvoice = invoiceCount > 0 ? Math.round(income / invoiceCount) : 0;

    const prevIncomeTotal = sumTotal(prevIncome);
    const prevExpensesTotal = sumTotal(prevExpenses);
    const prevMargin = prevIncomeTotal - prevExpensesTotal;

    const lyIncomeTotal = sumTotal(lyIncome);
    const lyExpensesTotal = sumTotal(lyExpenses);
    const lyMargin = lyIncomeTotal - lyExpensesTotal;

    // Expense breakdown by category
    const categoryMap: Record<string, number> = {};
    for (const inv of curExpenses || []) {
      const cat = (inv as { category: string }).category || "altro";
      categoryMap[cat] = (categoryMap[cat] || 0) + ((inv as { total: number }).total || 0);
    }
    const byCategory = Object.entries(categoryMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    // Income by area
    const areaMap: Record<string, { total: number; count: number }> = {};
    for (const inv of curIncome || []) {
      const client = (inv as any).client;
      const city = extractCity(client?.address || null);
      if (!areaMap[city]) areaMap[city] = { total: 0, count: 0 };
      areaMap[city].total += (inv as { total: number }).total || 0;
      areaMap[city].count++;
    }
    const byArea = Object.entries(areaMap)
      .map(([area, data]) => ({ area, total: data.total, count: data.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Top clients
    const clientMap: Record<string, { name: string; total: number; count: number }> = {};
    for (const inv of curIncome || []) {
      const client = (inv as any).client;
      const name = client?.name || "N/D";
      if (!clientMap[name]) clientMap[name] = { name, total: 0, count: 0 };
      clientMap[name].total += (inv as { total: number }).total || 0;
      clientMap[name].count++;
    }
    const topClients = Object.values(clientMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // --- CALCULATE FISCAL STATS ---

    // SdI status breakdown
    const sdiBreakdown = {
      delivered: 0,
      accepted: 0,
      sent: 0,
      not_sent: 0,
      rejected: 0,
      total: (allInvoices || []).length,
    };
    for (const inv of allInvoices || []) {
      const s = (inv as any).sdi_status || "not_sent";
      if (s === "delivered") sdiBreakdown.delivered++;
      else if (s === "accepted") sdiBreakdown.accepted++;
      else if (s === "sent") sdiBreakdown.sent++;
      else if (s === "rejected") sdiBreakdown.rejected++;
      else sdiBreakdown.not_sent++;
    }

    // Marca da bollo stats
    let bolloCount = 0;
    let bolloTotal = 0;
    for (const inv of allInvoices || []) {
      if ((inv as any).digital_stamp) {
        bolloCount++;
        bolloTotal += (inv as any).digital_stamp_amount || 2.0;
      }
    }

    // Reverse charge stats
    let reverseChargeCount = 0;
    let reverseChargeTotal = 0;
    for (const inv of allInvoices || []) {
      if ((inv as any).reverse_charge) {
        reverseChargeCount++;
        reverseChargeTotal += (inv as any).total || 0;
      }
    }

    // Collection performance (DSO, paid on time, outstanding)
    let totalDaysToPayment = 0;
    let paidCount = 0;
    let paidOnTimeCount = 0;
    let outstandingAmount = 0;
    let overdueAmount = 0;
    let overdueCount = 0;

    for (const inv of allInvoices || []) {
      const status = (inv as any).status;
      const total = (inv as any).total || 0;

      if (status === "paid" && (inv as any).paid_at && (inv as any).created_at) {
        const created = new Date((inv as any).created_at);
        const paid = new Date((inv as any).paid_at);
        const days = Math.max(0, Math.round((paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
        totalDaysToPayment += days;
        paidCount++;

        // Check if paid before due date
        if ((inv as any).payment_due) {
          const due = new Date((inv as any).payment_due);
          if (paid <= due) paidOnTimeCount++;
        } else {
          paidOnTimeCount++; // No due date = considered on time
        }
      } else if (status === "sent" || status === "overdue") {
        outstandingAmount += total;
        if (status === "overdue") {
          overdueAmount += total;
          overdueCount++;
        }
      }
    }

    const avgDaysToPayment = paidCount > 0 ? Math.round(totalDaysToPayment / paidCount) : null;
    const paidOnTimeRate = paidCount > 0 ? Math.round((paidOnTimeCount / paidCount) * 100) : null;

    // Tax estimate (forfettario)
    let taxEstimate = null;
    if (fiscalProfile?.regime === "forfettario" && yearTracking) {
      const coefficient = fiscalProfile.coefficient || 67; // default idraulico
      const grossRevenue = yearTracking.total_revenue || 0;
      const taxableIncome = grossRevenue * (coefficient / 100);
      // 15% imposta sostitutiva (5% first 5 years — we default to 15%)
      const taxRate = 15;
      const estimatedTax = taxableIncome * (taxRate / 100);
      // INPS contributi (24.48% for artigiani/commercianti on taxable income)
      const inpsRate = 24.48;
      const estimatedInps = taxableIncome * (inpsRate / 100);
      const totalTaxBurden = estimatedTax + estimatedInps;
      const monthsLeft = 12 - now.getMonth();
      const monthlySetAside = monthsLeft > 0 ? totalTaxBurden / monthsLeft : totalTaxBurden;

      taxEstimate = {
        regime: "forfettario",
        grossRevenue,
        coefficient,
        taxableIncome: Math.round(taxableIncome * 100) / 100,
        taxRate,
        estimatedTax: Math.round(estimatedTax * 100) / 100,
        inpsRate,
        estimatedInps: Math.round(estimatedInps * 100) / 100,
        totalTaxBurden: Math.round(totalTaxBurden * 100) / 100,
        monthlySetAside: Math.round(monthlySetAside * 100) / 100,
        revenueLimit: 85000,
        revenuePercent: Math.min(Math.round((grossRevenue / 85000) * 100), 100),
      };
    }

    // --- AI INSIGHT ---
    const periodLabel =
      locale === "en"
        ? period === "year"
          ? "year"
          : period === "quarter"
          ? "quarter"
          : "month"
        : locale === "es"
        ? period === "year"
          ? "ano"
          : period === "quarter"
          ? "trimestre"
          : "mes"
        : locale === "pt"
        ? period === "year"
          ? "ano"
          : period === "quarter"
          ? "trimestre"
          : "mes"
        : period === "year"
        ? "anno"
        : period === "quarter"
        ? "trimestre"
        : "mese";

    const langMap: Record<string, string> = {
      it: "Italian",
      en: "English",
      es: "Spanish",
      pt: "Portuguese",
    };
    const lang = langMap[locale] || "Italian";

    let aiInsight = "";
    try {
      const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 512,
          messages: [
            {
              role: "user",
              content: `Analizza questi dati finanziari di un artigiano e dai un breve insight in ${lang}.

Periodo: questo ${periodLabel}
- Fatturato: EUR${income.toFixed(2)} (${invoiceCount} fatture)
- Costi: EUR${expenses.toFixed(2)}
- Margine: EUR${margin.toFixed(2)}
- Tasso accettazione preventivi: ${acceptanceRate}%
${avgDaysToPayment !== null ? `- Tempo medio incasso: ${avgDaysToPayment} giorni` : ""}
${paidOnTimeRate !== null ? `- Pagati puntuali: ${paidOnTimeRate}%` : ""}
${outstandingAmount > 0 ? `- Ancora da incassare: EUR${outstandingAmount.toFixed(2)}` : ""}
${taxEstimate ? `- Regime forfettario, stima tasse annue: EUR${taxEstimate.totalTaxBurden.toFixed(2)}` : ""}

Periodo precedente:
- Fatturato: EUR${prevIncomeTotal.toFixed(2)}
- Costi: EUR${prevExpensesTotal.toFixed(2)}
- Margine: EUR${prevMargin.toFixed(2)}

Stesso periodo anno scorso:
- Fatturato: EUR${lyIncomeTotal.toFixed(2)}
- Costi: EUR${lyExpensesTotal.toFixed(2)}

${topClients.length > 0 ? `Top clienti: ${topClients.map((c) => `${c.name} (EUR${c.total})`).join(", ")}` : ""}
${byArea.length > 0 ? `Zone: ${byArea.map((a) => `${a.area} (EUR${a.total})`).join(", ")}` : ""}

Scrivi 2-3 frasi utili, come parleresti a un amico. Confronta i periodi, evidenzia trend e suggerisci azioni concrete.
Rispondi SOLO con il testo dell'insight, niente JSON.`,
            },
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiInsight = aiData.content?.[0]?.text || "";
      }
    } catch (_aiErr) {
      // AI insight is optional
    }

    return new Response(
      JSON.stringify({
        current: {
          income,
          expenses,
          margin,
          invoiceCount,
          quoteCount,
          acceptanceRate,
          avgInvoice,
        },
        previous: {
          income: prevIncomeTotal,
          expenses: prevExpensesTotal,
          margin: prevMargin,
        },
        sameMonthLastYear: {
          income: lyIncomeTotal,
          expenses: lyExpensesTotal,
          margin: lyMargin,
        },
        changes: {
          vsPrev: {
            income: pctChange(income, prevIncomeTotal),
            expenses: pctChange(expenses, prevExpensesTotal),
            margin: pctChange(margin, prevMargin),
          },
          vsLastYear: {
            income: pctChange(income, lyIncomeTotal),
            expenses: pctChange(expenses, lyExpensesTotal),
            margin: pctChange(margin, lyMargin),
          },
        },
        byCategory,
        byArea,
        topClients,
        aiInsight,
        // Fiscal stats
        fiscal: {
          sdiBreakdown,
          bollo: { count: bolloCount, total: bolloTotal },
          reverseCharge: { count: reverseChargeCount, total: reverseChargeTotal },
          collection: {
            avgDaysToPayment,
            paidOnTimeRate,
            outstandingAmount,
            overdueAmount,
            overdueCount,
            paidCount,
          },
          taxEstimate,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
