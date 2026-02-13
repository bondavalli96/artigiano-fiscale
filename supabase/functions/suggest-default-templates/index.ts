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
      return new Response(
        JSON.stringify({ error: "trade is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompts: Record<string, string> = {
      it: `Genera 3 template di preventivo standard per un ${trade} italiano.

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

      en: `Generate 3 standard quote templates for a ${trade} contractor.

For each template, create a typical quote with realistic items, quantities, and average market prices for 2025-2026.

Respond ONLY with valid JSON in this structure:
{
  "templates": [
    {
      "name": "Template name (e.g., 'Complete bathroom renovation')",
      "description": "Brief description",
      "items": [
        {
          "description": "Item description",
          "quantity": 8,
          "unit": "hours",
          "unit_price": 40.00,
          "total": 320.00
        }
      ]
    }
  ]
}

Rules:
- 3 different templates, from most common to most specific
- Each template should have 4-8 items
- Realistic prices for the market (average zone)
- unit: hours, pieces, meters, square meter, flat rate
- total = quantity × unit_price
- Include both labor and typical materials
- Names in English, clear and professional`,

      es: `Genera 3 plantillas de presupuesto estándar para un ${trade} profesional.

Para cada plantilla, crea un presupuesto tipo con elementos realistas, cantidades y precios medios del mercado 2025-2026.

Responde SOLO con JSON válido en esta estructura:
{
  "templates": [
    {
      "name": "Nombre de plantilla (ej. 'Renovación completa de baño')",
      "description": "Breve descripción",
      "items": [
        {
          "description": "Descripción del elemento",
          "quantity": 8,
          "unit": "horas",
          "unit_price": 40.00,
          "total": 320.00
        }
      ]
    }
  ]
}

Reglas:
- 3 plantillas diferentes, de lo más común a lo más específico
- Cada plantilla debe tener 4-8 elementos
- Precios realistas para el mercado (zona media)
- unit: horas, piezas, metros, metro cuadrado, tarifa plana
- total = quantity × unit_price
- Incluye tanto mano de obra como materiales típicos
- Nombres en español, claros y profesionales`,

      pt: `Gere 3 modelos de orçamento padrão para um ${trade} profissional.

Para cada modelo, crie um orçamento típico com itens realistas, quantidades e preços médios de mercado 2025-2026.

Responda APENAS com JSON válido nesta estrutura:
{
  "templates": [
    {
      "name": "Nome do modelo (ex. 'Renovação completa de banheiro')",
      "description": "Breve descrição",
      "items": [
        {
          "description": "Descrição do item",
          "quantity": 8,
          "unit": "horas",
          "unit_price": 40.00,
          "total": 320.00
        }
      ]
    }
  ]
}

Regras:
- 3 modelos diferentes, do mais comum ao mais específico
- Cada modelo deve ter 4-8 itens
- Preços realistas para o mercado (zona média)
- unit: horas, peças, metros, metro quadrado, tarifa fixa
- total = quantity × unit_price
- Inclua mão de obra e materiais típicos
- Nomes em português, claros e profissionais`
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
        max_tokens: 4096,
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
