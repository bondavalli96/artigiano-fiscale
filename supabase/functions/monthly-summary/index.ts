import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { artisanId } = await req.json();

    if (!artisanId) {
      return new Response(
        JSON.stringify({ error: "artisanId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // This month income (paid active invoices)
    const { data: currentIncome } = await supabase
      .from("invoices_active")
      .select("total")
      .eq("artisan_id", artisanId)
      .eq("status", "paid")
      .gte("paid_at", startOfMonth.toISOString());

    // This month expenses (passive invoices)
    const { data: currentExpenses } = await supabase
      .from("invoices_passive")
      .select("total")
      .eq("artisan_id", artisanId)
      .gte("created_at", startOfMonth.toISOString());

    // Previous month income
    const { data: prevIncome } = await supabase
      .from("invoices_active")
      .select("total")
      .eq("artisan_id", artisanId)
      .eq("status", "paid")
      .gte("paid_at", startOfPrevMonth.toISOString())
      .lte("paid_at", endOfPrevMonth.toISOString());

    // Previous month expenses
    const { data: prevExpenses } = await supabase
      .from("invoices_passive")
      .select("total")
      .eq("artisan_id", artisanId)
      .gte("created_at", startOfPrevMonth.toISOString())
      .lte("created_at", endOfPrevMonth.toISOString());

    const income = (currentIncome || []).reduce((s: number, i: { total: number }) => s + (i.total || 0), 0);
    const expenses = (currentExpenses || []).reduce((s: number, i: { total: number }) => s + (i.total || 0), 0);
    const pIncome = (prevIncome || []).reduce((s: number, i: { total: number }) => s + (i.total || 0), 0);
    const pExpenses = (prevExpenses || []).reduce((s: number, i: { total: number }) => s + (i.total || 0), 0);

    // Generate AI summary
    const margin = income - expenses;
    const prevMargin = pIncome - pExpenses;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
            content: `Riassumi la situazione finanziaria di questo mese per un artigiano italiano.

Dati:
- Entrate questo mese: €${income.toFixed(2)}
- Uscite questo mese: €${expenses.toFixed(2)}
- Margine: €${margin.toFixed(2)}
- Entrate mese scorso: €${pIncome.toFixed(2)}
- Uscite mese scorso: €${pExpenses.toFixed(2)}
- Margine mese scorso: €${prevMargin.toFixed(2)}

Scrivi un riassunto in 3-4 frasi, come parleresti a un amico. Zero gergo tecnico-contabile. Usa il "tu".
Rispondi SOLO con il testo del riassunto, niente JSON.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const summary = data.content[0].text;

    return new Response(
      JSON.stringify({
        income,
        expenses,
        margin,
        prevIncome: pIncome,
        prevExpenses: pExpenses,
        prevMargin,
        summary,
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
