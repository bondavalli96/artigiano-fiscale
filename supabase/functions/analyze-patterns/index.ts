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
            content: `Analizza questi dati di un artigiano italiano e genera al massimo 3 suggerimenti utili.

Dati:
- Preventivi fatti: ${context.totalQuotes}, accettati: ${context.acceptedQuotes}
- Preventivo medio: €${context.avgQuoteTotal.toFixed(2)}
- Fatture attive: ${context.totalActiveInvoices}, pagate: ${context.paidInvoices}, scadute: ${context.overdueInvoices}
- Spese totali recenti: €${context.totalExpenses.toFixed(2)}
- Categorie spesa principali: ${context.topExpenseCategories.join(", ") || "nessuna"}
- Clienti totali: ${context.clientCount}
- Clienti poco affidabili: ${context.lowReliabilityClients.length}
- Voci listino: ${context.priceListItems}, mai usate: ${context.unusedPriceItems.length}

Genera un JSON array con max 3 suggerimenti. Per ogni suggerimento:
- type: "pricing" | "client" | "expense" | "efficiency"
- suggestion: testo del suggerimento (1-2 frasi, in italiano, tono amichevole)
- priority: "high" | "medium" | "low"

Se non ci sono abbastanza dati per suggerimenti utili, ritorna un array vuoto.
Rispondi SOLO con JSON array valido.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const suggestions = JSON.parse(data.content[0].text);

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
