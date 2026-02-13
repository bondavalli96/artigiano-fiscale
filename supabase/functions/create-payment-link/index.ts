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
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "invoiceId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice with artisan data
    const { data: invoice, error: invoiceErr } = await supabase
      .from("invoices_active")
      .select(`
        *,
        artisan:artisans!invoices_active_artisan_id_fkey(stripe_account_id, business_name),
        client:clients!invoices_active_client_id_fkey(name, email)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceErr || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Check if artisan has Stripe account
    if (!invoice.artisan.stripe_account_id) {
      return new Response(
        JSON.stringify({
          error: "Artisan must connect Stripe account first",
          requiresOnboarding: true
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Check if payment link already exists
    if (invoice.stripe_payment_link) {
      return new Response(
        JSON.stringify({
          paymentLink: invoice.stripe_payment_link,
          existing: true,
        }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Create Stripe Payment Link
    const totalInCents = Math.round(invoice.total * 100);
    const appFeeInCents = Math.round(totalInCents * 0.029); // 2.9% platform fee

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${invoice.invoice_number} - ${invoice.artisan.business_name}`,
              description: `Invoice for ${invoice.client?.name || "Client"}`,
            },
            unit_amount: totalInCents,
          },
          quantity: 1,
        },
      ],
      application_fee_amount: appFeeInCents,
      on_behalf_of: invoice.artisan.stripe_account_id,
      transfer_data: {
        destination: invoice.artisan.stripe_account_id,
      },
      metadata: {
        invoice_id: invoiceId,
        artisan_id: invoice.artisan_id,
      },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `artigianoai://invoices/active/${invoiceId}?paid=true`,
        },
      },
    });

    // Save payment link to database
    const { error: updateErr } = await supabase
      .from("invoices_active")
      .update({ stripe_payment_link: paymentLink.url })
      .eq("id", invoiceId);

    if (updateErr) {
      console.error("Failed to save payment link:", updateErr);
    }

    return new Response(
      JSON.stringify({
        paymentLink: paymentLink.url,
        existing: false,
      }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    console.error("Payment link creation error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
