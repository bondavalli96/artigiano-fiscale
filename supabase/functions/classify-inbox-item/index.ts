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

    const { inboxItemId } = body;

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

    // Build Claude message
    const systemPrompt = `Sei un assistente per artigiani italiani. Analizzi documenti, foto e testi ricevuti e li classifichi.

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
}`;

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
          text: `Testo aggiuntivo: ${contentForAI}`,
        });
      }
      userContent.push({
        type: "text",
        text: "Analizza questa immagine e classifica il contenuto. Rispondi con il JSON richiesto.",
      });
    } else {
      userContent.push({
        type: "text",
        text: `Analizza questo contenuto e classifica:\n\n${contentForAI}`,
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
