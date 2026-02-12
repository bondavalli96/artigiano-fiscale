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
  // Try to get city from typical Italian address format: "Via Roma 1, 20100 Milano"
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    // Remove CAP if present (5 digits at start)
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
      // month (default)
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

    // --- CALCULATE ---
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

    // Income by area (from client addresses)
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

    // --- AI INSIGHT ---
    const periodLabel =
      locale === "en"
        ? period === "year"
          ? "year"
          : period === "quarter"
          ? "quarter"
          : "month"
        : period === "year"
        ? "anno"
        : period === "quarter"
        ? "trimestre"
        : "mese";

    const lang = locale === "en" ? "English" : "Italian";

    // AI insight - wrapped in its own try/catch so stats still return if AI fails
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
- Fatturato: €${income.toFixed(2)} (${invoiceCount} fatture)
- Costi: €${expenses.toFixed(2)}
- Margine: €${margin.toFixed(2)}
- Tasso accettazione preventivi: ${acceptanceRate}%

Periodo precedente:
- Fatturato: €${prevIncomeTotal.toFixed(2)}
- Costi: €${prevExpensesTotal.toFixed(2)}
- Margine: €${prevMargin.toFixed(2)}

Stesso periodo anno scorso:
- Fatturato: €${lyIncomeTotal.toFixed(2)}
- Costi: €${lyExpensesTotal.toFixed(2)}

${topClients.length > 0 ? `Top clienti: ${topClients.map((c) => `${c.name} (€${c.total})`).join(", ")}` : ""}
${byArea.length > 0 ? `Zone: ${byArea.map((a) => `${a.area} (€${a.total})`).join(", ")}` : ""}

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
      // AI insight is optional - stats data will still be returned
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
