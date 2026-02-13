import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price IDs (create these in Stripe Dashboard first)
const PRICE_IDS: Record<string, string> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER") || "price_starter",
  pro: Deno.env.get("STRIPE_PRICE_PRO") || "price_pro",
  business: Deno.env.get("STRIPE_PRICE_BUSINESS") || "price_business",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { artisanId, plan, email } = await req.json();

    if (!artisanId || !plan) {
      return new Response(
        JSON.stringify({ error: "artisanId and plan are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (!["starter", "pro", "business"].includes(plan)) {
      return new Response(
        JSON.stringify({ error: "Invalid plan. Must be: starter, pro, or business" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch artisan
    const { data: artisan, error: fetchErr } = await supabase
      .from("artisans")
      .select("stripe_customer_id, email")
      .eq("id", artisanId)
      .single();

    if (fetchErr || !artisan) {
      return new Response(
        JSON.stringify({ error: "Artisan not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    let customerId = artisan.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || artisan.email,
        metadata: {
          artisan_id: artisanId,
        },
      });

      customerId = customer.id;

      // Save customer ID
      await supabase
        .from("artisans")
        .update({ stripe_customer_id: customerId })
        .eq("id", artisanId);
    }

    // Create Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      success_url: `artigianoai://settings/billing?success=true&plan=${plan}`,
      cancel_url: "artigianoai://settings/billing?canceled=true",
      metadata: {
        artisan_id: artisanId,
        plan,
      },
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        checkoutUrl: session.url,
        customerId,
      }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    console.error("Subscription creation error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
