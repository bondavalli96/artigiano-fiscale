import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Alert {
  type: "forfettario_threshold" | "sdi_pending" | "overdue" | "stamp_missing";
  severity: "warning" | "critical";
  message: string;
  artisanId: string;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const artisanId = body?.artisanId;

    // If artisanId provided, check only that artisan; otherwise check all
    let artisanIds: string[] = [];

    if (artisanId) {
      artisanIds = [artisanId];
    } else {
      const { data: artisans } = await supabase
        .from("artisans")
        .select("id")
        .eq("country_code", "IT");

      artisanIds = (artisans || []).map((a) => a.id);
    }

    const allAlerts: Alert[] = [];

    for (const id of artisanIds) {
      const alerts = await checkArtisanAlerts(supabase, id);
      allAlerts.push(...alerts);

      // Send push notifications for critical alerts
      for (const alert of alerts) {
        if (alert.severity === "critical") {
          const { data: artisan } = await supabase
            .from("artisans")
            .select("expo_push_token")
            .eq("id", id)
            .single();

          if (artisan?.expo_push_token) {
            await supabase.functions.invoke("send-push-notification", {
              body: {
                pushToken: artisan.expo_push_token,
                title: "Avviso Fiscale",
                body: alert.message,
              },
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        checked: artisanIds.length,
        alerts: allAlerts,
      }),
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

async function checkArtisanAlerts(
  supabase: ReturnType<typeof createClient>,
  artisanId: string
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // 1. Forfettario threshold checks
  const { data: profile } = await supabase
    .from("fiscal_profiles")
    .select("regime")
    .eq("artisan_id", artisanId)
    .single();

  if (profile?.regime === "forfettario") {
    const currentYear = new Date().getFullYear();
    const { data: tracking } = await supabase
      .from("fiscal_year_tracking")
      .select("total_revenue")
      .eq("artisan_id", artisanId)
      .eq("year", currentYear)
      .single();

    const revenue = tracking?.total_revenue || 0;

    if (revenue >= 85000) {
      alerts.push({
        type: "forfettario_threshold",
        severity: "critical",
        message:
          "Hai superato la soglia di 85.000 EUR per il regime forfettario! Contatta il tuo commercialista.",
        artisanId,
      });
    } else if (revenue >= 80000) {
      alerts.push({
        type: "forfettario_threshold",
        severity: "critical",
        message: `Attenzione: il tuo fatturato (${revenue.toFixed(0)} EUR) si avvicina alla soglia di 85.000 EUR.`,
        artisanId,
      });
    } else if (revenue >= 70000) {
      alerts.push({
        type: "forfettario_threshold",
        severity: "warning",
        message: `Il tuo fatturato ha superato i 70.000 EUR. Tieni sotto controllo la soglia forfettario.`,
        artisanId,
      });
    }
  }

  // 2. Invoices not sent to SdI for more than 12 days
  const twelveAgo = new Date();
  twelveAgo.setDate(twelveAgo.getDate() - 12);

  const { data: unsentInvoices } = await supabase
    .from("invoices_active")
    .select("id, invoice_number")
    .eq("artisan_id", artisanId)
    .in("sdi_status", ["not_sent"])
    .in("status", ["sent", "paid"])
    .lt("created_at", twelveAgo.toISOString());

  if (unsentInvoices && unsentInvoices.length > 0) {
    alerts.push({
      type: "sdi_pending",
      severity: "warning",
      message: `Hai ${unsentInvoices.length} fattur${unsentInvoices.length === 1 ? "a" : "e"} non inviat${unsentInvoices.length === 1 ? "a" : "e"} allo SdI da piu di 12 giorni.`,
      artisanId,
    });
  }

  // 3. Overdue invoices
  const { data: overdueInvoices } = await supabase
    .from("invoices_active")
    .select("id")
    .eq("artisan_id", artisanId)
    .eq("status", "overdue");

  if (overdueInvoices && overdueInvoices.length > 0) {
    alerts.push({
      type: "overdue",
      severity: "warning",
      message: `Hai ${overdueInvoices.length} fattur${overdueInvoices.length === 1 ? "a" : "e"} scadut${overdueInvoices.length === 1 ? "a" : "e"} non incassat${overdueInvoices.length === 1 ? "a" : "e"}.`,
      artisanId,
    });
  }

  // 4. Missing digital stamp on forfettario invoices > 77.47
  if (profile?.regime === "forfettario") {
    const { data: missingStamp } = await supabase
      .from("invoices_active")
      .select("id, invoice_number")
      .eq("artisan_id", artisanId)
      .eq("digital_stamp", false)
      .gt("total", 77.47)
      .in("status", ["sent", "paid"]);

    if (missingStamp && missingStamp.length > 0) {
      alerts.push({
        type: "stamp_missing",
        severity: "warning",
        message: `${missingStamp.length} fattur${missingStamp.length === 1 ? "a" : "e"} senza marca da bollo (obbligatoria per importi > 77,47 EUR).`,
        artisanId,
      });
    }
  }

  return alerts;
}
