import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { artisanId, invoiceTotal, clientId } = await req.json();

    if (!artisanId) {
      return new Response(
        JSON.stringify({ error: "artisanId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const warnings: string[] = [];

    // Check: invoice amount vs average
    const { data: avgData } = await supabase
      .from("invoices_active")
      .select("total")
      .eq("artisan_id", artisanId);

    if (avgData && avgData.length > 2 && invoiceTotal) {
      const avg =
        avgData.reduce((sum: number, inv: { total: number }) => sum + inv.total, 0) /
        avgData.length;
      if (invoiceTotal > avg * 3) {
        warnings.push(
          `Importo (€${invoiceTotal.toFixed(2)}) molto superiore alla media (€${avg.toFixed(2)})`
        );
      }
      if (invoiceTotal < avg * 0.2) {
        warnings.push(
          `Importo (€${invoiceTotal.toFixed(2)}) molto inferiore alla media (€${avg.toFixed(2)})`
        );
      }
    }

    // Check: client payment history
    if (clientId) {
      const { data: clientInvoices } = await supabase
        .from("invoices_active")
        .select("status, payment_due, paid_at")
        .eq("client_id", clientId)
        .eq("status", "overdue");

      if (clientInvoices && clientInvoices.length > 0) {
        warnings.push(
          `Questo cliente ha ${clientInvoices.length} fattur${clientInvoices.length === 1 ? "a" : "e"} scadut${clientInvoices.length === 1 ? "a" : "e"}`
        );
      }
    }

    return new Response(JSON.stringify({ warnings }), {
      headers: { "Content-Type": "application/json" },
    });
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
