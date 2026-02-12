import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const defaultArtisanId = Deno.env.get("WHATSAPP_DEFAULT_ARTISAN_ID");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseWebhookPayload(req: Request, rawBody: string) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payload: Record<string, string> = {};
    for (const [key, value] of params.entries()) payload[key] = value;
    return payload;
  }

  try {
    return JSON.parse(rawBody) as Record<string, string>;
  } catch {
    return {};
  }
}

function inferFileType(contentType: string) {
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("audio/")) return "audio";
  return "document";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const rawBody = await req.text();
    const payload = parseWebhookPayload(req, rawBody);

    const artisanIdFromBody =
      payload.artisanId || payload.artisan_id || undefined;
    const artisanId =
      artisanIdFromBody || defaultArtisanId || new URL(req.url).searchParams.get("artisanId");

    if (!artisanId) {
      return new Response(
        JSON.stringify({
          error:
            "artisanId missing. Provide artisanId in payload/query or set WHATSAPP_DEFAULT_ARTISAN_ID.",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const from = payload.From || payload.from || "";
    const bodyText = payload.Body || payload.body || "";
    const numMedia = Number(payload.NumMedia || payload.numMedia || 0);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: artisan } = await supabase
      .from("artisans")
      .select("id, expo_push_token")
      .eq("id", artisanId)
      .maybeSingle();

    if (!artisan) {
      return new Response(
        JSON.stringify({ error: "Artisan not found for provided artisanId" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const createdItems: string[] = [];

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = payload[`MediaUrl${i}`];
      const mediaType = payload[`MediaContentType${i}`] || "application/octet-stream";
      if (!mediaUrl) continue;

      const mediaRes = await fetch(mediaUrl, {
        headers:
          twilioAccountSid && twilioAuthToken
            ? {
                Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              }
            : {},
      });

      if (!mediaRes.ok) continue;
      const mediaBlob = await mediaRes.blob();
      const ext = mediaType.split("/")[1] || "bin";
      const filePath = `${artisan.id}/wa_${Date.now()}_${i}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("inbox")
        .upload(filePath, mediaBlob, {
          contentType: mediaType,
          upsert: false,
        });
      if (uploadErr) continue;

      const {
        data: { publicUrl },
      } = supabase.storage.from("inbox").getPublicUrl(filePath);

      const { data: item } = await supabase
        .from("inbox_items")
        .insert({
          artisan_id: artisan.id,
          source: "whatsapp",
          source_email_from: from || null,
          file_url: publicUrl,
          file_type: inferFileType(mediaType),
          file_name: `whatsapp_${Date.now()}.${ext}`,
          raw_text: bodyText || null,
          status: "new",
        })
        .select("id")
        .single();

      if (item?.id) {
        createdItems.push(item.id);
        await supabase.functions.invoke("classify-inbox-item", {
          body: { inboxItemId: item.id },
        });
      }
    }

    if (createdItems.length === 0 && bodyText) {
      const { data: item } = await supabase
        .from("inbox_items")
        .insert({
          artisan_id: artisan.id,
          source: "whatsapp",
          source_email_from: from || null,
          file_type: "text",
          raw_text: bodyText,
          status: "new",
        })
        .select("id")
        .single();

      if (item?.id) {
        createdItems.push(item.id);
        await supabase.functions.invoke("classify-inbox-item", {
          body: { inboxItemId: item.id },
        });
      }
    }

    if (artisan.expo_push_token && createdItems.length > 0) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: artisan.expo_push_token,
          title: "Nuovo messaggio WhatsApp",
          body: bodyText || "Nuovo media ricevuto su WhatsApp",
          data: { type: "inbox", itemId: createdItems[0] },
        }),
      });
    }

    return new Response(
      JSON.stringify({ created: createdItems.length, items: createdItems }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});

