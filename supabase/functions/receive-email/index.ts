import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Resend inbound webhook payload
    const from = (body.from as string) || "";
    const to = (body.to as string) || "";
    const subject = (body.subject as string) || "";
    const text = (body.text as string) || "";
    const html = (body.html as string) || "";
    const attachments = (body.attachments as Array<{
      filename: string;
      content: string;
      content_type: string;
    }>) || [];

    if (!to) {
      return new Response(
        JSON.stringify({ error: "No recipient address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find artisan by inbox_email
    // The "to" field might contain display name, extract just the email
    const emailMatch = to.match(/[\w.-]+@[\w.-]+/);
    const recipientEmail = emailMatch ? emailMatch[0].toLowerCase() : to.toLowerCase();

    const { data: artisan, error: artisanErr } = await supabase
      .from("artisans")
      .select("id, expo_push_token")
      .eq("inbox_email", recipientEmail)
      .maybeSingle();

    if (!artisan) {
      return new Response(
        JSON.stringify({ error: "No artisan found for this email address" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const createdItems: string[] = [];

    // Process attachments
    if (attachments.length > 0) {
      for (const att of attachments) {
        // Decode base64 attachment
        const binaryStr = atob(att.content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Determine file type
        let fileType = "document";
        const ct = att.content_type.toLowerCase();
        if (ct.startsWith("image/")) fileType = "image";
        else if (ct === "application/pdf") fileType = "pdf";
        else if (ct.startsWith("audio/")) fileType = "audio";

        // Upload to storage
        const filePath = `${artisan.id}/${Date.now()}_${att.filename}`;
        const { error: uploadErr } = await supabase.storage
          .from("inbox")
          .upload(filePath, bytes, {
            contentType: att.content_type,
            upsert: false,
          });

        if (uploadErr) {
          console.error(`Upload failed for ${att.filename}:`, uploadErr);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("inbox").getPublicUrl(filePath);

        // Create inbox item
        const { data: newItem } = await supabase
          .from("inbox_items")
          .insert({
            artisan_id: artisan.id,
            source: "email",
            source_email_from: from,
            source_email_subject: subject,
            file_url: publicUrl,
            file_type: fileType,
            file_name: att.filename,
            raw_text: text || null,
            status: "new",
          })
          .select("id")
          .single();

        if (newItem) {
          createdItems.push(newItem.id);

          // Trigger classification
          try {
            await supabase.functions.invoke("classify-inbox-item", {
              body: { inboxItemId: newItem.id },
            });
          } catch {
            // Classification will be retried by the user
          }
        }
      }
    }

    // If no attachments but has text, create a text inbox item
    if (attachments.length === 0 && (text || html)) {
      const { data: newItem } = await supabase
        .from("inbox_items")
        .insert({
          artisan_id: artisan.id,
          source: "email",
          source_email_from: from,
          source_email_subject: subject,
          file_type: "text",
          raw_text: text || html,
          status: "new",
        })
        .select("id")
        .single();

      if (newItem) {
        createdItems.push(newItem.id);

        try {
          await supabase.functions.invoke("classify-inbox-item", {
            body: { inboxItemId: newItem.id },
          });
        } catch {
          // Classification will be retried by the user
        }
      }
    }

    // Send push notification if token exists
    if (artisan.expo_push_token && createdItems.length > 0) {
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: artisan.expo_push_token,
            title: "Nuovo nella Inbox",
            body: subject
              ? `Email da ${from}: ${subject}`
              : `Nuovo contenuto da ${from}`,
            data: { type: "inbox", itemId: createdItems[0] },
          }),
        });
      } catch {
        // Push notification is best-effort
      }
    }

    return new Response(
      JSON.stringify({
        created: createdItems.length,
        items: createdItems,
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
