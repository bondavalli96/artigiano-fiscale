import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface QuoteItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface PdfRequest {
  type: "quote" | "invoice";
  number: string;
  artisan: {
    business_name: string;
    vat_number?: string;
    fiscal_code?: string;
    address?: string;
    phone?: string;
    email?: string;
    sdi_code?: string;
  };
  client?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  items: QuoteItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes?: string;
  valid_until?: string;
  payment_due?: string;
  date: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function generateHtml(data: PdfRequest): string {
  const title = data.type === "quote" ? "PREVENTIVO" : "FATTURA";
  const numberLabel = data.type === "quote" ? "Preventivo N." : "Fattura N.";

  const itemsRows = data.items
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td class="center">${item.quantity}</td>
      <td class="center">${escapeHtml(item.unit)}</td>
      <td class="right">${formatCurrency(item.unit_price)}</td>
      <td class="right">${formatCurrency(item.total)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .header-left h1 { font-size: 24px; color: #2563eb; margin: 0; }
  .header-right { text-align: right; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .info-box { padding: 12px; background: #f8fafc; border-radius: 8px; width: 48%; }
  .info-box h3 { margin: 0 0 6px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .info-box p { margin: 2px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #2563eb; color: white; padding: 10px 8px; text-align: left; font-size: 11px; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .totals { margin-top: 20px; width: 300px; margin-left: auto; }
  .totals tr td { border: none; padding: 4px 8px; }
  .totals .grand-total td { font-size: 16px; font-weight: bold; border-top: 2px solid #2563eb; padding-top: 8px; }
  .notes { margin-top: 30px; padding: 12px; background: #fffbeb; border-radius: 8px; }
  .notes h3 { margin: 0 0 4px 0; font-size: 11px; color: #92400e; }
  .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${title}</h1>
      <p style="color:#6b7280;">${numberLabel} ${escapeHtml(data.number)}</p>
      <p style="color:#6b7280;">Data: ${escapeHtml(data.date)}</p>
    </div>
  </div>

  <div class="info-row">
    <div class="info-box">
      <h3>Da</h3>
      <p><strong>${escapeHtml(data.artisan.business_name)}</strong></p>
      ${data.artisan.vat_number ? `<p>P.IVA: ${escapeHtml(data.artisan.vat_number)}</p>` : ""}
      ${data.artisan.fiscal_code ? `<p>C.F.: ${escapeHtml(data.artisan.fiscal_code)}</p>` : ""}
      ${data.artisan.address ? `<p>${escapeHtml(data.artisan.address)}</p>` : ""}
      ${data.artisan.phone ? `<p>Tel: ${escapeHtml(data.artisan.phone)}</p>` : ""}
      ${data.artisan.email ? `<p>${escapeHtml(data.artisan.email)}</p>` : ""}
    </div>
    ${
      data.client
        ? `<div class="info-box">
      <h3>A</h3>
      <p><strong>${escapeHtml(data.client.name)}</strong></p>
      ${data.client.address ? `<p>${escapeHtml(data.client.address)}</p>` : ""}
      ${data.client.phone ? `<p>Tel: ${escapeHtml(data.client.phone)}</p>` : ""}
      ${data.client.email ? `<p>${escapeHtml(data.client.email)}</p>` : ""}
    </div>`
        : ""
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>Descrizione</th>
        <th class="center">Qtà</th>
        <th class="center">Unità</th>
        <th class="right">Prezzo Unit.</th>
        <th class="right">Totale</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td>Imponibile:</td>
      <td class="right">${formatCurrency(data.subtotal)}</td>
    </tr>
    <tr>
      <td>IVA (${data.vat_rate}%):</td>
      <td class="right">${formatCurrency(data.vat_amount)}</td>
    </tr>
    <tr class="grand-total">
      <td>TOTALE:</td>
      <td class="right">${formatCurrency(data.total)}</td>
    </tr>
  </table>

  ${data.valid_until ? `<p style="margin-top:16px;color:#6b7280;">Validità: fino al ${escapeHtml(data.valid_until)}</p>` : ""}
  ${data.payment_due ? `<p style="margin-top:8px;color:#6b7280;">Scadenza pagamento: ${escapeHtml(data.payment_due)}</p>` : ""}

  ${data.notes ? `<div class="notes"><h3>Note</h3><p>${escapeHtml(data.notes)}</p></div>` : ""}

  <div class="footer">
    <p>Documento generato con ArtigianoAI</p>
  </div>
</body>
</html>`;
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
    const data: PdfRequest = await req.json();

    if (!data.items || !data.number) {
      return new Response(
        JSON.stringify({ error: "items and number are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate HTML
    const html = generateHtml(data);

    // Store the HTML as a file on Supabase Storage for now
    // In production, you'd use a PDF rendering service
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileName = `${data.type}_${data.number.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.html`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, html, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ pdfUrl: urlData.publicUrl, html }),
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
