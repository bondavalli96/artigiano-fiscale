import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

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
    const audioBlob = await audioResponse.blob();

    // Send to Whisper API
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.m4a");
    formData.append("model", "whisper-1");
    formData.append("language", "it");

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    const result = await whisperResponse.json();

    return new Response(
      JSON.stringify({ transcription: result.text }),
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
