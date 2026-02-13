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
    const { imageUrl, text, artisanId, locale = "it" } = await req.json();

    if (!imageUrl && !text) {
      return new Response(
        JSON.stringify({ error: "imageUrl or text is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompts: Record<string, { imagePrompt: string; textPrompt: (text: string) => string }> = {
      it: {
        imagePrompt: `Analizza questa fattura/ricevuta e estrai i seguenti dati in JSON:
- supplier_name: nome del fornitore
- invoice_number: numero fattura
- category: categoria (materiali, servizi, attrezzature, trasporto, altro)
- subtotal: imponibile (numero)
- vat_amount: importo IVA (numero)
- total: totale (numero)
- issue_date: data emissione (formato YYYY-MM-DD)
- payment_due: scadenza pagamento (formato YYYY-MM-DD, se presente)

Rispondi SOLO con JSON valido. Se un campo non è leggibile, usa null.`,
        textPrompt: (text: string) => `Analizza questo testo di una fattura e estrai i seguenti dati in JSON:
- supplier_name: nome del fornitore
- invoice_number: numero fattura
- category: categoria (materiali, servizi, attrezzature, trasporto, altro)
- subtotal: imponibile (numero)
- vat_amount: importo IVA (numero)
- total: totale (numero)
- issue_date: data emissione (formato YYYY-MM-DD)
- payment_due: scadenza pagamento (formato YYYY-MM-DD, se presente)

Testo:
${text}

Rispondi SOLO con JSON valido. Se un campo non è chiaro, usa null.`
      },
      en: {
        imagePrompt: `Analyze this invoice/receipt and extract the following data as JSON:
- supplier_name: supplier name
- invoice_number: invoice number
- category: category (materials, services, equipment, transport, other)
- subtotal: subtotal (number)
- vat_amount: VAT amount (number)
- total: total (number)
- issue_date: issue date (YYYY-MM-DD format)
- payment_due: payment deadline (YYYY-MM-DD format, if present)

Respond ONLY with valid JSON. If a field is not readable, use null.`,
        textPrompt: (text: string) => `Analyze this invoice text and extract the following data as JSON:
- supplier_name: supplier name
- invoice_number: invoice number
- category: category (materials, services, equipment, transport, other)
- subtotal: subtotal (number)
- vat_amount: VAT amount (number)
- total: total (number)
- issue_date: issue date (YYYY-MM-DD format)
- payment_due: payment deadline (YYYY-MM-DD format, if present)

Text:
${text}

Respond ONLY with valid JSON. If a field is unclear, use null.`
      },
      es: {
        imagePrompt: `Analiza esta factura/recibo y extrae los siguientes datos en JSON:
- supplier_name: nombre del proveedor
- invoice_number: número de factura
- category: categoría (materiales, servicios, equipos, transporte, otro)
- subtotal: subtotal (número)
- vat_amount: importe del IVA (número)
- total: total (número)
- issue_date: fecha de emisión (formato YYYY-MM-DD)
- payment_due: fecha de vencimiento (formato YYYY-MM-DD, si está presente)

Responde SOLO con JSON válido. Si un campo no es legible, usa null.`,
        textPrompt: (text: string) => `Analiza este texto de una factura y extrae los siguientes datos en JSON:
- supplier_name: nombre del proveedor
- invoice_number: número de factura
- category: categoría (materiales, servicios, equipos, transporte, otro)
- subtotal: subtotal (número)
- vat_amount: importe del IVA (número)
- total: total (número)
- issue_date: fecha de emisión (formato YYYY-MM-DD)
- payment_due: fecha de vencimiento (formato YYYY-MM-DD, si está presente)

Texto:
${text}

Responde SOLO con JSON válido. Si un campo no es claro, usa null.`
      },
      pt: {
        imagePrompt: `Analise esta fatura/recibo e extraia os seguintes dados em JSON:
- supplier_name: nome do fornecedor
- invoice_number: número da fatura
- category: categoria (materiais, serviços, equipamentos, transporte, outro)
- subtotal: subtotal (número)
- vat_amount: valor do IVA (número)
- total: total (número)
- issue_date: data de emissão (formato YYYY-MM-DD)
- payment_due: prazo de pagamento (formato YYYY-MM-DD, se presente)

Responda APENAS com JSON válido. Se um campo não for legível, use null.`,
        textPrompt: (text: string) => `Analise este texto de uma fatura e extraia os seguintes dados em JSON:
- supplier_name: nome do fornecedor
- invoice_number: número da fatura
- category: categoria (materiais, serviços, equipamentos, transporte, outro)
- subtotal: subtotal (número)
- vat_amount: valor do IVA (número)
- total: total (número)
- issue_date: data de emissão (formato YYYY-MM-DD)
- payment_due: prazo de pagamento (formato YYYY-MM-DD, se presente)

Texto:
${text}

Responda APENAS com JSON válido. Se um campo não estiver claro, use null.`
      }
    };

    const selectedPrompts = prompts[locale as string] || prompts.it;

    const messages: { role: string; content: unknown }[] = [];

    if (imageUrl) {
      // Use Claude Vision for image-based extraction
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(imageBuffer))
      );
      const mediaType = imageUrl.includes(".pdf")
        ? "application/pdf"
        : imageUrl.includes(".png")
        ? "image/png"
        : "image/jpeg";

      messages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: selectedPrompts.imagePrompt,
          },
        ],
      });
    } else {
      // Text-based extraction (for XML or pasted text)
      messages.push({
        role: "user",
        content: selectedPrompts.textPrompt(text),
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
        messages,
      }),
    });

    const data = await response.json();
    const aiText = data.content[0].text;
    const cleaned = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(cleaned);

    // Check for anomalies with localized messages
    const warningMessages: Record<string, { highAmount: (amount: number) => string; dueInDays: (days: number) => string; overdueDays: (days: number) => string }> = {
      it: {
        highAmount: (amount) => `Importo elevato: €${amount.toFixed(2)}`,
        dueInDays: (days) => `Scadenza tra ${days} giorni`,
        overdueDays: (days) => `Scaduta da ${days} giorni`
      },
      en: {
        highAmount: (amount) => `High amount: €${amount.toFixed(2)}`,
        dueInDays: (days) => `Due in ${days} days`,
        overdueDays: (days) => `Overdue by ${days} days`
      },
      es: {
        highAmount: (amount) => `Importe alto: €${amount.toFixed(2)}`,
        dueInDays: (days) => `Vence en ${days} días`,
        overdueDays: (days) => `Vencido hace ${days} días`
      },
      pt: {
        highAmount: (amount) => `Valor alto: €${amount.toFixed(2)}`,
        dueInDays: (days) => `Vence em ${days} dias`,
        overdueDays: (days) => `Vencido há ${days} dias`
      }
    };

    const warnings = warningMessages[locale as string] || warningMessages.it;

    const flags: { duplicate?: boolean; unusual_amount?: boolean; near_deadline?: boolean; message?: string } = {};

    if (extracted.total && extracted.total > 10000) {
      flags.unusual_amount = true;
      flags.message = warnings.highAmount(extracted.total);
    }

    if (extracted.payment_due) {
      const dueDate = new Date(extracted.payment_due);
      const daysUntilDue = Math.floor(
        (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        flags.near_deadline = true;
        flags.message = (flags.message ? flags.message + ". " : "") +
          warnings.dueInDays(daysUntilDue);
      }
      if (daysUntilDue < 0) {
        flags.near_deadline = true;
        flags.message = (flags.message ? flags.message + ". " : "") +
          warnings.overdueDays(Math.abs(daysUntilDue));
      }
    }

    return new Response(
      JSON.stringify({ extracted, flags }),
      { headers: { "Content-Type": "application/json" } }
    );
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
