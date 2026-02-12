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
    const { artisanId, locale = "it" } = await req.json();

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

    const prompts: Record<string, string> = {
      it: `Riassumi la situazione finanziaria di questo mese per un artigiano.

Dati:
- Entrate questo mese: EUR ${income.toFixed(2)}
- Uscite questo mese: EUR ${expenses.toFixed(2)}
- Margine: EUR ${margin.toFixed(2)}
- Entrate mese scorso: EUR ${pIncome.toFixed(2)}
- Uscite mese scorso: EUR ${pExpenses.toFixed(2)}
- Margine mese scorso: EUR ${prevMargin.toFixed(2)}

Scrivi un riassunto in 3-4 frasi in italiano, tono colloquiale e pratico, senza gergo tecnico-contabile.
Usa il "tu".
Rispondi SOLO con il testo del riassunto, niente JSON.`,
      en: `Summarize this month's financial situation for a tradesperson.

Data:
- Income this month: EUR ${income.toFixed(2)}
- Expenses this month: EUR ${expenses.toFixed(2)}
- Margin: EUR ${margin.toFixed(2)}
- Income last month: EUR ${pIncome.toFixed(2)}
- Expenses last month: EUR ${pExpenses.toFixed(2)}
- Margin last month: EUR ${prevMargin.toFixed(2)}

Write a 3-4 sentence summary in English, conversational and practical, no accounting jargon.
Use second person ("you").
Reply ONLY with the summary text, no JSON.`,
      es: `Resume la situación financiera de este mes para un artesano.

Datos:
- Ingresos este mes: EUR ${income.toFixed(2)}
- Gastos este mes: EUR ${expenses.toFixed(2)}
- Margen: EUR ${margin.toFixed(2)}
- Ingresos mes pasado: EUR ${pIncome.toFixed(2)}
- Gastos mes pasado: EUR ${pExpenses.toFixed(2)}
- Margen mes pasado: EUR ${prevMargin.toFixed(2)}

Escribe un resumen de 3-4 frases en español, tono coloquial y práctico, sin jerga contable.
Usa el "tú".
Responde SOLO con el texto del resumen, sin JSON.`,
      pt: `Resuma a situação financeira deste mês para um artesão.

Dados:
- Receitas este mês: EUR ${income.toFixed(2)}
- Despesas este mês: EUR ${expenses.toFixed(2)}
- Margem: EUR ${margin.toFixed(2)}
- Receitas mês passado: EUR ${pIncome.toFixed(2)}
- Despesas mês passado: EUR ${pExpenses.toFixed(2)}
- Margem mês passado: EUR ${prevMargin.toFixed(2)}

Escreva um resumo de 3-4 frases em português, tom coloquial e prático, sem jargão contabilístico.
Use o "você".
Responda APENAS com o texto do resumo, sem JSON.`,
    };
    const prompt = prompts[locale] || prompts.it;

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
            content: prompt,
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
