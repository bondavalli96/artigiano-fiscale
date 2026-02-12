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
    const { fileUrl, artisanTrade } = await req.json();

    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: "fileUrl is required" }),
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
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "url", url: fileUrl },
              },
              {
                type: "text",
                text: `Analizza questo documento (preventivo/fattura/listino) di un ${artisanTrade || "artigiano"} italiano.

Estrai le informazioni per creare un template di preventivo riutilizzabile.

Rispondi SOLO in JSON valido con questa struttura:
{
  "name": "Nome del template (es. 'Ristrutturazione bagno', 'Impianto elettrico appartamento')",
  "description": "Breve descrizione del tipo di lavoro",
  "items": [
    {
      "description": "Descrizione voce",
      "quantity": 1,
      "unit": "ore|pezzi|metri|metro quadro|forfait",
      "unit_price": 50.00,
      "total": 50.00
    }
  ],
  "vat_rate": 22,
  "notes": "Eventuali note estratte"
}

Regole:
- Se un prezzo non è chiaro, stima un prezzo ragionevole per il mercato italiano
- La quantità deve essere un numero > 0
- Il total deve essere quantity × unit_price
- unit deve essere una di: ore, pezzi, metri, metro quadro, forfait
- Se non trovi voci specifiche, crea voci generiche basate sul tipo di documento
- NON inventare voci che non hanno riscontro nel documento`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const template = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(template), {
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
