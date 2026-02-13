import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function transcribeAudio(audioUrl: string): Promise<string> {
  const audioRes = await fetch(audioUrl);
  const audioBlob = await audioRes.blob();
  const ext = audioUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "m4a";
  const mimeMap: Record<string, string> = {
    ogg: "audio/ogg",
    m4a: "audio/m4a",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
    mp4: "audio/mp4",
  };
  const mime = mimeMap[ext] || "audio/m4a";
  const file = new File([audioBlob], `audio.${ext}`, { type: mime });

  let transcription = "";
  let lastError = "No provider configured";

  if (GROQ_API_KEY) {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("model", "whisper-large-v3-turbo");
      form.append("language", "it");

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Groq failed (${res.status})`);
      transcription = data.text || "";
    } catch (error) {
      lastError = `groq: ${(error as Error).message}`;
    }
  }

  if (!transcription && DEEPGRAM_API_KEY) {
    try {
      const res = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&detect_language=true",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DEEPGRAM_API_KEY}`,
            "Content-Type": mime,
          },
          body: audioBlob,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.err_msg || `Deepgram failed (${res.status})`);
      transcription = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    } catch (error) {
      lastError = `deepgram: ${(error as Error).message}`;
    }
  }

  if (!transcription && OPENAI_API_KEY) {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("model", "whisper-1");
      form.append("language", "it");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI failed (${res.status})`);
      transcription = data.text || "";
    } catch (error) {
      lastError = `openai: ${(error as Error).message}`;
    }
  }

  if (!transcription) {
    throw new Error(`Audio transcription failed. ${lastError}`);
  }

  return transcription;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const { inboxItemId, locale = "it" } = body;

    if (!inboxItemId) {
      return new Response(
        JSON.stringify({ error: "inboxItemId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the inbox item
    const { data: item, error: fetchErr } = await supabase
      .from("inbox_items")
      .select("*")
      .eq("id", inboxItemId)
      .single();

    if (fetchErr || !item) {
      return new Response(
        JSON.stringify({ error: "Inbox item not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Mark as classifying
    await supabase
      .from("inbox_items")
      .update({ status: "classifying" })
      .eq("id", inboxItemId);

    let contentForAI = "";
    let isVision = false;
    let imageUrl = "";

    // Prepare content based on file type
    if (item.file_type === "audio" && item.file_url) {
      // Transcribe audio first
      try {
        const transcription = await transcribeAudio(item.file_url);
        contentForAI = transcription;
        await supabase
          .from("inbox_items")
          .update({ raw_text: transcription })
          .eq("id", inboxItemId);
      } catch (e) {
        contentForAI = item.raw_text || "Audio non trascrivibile";
      }
    } else if (
      (item.file_type === "image" || item.file_type === "pdf") &&
      item.file_url
    ) {
      isVision = true;
      imageUrl = item.file_url;
      contentForAI = item.raw_text || "";
    } else {
      contentForAI = item.raw_text || "";
    }

    if (!contentForAI && !isVision) {
      await supabase
        .from("inbox_items")
        .update({
          status: "error",
          error_message: "Nessun contenuto da analizzare",
        })
        .eq("id", inboxItemId);

      return new Response(
        JSON.stringify({ error: "No content to analyze" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Build Claude message with multilingual support
    const systemPrompts: Record<string, string> = {
      it: `Sei un assistente per artigiani italiani. Analizzi documenti, foto e testi ricevuti e li classifichi.

Il tuo compito:
1. CLASSIFICA il contenuto in UNA di queste categorie:
   - "job": descrizione di un lavoro da fare (riparazione, installazione, sopralluogo, ecc.)
   - "invoice_passive": fattura ricevuta da un fornitore (fattura d'acquisto, ricevuta materiali)
   - "client_info": informazioni su un cliente (nome, indirizzo, telefono, contatto)
   - "receipt": scontrino, ricevuta di pagamento, nota spese
   - "other": qualsiasi cosa che non rientra nelle categorie sopra

2. ESTRAI dati strutturati rilevanti in base alla classificazione:
   - Per "job": { "title", "description", "materials", "urgency" }
   - Per "invoice_passive": { "supplier_name", "invoice_number", "total", "vat_amount", "subtotal", "category", "issue_date" }
   - Per "client_info": { "name", "phone", "email", "address" }
   - Per "receipt": { "supplier_name", "total", "date", "description" }
   - Per "other": { "description" }

3. SCRIVI un breve riepilogo (1-2 frasi) in italiano, come parleresti a un amico.

Rispondi SOLO con JSON valido nel formato:
{
  "classification": "job|invoice_passive|client_info|receipt|other",
  "confidence": 0.0-1.0,
  "extracted_data": { ... },
  "summary": "riepilogo breve"
}`,

      en: `You are an assistant for contractors and tradespeople. You analyze documents, photos, and texts and classify them.

Your task:
1. CLASSIFY the content into ONE of these categories:
   - "job": description of work to be done (repair, installation, inspection, etc.)
   - "invoice_passive": invoice received from a supplier (purchase invoice, materials receipt)
   - "client_info": information about a client (name, address, phone, contact)
   - "receipt": receipt, payment slip, expense note
   - "other": anything that doesn't fit the above categories

2. EXTRACT relevant structured data based on the classification:
   - For "job": { "title", "description", "materials", "urgency" }
   - For "invoice_passive": { "supplier_name", "invoice_number", "total", "vat_amount", "subtotal", "category", "issue_date" }
   - For "client_info": { "name", "phone", "email", "address" }
   - For "receipt": { "supplier_name", "total", "date", "description" }
   - For "other": { "description" }

3. WRITE a brief summary (1-2 sentences) in English, as you would speak to a friend.

Respond ONLY with valid JSON in this format:
{
  "classification": "job|invoice_passive|client_info|receipt|other",
  "confidence": 0.0-1.0,
  "extracted_data": { ... },
  "summary": "brief summary"
}`,

      es: `Eres un asistente para artesanos y profesionales. Analizas documentos, fotos y textos recibidos y los clasificas.

Tu tarea:
1. CLASIFICA el contenido en UNA de estas categorías:
   - "job": descripción de un trabajo a realizar (reparación, instalación, inspección, etc.)
   - "invoice_passive": factura recibida de un proveedor (factura de compra, recibo de materiales)
   - "client_info": información sobre un cliente (nombre, dirección, teléfono, contacto)
   - "receipt": recibo, comprobante de pago, nota de gastos
   - "other": cualquier cosa que no se ajuste a las categorías anteriores

2. EXTRAE datos estructurados relevantes según la clasificación:
   - Para "job": { "title", "description", "materials", "urgency" }
   - Para "invoice_passive": { "supplier_name", "invoice_number", "total", "vat_amount", "subtotal", "category", "issue_date" }
   - Para "client_info": { "name", "phone", "email", "address" }
   - Para "receipt": { "supplier_name", "total", "date", "description" }
   - Para "other": { "description" }

3. ESCRIBE un breve resumen (1-2 frases) en español, como hablarías con un amigo.

Responde SOLO con JSON válido en este formato:
{
  "classification": "job|invoice_passive|client_info|receipt|other",
  "confidence": 0.0-1.0,
  "extracted_data": { ... },
  "summary": "resumen breve"
}`,

      pt: `Você é um assistente para artesãos e profissionais. Você analisa documentos, fotos e textos recebidos e os classifica.

Sua tarefa:
1. CLASSIFIQUE o conteúdo em UMA destas categorias:
   - "job": descrição de um trabalho a ser feito (reparo, instalação, inspeção, etc.)
   - "invoice_passive": fatura recebida de um fornecedor (fatura de compra, recibo de materiais)
   - "client_info": informações sobre um cliente (nome, endereço, telefone, contato)
   - "receipt": recibo, comprovante de pagamento, nota de despesas
   - "other": qualquer coisa que não se encaixe nas categorias acima

2. EXTRAIA dados estruturados relevantes com base na classificação:
   - Para "job": { "title", "description", "materials", "urgency" }
   - Para "invoice_passive": { "supplier_name", "invoice_number", "total", "vat_amount", "subtotal", "category", "issue_date" }
   - Para "client_info": { "name", "phone", "email", "address" }
   - Para "receipt": { "supplier_name", "total", "date", "description" }
   - Para "other": { "description" }

3. ESCREVA um breve resumo (1-2 frases) em português, como você falaria com um amigo.

Responda APENAS com JSON válido neste formato:
{
  "classification": "job|invoice_passive|client_info|receipt|other",
  "confidence": 0.0-1.0,
  "extracted_data": { ... },
  "summary": "resumo breve"
}`
    };

    const systemPrompt = systemPrompts[locale as string] || systemPrompts.it;

    const prompts: Record<string, { additionalText: string; analyzeImage: string; analyzeContent: string }> = {
      it: {
        additionalText: "Testo aggiuntivo:",
        analyzeImage: "Analizza questa immagine e classifica il contenuto. Rispondi con il JSON richiesto.",
        analyzeContent: "Analizza questo contenuto e classifica:\n\n"
      },
      en: {
        additionalText: "Additional text:",
        analyzeImage: "Analyze this image and classify the content. Respond with the requested JSON.",
        analyzeContent: "Analyze this content and classify:\n\n"
      },
      es: {
        additionalText: "Texto adicional:",
        analyzeImage: "Analiza esta imagen y clasifica el contenido. Responde con el JSON solicitado.",
        analyzeContent: "Analiza este contenido y clasifica:\n\n"
      },
      pt: {
        additionalText: "Texto adicional:",
        analyzeImage: "Analise esta imagem e classifique o conteúdo. Responda com o JSON solicitado.",
        analyzeContent: "Analise este conteúdo e classifique:\n\n"
      }
    };

    const userPrompts = prompts[locale as string] || prompts.it;

    const userContent: Array<Record<string, unknown>> = [];

    if (isVision && imageUrl) {
      userContent.push({
        type: "image",
        source: {
          type: "url",
          url: imageUrl,
        },
      });
      if (contentForAI) {
        userContent.push({
          type: "text",
          text: `${userPrompts.additionalText} ${contentForAI}`,
        });
      }
      userContent.push({
        type: "text",
        text: userPrompts.analyzeImage,
      });
    } else {
      userContent.push({
        type: "text",
        text: `${userPrompts.analyzeContent}${contentForAI}`,
      });
    }

    if (item.source === "email") {
      const emailContext = [];
      if (item.source_email_from) emailContext.push(`Da: ${item.source_email_from}`);
      if (item.source_email_subject) emailContext.push(`Oggetto: ${item.source_email_subject}`);
      if (emailContext.length > 0) {
        userContent.push({
          type: "text",
          text: `Contesto email:\n${emailContext.join("\n")}`,
        });
      }
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      await supabase
        .from("inbox_items")
        .update({
          status: "error",
          error_message: `AI error: ${aiResponse.status}`,
        })
        .eq("id", inboxItemId);

      return new Response(
        JSON.stringify({ error: `AI call failed: ${errText}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text || "";

    // Parse AI response
    let parsed;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      await supabase
        .from("inbox_items")
        .update({
          status: "error",
          error_message: "Failed to parse AI response",
          ai_summary: rawText,
        })
        .eq("id", inboxItemId);

      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: rawText }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Update inbox item with classification
    const { error: updateErr } = await supabase
      .from("inbox_items")
      .update({
        classification: parsed.classification || "other",
        confidence: parsed.confidence || 0,
        ai_extracted_data: parsed.extracted_data || {},
        ai_summary: parsed.summary || "",
        status: "classified",
        classified_at: new Date().toISOString(),
      })
      .eq("id", inboxItemId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: `DB update failed: ${updateErr.message}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    return new Response(
      JSON.stringify({
        classification: parsed.classification,
        confidence: parsed.confidence,
        extracted_data: parsed.extracted_data,
        summary: parsed.summary,
      }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
