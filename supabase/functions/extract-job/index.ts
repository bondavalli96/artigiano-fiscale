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
    const { text, artisanTrade } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const trade = artisanTrade || "artigiano";

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
            content: `Analizza questo testo di un ${trade}. Estrai:
- tipo_lavoro: tipo di lavoro descritto
- parole_chiave: array di parole chiave rilevanti
- prezzi_menzionati: array di numeri (prezzi menzionati, se presenti)
- materiali: array di materiali menzionati
- urgenza: "bassa", "media" o "alta" (stima basata sul testo)
- note: eventuali note aggiuntive

Testo da analizzare:
"${text}"

Rispondi SOLO in JSON valido. Se un campo non è chiaro, usa null.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const aiText = data.content[0].text;
    const cleaned = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(cleaned);

    return new Response(JSON.stringify({ extracted }), {
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
