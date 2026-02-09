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
    const { jobDescription, priceList, artisanTrade } = await req.json();

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: "jobDescription is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const trade = artisanTrade || "artigiano";
    const priceListText =
      priceList && priceList.length > 0
        ? priceList
            .map(
              (p: { description: string; unit: string; default_price: number | null }) =>
                `- ${p.description} (${p.unit}): ${p.default_price ? `€${p.default_price}` : "prezzo non definito"}`
            )
            .join("\n")
        : "Nessun listino disponibile";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `Sei un assistente per un ${trade} italiano. Basandoti sulla descrizione del lavoro e sul listino dell'artigiano, genera una bozza di preventivo.

Descrizione lavoro: "${jobDescription}"

Listino artigiano disponibile:
${priceListText}

Genera un array JSON di voci preventivo. Per ogni voce:
- description: descrizione della voce (stringa)
- quantity: quantità stimata (numero)
- unit: unità di misura (ore, pezzi, metri, metro quadro, forfait)
- unit_price: prezzo unitario suggerito in euro (numero, basato sul listino se disponibile)
- total: quantità × prezzo unitario (numero)

Regole:
- Usa SOLO voci coerenti col lavoro descritto
- Se il listino ha un prezzo, usa quello. Altrimenti stima un prezzo ragionevole.
- Includi manodopera, materiali necessari, e trasferta se appropriato
- Non inventare lavorazioni non richieste

Rispondi SOLO con un JSON array valido, nessun testo aggiuntivo.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const items = JSON.parse(data.content[0].text);

    return new Response(JSON.stringify({ items }), {
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
