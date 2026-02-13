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
    const { fileUrl, artisanTrade, locale = "it" } = await req.json();

    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: "fileUrl is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompts: Record<string, string> = {
      it: `Analizza questo documento (preventivo/fattura/listino) di un ${artisanTrade || "artigiano"} italiano.

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

      en: `Analyze this document (quote/invoice/price list) from a ${artisanTrade || "contractor"}.

Extract the information to create a reusable quote template.

Respond ONLY with valid JSON in this structure:
{
  "name": "Template name (e.g., 'Bathroom renovation', 'Apartment electrical installation')",
  "description": "Brief description of the work type",
  "items": [
    {
      "description": "Item description",
      "quantity": 1,
      "unit": "hours|pieces|meters|square meter|flat rate",
      "unit_price": 50.00,
      "total": 50.00
    }
  ],
  "vat_rate": 22,
  "notes": "Any extracted notes"
}

Rules:
- If a price is unclear, estimate a reasonable market price
- Quantity must be a number > 0
- total must be quantity × unit_price
- unit must be one of: hours, pieces, meters, square meter, flat rate
- If you don't find specific items, create generic items based on the document type
- DO NOT invent items without basis in the document`,

      es: `Analiza este documento (presupuesto/factura/lista de precios) de un ${artisanTrade || "profesional"}.

Extrae la información para crear una plantilla de presupuesto reutilizable.

Responde SOLO con JSON válido en esta estructura:
{
  "name": "Nombre de plantilla (ej. 'Renovación de baño', 'Instalación eléctrica apartamento')",
  "description": "Breve descripción del tipo de trabajo",
  "items": [
    {
      "description": "Descripción del elemento",
      "quantity": 1,
      "unit": "horas|piezas|metros|metro cuadrado|tarifa plana",
      "unit_price": 50.00,
      "total": 50.00
    }
  ],
  "vat_rate": 22,
  "notes": "Notas extraídas"
}

Reglas:
- Si un precio no está claro, estima un precio razonable de mercado
- La cantidad debe ser un número > 0
- total debe ser quantity × unit_price
- unit debe ser uno de: horas, piezas, metros, metro cuadrado, tarifa plana
- Si no encuentras elementos específicos, crea elementos genéricos basados en el tipo de documento
- NO inventes elementos sin base en el documento`,

      pt: `Analise este documento (orçamento/fatura/lista de preços) de um ${artisanTrade || "profissional"}.

Extraia as informações para criar um modelo de orçamento reutilizável.

Responda APENAS com JSON válido nesta estrutura:
{
  "name": "Nome do modelo (ex. 'Renovação de banheiro', 'Instalação elétrica apartamento')",
  "description": "Breve descrição do tipo de trabalho",
  "items": [
    {
      "description": "Descrição do item",
      "quantity": 1,
      "unit": "horas|peças|metros|metro quadrado|tarifa fixa",
      "unit_price": 50.00,
      "total": 50.00
    }
  ],
  "vat_rate": 22,
  "notes": "Notas extraídas"
}

Regras:
- Se um preço não estiver claro, estime um preço de mercado razoável
- A quantidade deve ser um número > 0
- total deve ser quantity × unit_price
- unit deve ser um de: horas, peças, metros, metro quadrado, tarifa fixa
- Se não encontrar itens específicos, crie itens genéricos baseados no tipo de documento
- NÃO invente itens sem base no documento`
    };

    const prompt = prompts[locale as string] || prompts.it;

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
                text: prompt,
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
