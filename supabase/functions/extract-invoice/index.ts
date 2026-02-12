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
    const { imageUrl, text, artisanId } = await req.json();

    if (!imageUrl && !text) {
      return new Response(
        JSON.stringify({ error: "imageUrl or text is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

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
            text: `Analizza questa fattura/ricevuta e estrai i seguenti dati in JSON:
- supplier_name: nome del fornitore
- invoice_number: numero fattura
- category: categoria (materiali, servizi, attrezzature, trasporto, altro)
- subtotal: imponibile (numero)
- vat_amount: importo IVA (numero)
- total: totale (numero)
- issue_date: data emissione (formato YYYY-MM-DD)
- payment_due: scadenza pagamento (formato YYYY-MM-DD, se presente)

Rispondi SOLO con JSON valido. Se un campo non è leggibile, usa null.`,
          },
        ],
      });
    } else {
      // Text-based extraction (for XML or pasted text)
      messages.push({
        role: "user",
        content: `Analizza questo testo di una fattura e estrai i seguenti dati in JSON:
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

Rispondi SOLO con JSON valido. Se un campo non è chiaro, usa null.`,
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

    // Check for anomalies
    const flags: { duplicate?: boolean; unusual_amount?: boolean; near_deadline?: boolean; message?: string } = {};

    if (extracted.total && extracted.total > 10000) {
      flags.unusual_amount = true;
      flags.message = `Importo elevato: €${extracted.total.toFixed(2)}`;
    }

    if (extracted.payment_due) {
      const dueDate = new Date(extracted.payment_due);
      const daysUntilDue = Math.floor(
        (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        flags.near_deadline = true;
        flags.message = (flags.message ? flags.message + ". " : "") +
          `Scadenza tra ${daysUntilDue} giorni`;
      }
      if (daysUntilDue < 0) {
        flags.near_deadline = true;
        flags.message = (flags.message ? flags.message + ". " : "") +
          `Scaduta da ${Math.abs(daysUntilDue)} giorni`;
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
