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
      return new Response(
        JSON.stringify({ error: "trade is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Genera 3 template di preventivo standard per un ${trade} italiano.

Per ogni template, crea un preventivo-tipo con voci realistiche, quantità e prezzi medi del mercato italiano 2025-2026.

Rispondi SOLO in JSON valido con questa struttura:
{
  "templates": [
    {
      "name": "Nome template (es. 'Rifacimento bagno completo')",
      "description": "Breve descrizione",
      "items": [
        {
          "description": "Descrizione voce",
          "quantity": 8,
          "unit": "ore",
          "unit_price": 40.00,
          "total": 320.00
        }
      ]
    }
  ]
}

Regole:
- 3 template diversi, dal piu comune al piu specifico
- Ogni template deve avere 4-8 voci
- Prezzi realistici per il mercato italiano (zona media)
- unit: ore, pezzi, metri, metro quadro, forfait
- total = quantity × unit_price
- Include sia manodopera che materiali tipici
- Nomi in italiano, chiari e professionali`,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
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
