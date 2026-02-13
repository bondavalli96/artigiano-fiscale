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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { artisanId, email, businessName, country = "IT" } = await req.json();

    if (!artisanId || !email) {
      return new Response(
        JSON.stringify({ error: "artisanId and email are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if artisan already has Stripe account
    const { data: artisan, error: fetchErr } = await supabase
      .from("artisans")
      .select("stripe_account_id")
      .eq("id", artisanId)
      .single();

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: "Artisan not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // If already has account, generate new onboarding link
    if (artisan.stripe_account_id) {
      const accountLink = await stripe.accountLinks.create({
        account: artisan.stripe_account_id,
        refresh_url: "artigianoai://settings/billing?refresh=true",
        return_url: "artigianoai://settings/billing?success=true",
        type: "account_onboarding",
      });

      return new Response(
        JSON.stringify({
          accountId: artisan.stripe_account_id,
          onboardingUrl: accountLink.url,
          existing: true,
        }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Create new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      country,
      email,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: businessName || "",
        product_description: "Professional contractor services",
      },
    });

    // Save account ID to database
    const { error: updateErr } = await supabase
      .from("artisans")
      .update({ stripe_account_id: account.id })
      .eq("id", artisanId);

    if (updateErr) {
      // Rollback: delete Stripe account
      await stripe.accounts.del(account.id);
      return new Response(
        JSON.stringify({ error: "Failed to save Stripe account" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "artigianoai://settings/billing?refresh=true",
      return_url: "artigianoai://settings/billing?success=true",
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        accountId: account.id,
        onboardingUrl: accountLink.url,
        existing: false,
      }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    console.error("Stripe account creation error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
