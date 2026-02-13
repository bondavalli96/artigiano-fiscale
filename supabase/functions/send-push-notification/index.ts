import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushMessage {
  to: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const {
      pushToken,
      title,
      body,
      data = {},
      sound = 'default',
      badge,
    } = await req.json();

    if (!pushToken) {
      return new Response(
        JSON.stringify({ error: "pushToken is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Validate Expo Push Token format
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      return new Response(
        JSON.stringify({ error: "Invalid Expo push token format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const message: PushMessage = {
      to: pushToken,
      sound,
      title,
      body,
      data,
    };

    if (badge !== undefined) {
      message.badge = badge;
    }

    // Send to Expo Push Notification service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Expo push failed: ${error}`);
    }

    const result = await response.json();

    // Check for errors in response
    if (result.data && result.data[0]?.status === 'error') {
      throw new Error(result.data[0].message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket: result.data?.[0],
      }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
