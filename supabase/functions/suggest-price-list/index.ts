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
    const { trade, locale = "it" } = await req.json();

    if (!trade) {
      return new Response(JSON.stringify({ error: "trade is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompts: Record<string, string> = {
      it: `Sei un assistente per artigiani italiani. Genera un listino prezzi standard con 15 voci per un ${trade} italiano.

Per ogni voce includi:
- description: descrizione breve della voce (es. "Installazione rubinetto")
- unit: unità di misura (ore, pezzo, metro, metro quadro, forfait)
- category: categoria (manodopera, materiale, trasferta)

NON inserire prezzi — solo descrizioni, unità e categorie.
Rispondi SOLO con un JSON array valido, senza testo aggiuntivo.

Esempio formato:
[{"description":"Installazione rubinetto","unit":"pezzo","category":"manodopera"}]`,
      en: `You are an assistant for tradespeople. Generate a standard price list with 15 items for an ${trade}.

For each item include:
- description: brief description of the item (e.g. "Tap installation")
- unit: unit of measure (hours, piece, meter, square meter, flat rate)
- category: category (labor, material, travel)

Do NOT insert prices — only descriptions, units and categories.
Reply ONLY with a valid JSON array, no additional text.

Example format:
[{"description":"Tap installation","unit":"piece","category":"labor"}]`,
      es: `Eres un asistente para artesanos. Genera una lista de precios estándar con 15 partidas para un ${trade}.

Para cada partida incluye:
- description: descripción breve de la partida (ej. "Instalación grifo")
- unit: unidad de medida (horas, pieza, metro, metro cuadrado, forfait)
- category: categoría (mano de obra, material, desplazamiento)

NO insertes precios — solo descripciones, unidades y categorías.
Responde SOLO con un array JSON válido, sin texto adicional.

Ejemplo formato:
[{"description":"Instalación grifo","unit":"pieza","category":"mano de obra"}]`,
      pt: `És um assistente para artesãos. Gera uma lista de preços padrão com 15 itens para um ${trade}.

Para cada item inclui:
- description: descrição breve do item (ex. "Instalação torneira")
- unit: unidade de medida (horas, peça, metro, metro quadrado, forfait)
- category: categoria (mão de obra, material, deslocação)

NÃO insiras preços — apenas descrições, unidades e categorias.
Responde APENAS com um array JSON válido, sem texto adicional.

Exemplo formato:
[{"description":"Instalação torneira","unit":"peça","category":"mão de obra"}]`,
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
