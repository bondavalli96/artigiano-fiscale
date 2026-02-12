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
    const { text, artisanTrade, locale = "it" } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const trade = artisanTrade || "artigiano";

    const prompts: Record<string, string> = {
      it: `Analizza questo testo di un ${trade}. Estrai:
- tipo_lavoro: tipo di lavoro descritto
- parole_chiave: array di parole chiave rilevanti
- prezzi_menzionati: array di numeri (prezzi menzionati, se presenti)
- materiali: array di materiali menzionati
- urgenza: "bassa", "media" o "alta" (stima basata sul testo)
- note: eventuali note aggiuntive

Testo da analizzare:
"${text}"

Rispondi SOLO in JSON valido. Se un campo non è chiaro, usa null.`,
      en: `Analyze this text from a ${trade}. Extract:
- tipo_lavoro: type of work described
- parole_chiave: array of relevant keywords
- prezzi_menzionati: array of numbers (prices mentioned, if any)
- materiali: array of materials mentioned
- urgenza: "bassa", "media" or "alta" (estimate based on text)
- note: any additional notes

Text to analyze:
"${text}"

Reply ONLY in valid JSON. If a field is unclear, use null.`,
      es: `Analiza este texto de un ${trade}. Extrae:
- tipo_lavoro: tipo de trabajo descrito
- parole_chiave: array de palabras clave relevantes
- prezzi_menzionati: array de números (precios mencionados, si hay)
- materiali: array de materiales mencionados
- urgenza: "bassa", "media" o "alta" (estimación basada en el texto)
- note: notas adicionales

Texto a analizar:
"${text}"

Responde SOLO en JSON válido. Si un campo no está claro, usa null.`,
      pt: `Analisa este texto de um ${trade}. Extrai:
- tipo_lavoro: tipo de trabalho descrito
- parole_chiave: array de palavras-chave relevantes
- prezzi_menzionati: array de números (preços mencionados, se houver)
- materiali: array de materiais mencionados
- urgenza: "bassa", "media" ou "alta" (estimativa baseada no texto)
- note: notas adicionais

Texto a analisar:
"${text}"

Responde APENAS em JSON válido. Se um campo não estiver claro, usa null.`,
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
