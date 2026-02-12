import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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
    const { trade } = await req.json();

    if (!trade) {
      return new Response(JSON.stringify({ error: "trade is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

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
            content: `Sei un assistente per artigiani italiani. Genera un listino prezzi standard con 15 voci per un ${trade} italiano.

Per ogni voce includi:
- description: descrizione breve della voce (es. "Installazione rubinetto")
- unit: unità di misura (ore, pezzo, metro, metro quadro, forfait)
- category: categoria (manodopera, materiale, trasferta)

NON inserire prezzi — solo descrizioni, unità e categorie.
Rispondi SOLO con un JSON array valido, senza testo aggiuntivo.

Esempio formato:
[{"description":"Installazione rubinetto","unit":"pezzo","category":"manodopera"}]`,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;

    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const items = JSON.parse(cleaned);

    return new Response(JSON.stringify({ items }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
