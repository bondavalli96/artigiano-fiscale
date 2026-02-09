import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  total: number;
  payment_due: string;
  reminders_sent: number;
  client: { name: string; email: string | null } | null;
  artisan: { business_name: string; email: string | null; phone: string | null } | null;
}

async function generateReminderText(
  invoice: OverdueInvoice,
  artisanName: string
): Promise<string> {
  const daysOverdue = Math.floor(
    (Date.now() - new Date(invoice.payment_due).getTime()) / (1000 * 60 * 60 * 24)
  );
  const reminderCount = invoice.reminders_sent || 0;

  let tone = "gentile e amichevole";
  if (reminderCount >= 3) {
    tone = "fermo ma professionale, ultimo avviso";
  } else if (reminderCount >= 1) {
    tone = "professionale e diretto";
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Scrivi un breve testo di sollecito pagamento per un artigiano italiano.

Dati:
- Artigiano: ${artisanName}
- Fattura: ${invoice.invoice_number}
- Importo: €${invoice.total.toFixed(2)}
- Scaduta da: ${daysOverdue} giorni
- Numero sollecito: ${reminderCount + 1}
- Tono richiesto: ${tone}

Scrivi SOLO il corpo del messaggio (no oggetto, no "Gentile..."). Max 4 frasi.
Usa il "Lei" formale. In italiano.`,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.content[0].text;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  from: string
): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: from || "ArtigianoAI <noreply@artigianoai.com>",
        to: [to],
        subject,
        text: body,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
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
    const body = await req.json().catch(() => ({}));
    const { artisanId, invoiceId } = body as {
      artisanId?: string;
      invoiceId?: string;
    };

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query for overdue invoices
    let query = supabase
      .from("invoices_active")
      .select("*, client:clients(*), artisan:artisans(*)")
      .in("status", ["sent", "overdue"])
      .lt("payment_due", new Date().toISOString().split("T")[0]);

    if (artisanId) {
      query = query.eq("artisan_id", artisanId);
    }
    if (invoiceId) {
      query = query.eq("id", invoiceId);
    }

    const { data: overdueInvoices, error: queryError } = await query;
    if (queryError) throw queryError;

    const results: {
      invoiceId: string;
      invoiceNumber: string;
      emailSent: boolean;
      reminderText: string;
    }[] = [];

    for (const invoice of overdueInvoices || []) {
      const artisanName =
        invoice.artisan?.business_name || "Artigiano";

      // Generate AI reminder text
      const reminderText = await generateReminderText(
        invoice as OverdueInvoice,
        artisanName
      );

      // Send email if client has email
      let emailSent = false;
      if (invoice.client?.email) {
        emailSent = await sendEmail(
          invoice.client.email,
          `Sollecito pagamento fattura ${invoice.invoice_number}`,
          reminderText,
          invoice.artisan?.email || ""
        );
      }

      // Update invoice
      await supabase
        .from("invoices_active")
        .update({
          status: "overdue",
          reminders_sent: (invoice.reminders_sent || 0) + 1,
          last_reminder_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        emailSent,
        reminderText,
      });
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
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
