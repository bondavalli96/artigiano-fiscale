import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");

function getAudioMeta(audioUrl: string) {
  const ext = audioUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "m4a";
  const mimeMap: Record<string, string> = {
    ogg: "audio/ogg",
    m4a: "audio/m4a",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
    mp4: "audio/mp4",
    aac: "audio/aac",
  };
  return { ext, mime: mimeMap[ext] || "audio/m4a" };
}

async function transcribeWithGroq(file: File): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY missing");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "it");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || `Groq failed (${response.status})`);
  }

  return result.text || "";
}

async function transcribeWithDeepgram(audioBlob: Blob, mime: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY missing");
  }

  const response = await fetch(
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

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.err_msg || `Deepgram failed (${response.status})`);
  }

  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

async function transcribeWithOpenAI(file: File): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");
  formData.append("language", "it");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || `OpenAI failed (${response.status})`);
  }

  return result.text || "";
}

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
    const { audioUrl } = await req.json();

    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "audioUrl is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Download audio from Supabase Storage
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download audio: ${audioResponse.status}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const audioBlob = await audioResponse.blob();

    const { ext, mime } = getAudioMeta(audioUrl);
    const file = new File([audioBlob], `audio.${ext}`, { type: mime });

    // Provider priority:
    // 1) Groq (free tier friendly)
    // 2) Deepgram
    // 3) OpenAI Whisper fallback
    let transcription = "";
    let lastError = "No transcription provider configured";

    const providers: Array<{ name: string; run: () => Promise<string> }> = [
      { name: "groq", run: () => transcribeWithGroq(file) },
      { name: "deepgram", run: () => transcribeWithDeepgram(audioBlob, mime) },
      { name: "openai", run: () => transcribeWithOpenAI(file) },
    ];

    for (const provider of providers) {
      try {
        transcription = await provider.run();
        if (transcription) break;
      } catch (error) {
        lastError = `${provider.name}: ${(error as Error).message}`;
      }
    }

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: `Transcription failed. ${lastError}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ transcription }),
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
