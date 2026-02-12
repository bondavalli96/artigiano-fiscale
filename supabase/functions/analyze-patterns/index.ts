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

    // Fetch artisan data for analysis
    const [
      { data: quotes },
      { data: activeInvoices },
      { data: passiveInvoices },
      { data: clients },
      { data: priceList },
    ] = await Promise.all([
      supabase
        .from("quotes")
        .select("items, total, status, client_id, created_at")
        .eq("artisan_id", artisanId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("invoices_active")
        .select("total, status, payment_due, paid_at, client_id")
        .eq("artisan_id", artisanId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("invoices_passive")
        .select("total, category, supplier_name, created_at")
        .eq("artisan_id", artisanId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("clients")
        .select("id, name, reliability_score")
        .eq("artisan_id", artisanId),
      supabase
        .from("price_list")
        .select("description, unit, default_price, usage_count")
        .eq("artisan_id", artisanId),
    ]);

    // Build analysis context
    const context = {
      totalQuotes: quotes?.length || 0,
      acceptedQuotes: quotes?.filter((q: { status: string }) => q.status === "accepted").length || 0,
      avgQuoteTotal: quotes && quotes.length > 0
        ? quotes.reduce((s: number, q: { total: number }) => s + (q.total || 0), 0) / quotes.length
        : 0,
      totalActiveInvoices: activeInvoices?.length || 0,
      paidInvoices: activeInvoices?.filter((i: { status: string }) => i.status === "paid").length || 0,
      overdueInvoices: activeInvoices?.filter((i: { status: string }) => i.status === "overdue").length || 0,
      totalExpenses: passiveInvoices?.reduce((s: number, i: { total: number }) => s + (i.total || 0), 0) || 0,
      topExpenseCategories: [...new Set(passiveInvoices?.map((i: { category: string }) => i.category).filter(Boolean) || [])],
      clientCount: clients?.length || 0,
      lowReliabilityClients: clients?.filter((c: { reliability_score: number }) => c.reliability_score < 40) || [],
      priceListItems: priceList?.length || 0,
      unusedPriceItems: priceList?.filter((p: { usage_count: number }) => p.usage_count === 0) || [],
    };

    const prompts: Record<string, string> = {
      it: `Analizza i dati di questo artigiano e genera al massimo 3 suggerimenti utili.

Dati:
- Preventivi fatti: ${context.totalQuotes}, accettati: ${context.acceptedQuotes}
- Preventivo medio: EUR ${context.avgQuoteTotal.toFixed(2)}
- Fatture attive: ${context.totalActiveInvoices}, pagate: ${context.paidInvoices}, scadute: ${context.overdueInvoices}
- Spese totali recenti: EUR ${context.totalExpenses.toFixed(2)}
- Categorie spesa principali: ${context.topExpenseCategories.join(", ") || "nessuna"}
- Clienti totali: ${context.clientCount}
- Clienti poco affidabili: ${context.lowReliabilityClients.length}
- Voci listino: ${context.priceListItems}, mai usate: ${context.unusedPriceItems.length}

Genera un JSON array con max 3 suggerimenti. Per ogni suggerimento:
- type: "pricing" | "client" | "expense" | "efficiency"
- suggestion: testo del suggerimento (1-2 frasi, in italiano, tono pratico e amichevole)
- priority: "high" | "medium" | "low"

Se non ci sono abbastanza dati per suggerimenti utili, ritorna un array vuoto.
Rispondi SOLO con JSON array valido.`,
      en: `Analyze this tradesperson's data and generate up to 3 useful suggestions.

Data:
- Quotes created: ${context.totalQuotes}, accepted: ${context.acceptedQuotes}
- Average quote total: EUR ${context.avgQuoteTotal.toFixed(2)}
- Active invoices: ${context.totalActiveInvoices}, paid: ${context.paidInvoices}, overdue: ${context.overdueInvoices}
- Recent total expenses: EUR ${context.totalExpenses.toFixed(2)}
- Main expense categories: ${context.topExpenseCategories.join(", ") || "none"}
- Total clients: ${context.clientCount}
- Low reliability clients: ${context.lowReliabilityClients.length}
- Price list items: ${context.priceListItems}, never used: ${context.unusedPriceItems.length}

Return a JSON array with max 3 suggestions. For each suggestion:
- type: "pricing" | "client" | "expense" | "efficiency"
- suggestion: suggestion text (1-2 sentences, in English, practical and friendly tone)
- priority: "high" | "medium" | "low"

If there is not enough data for useful suggestions, return an empty array.
Reply ONLY with a valid JSON array.`,
      es: `Analiza los datos de este artesano y genera hasta 3 sugerencias útiles.

Datos:
- Presupuestos: ${context.totalQuotes}, aceptados: ${context.acceptedQuotes}
- Presupuesto medio: EUR ${context.avgQuoteTotal.toFixed(2)}
- Facturas activas: ${context.totalActiveInvoices}, pagadas: ${context.paidInvoices}, vencidas: ${context.overdueInvoices}
- Gastos totales recientes: EUR ${context.totalExpenses.toFixed(2)}
- Categorías gasto principales: ${context.topExpenseCategories.join(", ") || "ninguna"}
- Clientes totales: ${context.clientCount}
- Clientes poco fiables: ${context.lowReliabilityClients.length}
- Partidas listado: ${context.priceListItems}, nunca usadas: ${context.unusedPriceItems.length}

Genera un JSON array con máx 3 sugerencias. Para cada sugerencia:
- type: "pricing" | "client" | "expense" | "efficiency"
- suggestion: texto de la sugerencia (1-2 frases, en español, tono práctico y amigable)
- priority: "high" | "medium" | "low"

Si no hay suficientes datos, devuelve un array vacío.
Responde SOLO con JSON array válido.`,
      pt: `Analisa os dados deste artesão e gera até 3 sugestões úteis.

Dados:
- Orçamentos: ${context.totalQuotes}, aceites: ${context.acceptedQuotes}
- Orçamento médio: EUR ${context.avgQuoteTotal.toFixed(2)}
- Faturas ativas: ${context.totalActiveInvoices}, pagas: ${context.paidInvoices}, vencidas: ${context.overdueInvoices}
- Despesas totais recentes: EUR ${context.totalExpenses.toFixed(2)}
- Categorias despesa principais: ${context.topExpenseCategories.join(", ") || "nenhuma"}
- Clientes totais: ${context.clientCount}
- Clientes pouco fiáveis: ${context.lowReliabilityClients.length}
- Itens lista: ${context.priceListItems}, nunca usados: ${context.unusedPriceItems.length}

Gera um JSON array com máx 3 sugestões. Para cada sugestão:
- type: "pricing" | "client" | "expense" | "efficiency"
- suggestion: texto da sugestão (1-2 frases, em português, tom prático e amigável)
- priority: "high" | "medium" | "low"

Se não há dados suficientes, devolve array vazio.
Responde APENAS com JSON array válido.`,
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
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const suggestions = JSON.parse(cleaned);

    // Save suggestions to ai_patterns
    for (const suggestion of suggestions) {
      await supabase.from("ai_patterns").insert({
        artisan_id: artisanId,
        pattern_type: suggestion.type,
        data: { priority: suggestion.priority },
        suggestion: suggestion.suggestion,
        accepted: null,
      });
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { "Content-Type": "application/json" },
    });
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
