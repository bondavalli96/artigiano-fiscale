import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        if (invoiceId) {
          // Mark invoice as paid
          await supabase
            .from("invoices_active")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq("id", invoiceId);

          console.log(`Invoice ${invoiceId} marked as paid`);

          // Get artisan for push notification
          const { data: invoice } = await supabase
            .from("invoices_active")
            .select("artisan_id, invoice_number, artisan:artisans!invoices_active_artisan_id_fkey(expo_push_token)")
            .eq("id", invoiceId)
            .single();

          if (invoice?.artisan?.expo_push_token) {
            // Send push notification
            await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                pushToken: invoice.artisan.expo_push_token,
                title: "Pagamento ricevuto! 💰",
                body: `La fattura ${invoice.invoice_number} è stata pagata`,
                data: { invoiceId, screen: "invoices/active" },
              }),
            });
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        if (invoiceId) {
          console.log(`Payment failed for invoice ${invoiceId}`);
          // Could add notification here
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const artisanId = subscription.metadata?.artisan_id;
        const plan = subscription.metadata?.plan || "starter";

        if (artisanId) {
          await supabase
            .from("artisans")
            .update({
              subscription_plan: plan,
              subscription_status: subscription.status,
            })
            .eq("id", artisanId);

          console.log(`Subscription updated for artisan ${artisanId}: ${plan} (${subscription.status})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const artisanId = subscription.metadata?.artisan_id;

        if (artisanId) {
          // Downgrade to starter (free)
          await supabase
            .from("artisans")
            .update({
              subscription_plan: "starter",
              subscription_status: "canceled",
            })
            .eq("id", artisanId);

          console.log(`Subscription canceled for artisan ${artisanId}`);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        // Check if account is fully onboarded
        if (account.details_submitted && account.charges_enabled) {
          console.log(`Stripe account ${account.id} fully onboarded`);
          // Could send notification to artisan
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
