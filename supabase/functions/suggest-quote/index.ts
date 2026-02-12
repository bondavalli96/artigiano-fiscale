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
    const { jobDescription, priceList, artisanTrade, locale = "it" } = await req.json();

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: "jobDescription is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const trade = artisanTrade || "artigiano";

    const noPriceText: Record<string, string> = {
      it: "prezzo non definito",
      en: "price not set",
      es: "precio no definido",
      pt: "preço não definido",
    };
    const noListText: Record<string, string> = {
      it: "Nessun listino disponibile",
      en: "No price list available",
      es: "Sin lista de precios disponible",
      pt: "Sem lista de preços disponível",
    };

    const priceListText =
      priceList && priceList.length > 0
        ? priceList
            .map(
              (p: { description: string; unit: string; default_price: number | null }) =>
                `- ${p.description} (${p.unit}): ${p.default_price ? `€${p.default_price}` : noPriceText[locale]}`
            )
            .join("\n")
        : noListText[locale];

    const prompts: Record<string, string> = {
      it: `Sei un assistente per un ${trade} italiano. Basandoti sulla descrizione del lavoro e sul listino dell'artigiano, genera una bozza di preventivo.

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
      en: `You are an assistant for an ${trade}. Based on the job description and the tradesperson's price list, generate a draft quote.

Job description: "${jobDescription}"

Available price list:
${priceListText}

Generate a JSON array of quote items. For each item:
- description: item description (string)
- quantity: estimated quantity (number)
- unit: unit of measure (hours, pieces, meters, square meter, flat rate)
- unit_price: suggested unit price in euros (number, based on price list if available)
- total: quantity × unit price (number)

Rules:
- Use ONLY items consistent with the described job
- If the price list has a price, use it. Otherwise estimate a reasonable price.
- Include labor, necessary materials, and travel if appropriate
- Don't invent unnecessary work

Reply ONLY with a valid JSON array, no additional text.`,
      es: `Eres un asistente para un ${trade}. Basándote en la descripción del trabajo y la lista de precios del artesano, genera un borrador de presupuesto.

Descripción trabajo: "${jobDescription}"

Lista de precios disponible:
${priceListText}

Genera un array JSON de partidas del presupuesto. Para cada partida:
- description: descripción de la partida (string)
- quantity: cantidad estimada (número)
- unit: unidad de medida (horas, piezas, metros, metro cuadrado, forfait)
- unit_price: precio unitario sugerido en euros (número, basado en la lista si disponible)
- total: cantidad × precio unitario (número)

Reglas:
- Usa SOLO partidas coherentes con el trabajo descrito
- Si la lista tiene un precio, úsalo. Si no, estima un precio razonable.
- Incluye mano de obra, materiales necesarios y desplazamiento si es apropiado
- No inventes trabajos no solicitados

Responde SOLO con un array JSON válido, sin texto adicional.`,
      pt: `És um assistente para um ${trade}. Com base na descrição do trabalho e na lista de preços do artesão, gera um rascunho de orçamento.

Descrição trabalho: "${jobDescription}"

Lista de preços disponível:
${priceListText}

Gera um array JSON de itens do orçamento. Para cada item:
- description: descrição do item (string)
- quantity: quantidade estimada (número)
- unit: unidade de medida (horas, peças, metros, metro quadrado, forfait)
- unit_price: preço unitário sugerido em euros (número, baseado na lista se disponível)
- total: quantidade × preço unitário (número)

Regras:
- Usa APENAS itens coerentes com o trabalho descrito
- Se a lista tiver um preço, usa-o. Caso contrário estima um preço razoável.
- Inclui mão de obra, materiais necessários e deslocação se apropriado
- Não inventes trabalhos não solicitados

Responde APENAS com um array JSON válido, sem texto adicional.`,
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
        max_tokens: 2048,
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
    const items = JSON.parse(cleaned);

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
