import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface QuoteItem {
  description: string;
  quantity?: number;
  unit?: string;
  unit_price: number;
  total: number;
  article_code?: string;
  discount?: number;
  vat_rate?: number;
}

interface InvoiceFieldVisibility {
  quantity?: boolean;
  unit?: boolean;
  article_code?: boolean;
  discount?: boolean;
  vat_column?: boolean;
  due_date?: boolean;
  payment_method?: boolean;
  notes?: boolean;
  signature?: boolean;
}

interface PaymentMethodsConfig {
  bank_transfer?: boolean;
  card?: boolean;
  stripe_link?: boolean;
  other?: boolean;
}

interface PdfRequest {
  type: "quote" | "invoice";
  number: string;
  artisan: {
    business_name: string;
    company_registration_number?: string;
    vat_number?: string;
    fiscal_code?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    sdi_code?: string;
    logo_url?: string;
    signature_url?: string;
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
  template_key?: "classic" | "modern" | "compact" | "bold" | "minimal" | string;
  template_file_url?: string;
  field_visibility?: InvoiceFieldVisibility;
  payment_methods?: PaymentMethodsConfig;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function templatePalette(template: string) {
  switch (template) {
    case "modern":
      return { accent: "#0f766e", surface: "#ecfeff", border: "#99f6e4" };
    case "compact":
      return { accent: "#334155", surface: "#f1f5f9", border: "#cbd5e1" };
    case "bold":
      return { accent: "#b91c1c", surface: "#fef2f2", border: "#fecaca" };
    case "minimal":
      return { accent: "#4b5563", surface: "#f9fafb", border: "#e5e7eb" };
    default:
      return { accent: "#2563eb", surface: "#eff6ff", border: "#bfdbfe" };
  }
}

function paymentMethodsLabel(methods?: PaymentMethodsConfig): string | null {
  if (!methods) return null;

  const labels: string[] = [];
  if (methods.bank_transfer) labels.push("Bonifico");
  if (methods.card) labels.push("Carta");
  if (methods.stripe_link) labels.push("Link Stripe");
  if (methods.other) labels.push("Altro");

  return labels.length > 0 ? labels.join(", ") : null;
}

function generateHtml(data: PdfRequest): string {
  const title = data.type === "quote" ? "PREVENTIVO" : "FATTURA";
  const numberLabel = data.type === "quote" ? "Preventivo N." : "Fattura N.";
  const palette = templatePalette(data.template_key || "classic");

  const visibility: Required<InvoiceFieldVisibility> = {
    quantity: true,
    unit: true,
    article_code: false,
    discount: false,
    vat_column: true,
    due_date: true,
    payment_method: true,
    notes: true,
    signature: true,
    ...(data.field_visibility || {}),
  };

  const paymentMethods = paymentMethodsLabel(data.payment_methods);

  const headers: string[] = ["<th>Descrizione</th>"];
  if (visibility.article_code) headers.push('<th class="center">Codice</th>');
  if (visibility.quantity) headers.push('<th class="center">Qtà</th>');
  if (visibility.unit) headers.push('<th class="center">Unità</th>');
  headers.push('<th class="right">Prezzo Unit.</th>');
  if (visibility.discount) headers.push('<th class="right">Sconto</th>');
  if (visibility.vat_column) headers.push('<th class="right">IVA</th>');
  headers.push('<th class="right">Totale</th>');

  const itemsRows = data.items
    .map((item) => {
      const cells: string[] = [
        `<td>${escapeHtml(item.description)}</td>`,
      ];

      if (visibility.article_code) {
        cells.push(`<td class="center">${escapeHtml(item.article_code || "-")}</td>`);
      }
      if (visibility.quantity) {
        cells.push(`<td class="center">${item.quantity ?? 0}</td>`);
      }
      if (visibility.unit) {
        cells.push(`<td class="center">${escapeHtml(item.unit || "-")}</td>`);
      }

      cells.push(`<td class="right">${formatCurrency(item.unit_price)}</td>`);

      if (visibility.discount) {
        const discount = item.discount ?? 0;
        cells.push(`<td class="right">${discount > 0 ? `${discount}%` : "-"}</td>`);
      }

      if (visibility.vat_column) {
        const vat = item.vat_rate ?? data.vat_rate;
        cells.push(`<td class="right">${vat}%</td>`);
      }

      cells.push(`<td class="right">${formatCurrency(item.total)}</td>`);

      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  const customTemplateBackground = data.template_file_url
    ? `<div class="custom-template-note">Template custom attivo</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #334155; margin: 40px; }
  .document-wrap { position: relative; }
  .content { position: relative; z-index: 1; }
  .custom-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.06; z-index: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
  .header-left h1 { font-size: 24px; color: ${palette.accent}; margin: 0; letter-spacing: 0.5px; }
  .header-right { text-align: right; }
  .header-right img { max-height: 80px; max-width: 200px; object-fit: contain; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .info-box { padding: 12px; background: ${palette.surface}; border: 1px solid ${palette.border}; border-radius: 8px; width: 48%; }
  .info-box h3 { margin: 0 0 6px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .info-box p { margin: 2px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: ${palette.accent}; color: white; padding: 10px 8px; text-align: left; font-size: 11px; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .totals { margin-top: 20px; width: 320px; margin-left: auto; }
  .totals tr td { border: none; padding: 4px 8px; }
  .totals .grand-total td { font-size: 16px; font-weight: bold; border-top: 2px solid ${palette.accent}; padding-top: 8px; }
  .notes { margin-top: 24px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; }
  .notes h3 { margin: 0 0 4px 0; font-size: 11px; color: #92400e; }
  .signature { margin-top: 24px; width: 220px; margin-left: auto; text-align: center; }
  .signature img { max-height: 80px; max-width: 220px; object-fit: contain; }
  .signature-line { border-top: 1px solid #9ca3af; margin-top: 10px; padding-top: 4px; color: #6b7280; font-size: 11px; }
  .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 10px; }
  .custom-template-note { margin-bottom: 14px; display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; padding: 4px 8px; border-radius: 999px; }
</style>
</head>
<body>
  <div class="document-wrap">
    ${data.template_file_url ? `<div class="custom-bg" style="background-image:url(&quot;${escapeHtml(data.template_file_url)}&quot;);"></div>` : ""}
    <div class="content">
    ${customTemplateBackground}
    <div class="header">
      <div class="header-left">
        <h1>${title}</h1>
        <p style="color:#6b7280;">${numberLabel} ${escapeHtml(data.number)}</p>
        <p style="color:#6b7280;">Data: ${escapeHtml(data.date)}</p>
      </div>
      ${data.artisan.logo_url ? `<div class="header-right"><img src="${escapeHtml(data.artisan.logo_url)}" alt="Logo" /></div>` : ""}
    </div>

    <div class="info-row">
      <div class="info-box">
        <h3>Da</h3>
        <p><strong>${escapeHtml(data.artisan.business_name)}</strong></p>
        ${data.artisan.company_registration_number ? `<p>N. Azienda: ${escapeHtml(data.artisan.company_registration_number)}</p>` : ""}
        ${data.artisan.vat_number ? `<p>P.IVA: ${escapeHtml(data.artisan.vat_number)}</p>` : ""}
        ${data.artisan.fiscal_code ? `<p>C.F.: ${escapeHtml(data.artisan.fiscal_code)}</p>` : ""}
        ${data.artisan.address ? `<p>${escapeHtml(data.artisan.address)}</p>` : ""}
        ${data.artisan.phone ? `<p>Tel: ${escapeHtml(data.artisan.phone)}</p>` : ""}
        ${data.artisan.email ? `<p>${escapeHtml(data.artisan.email)}</p>` : ""}
        ${data.artisan.website ? `<p>${escapeHtml(data.artisan.website)}</p>` : ""}
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
          ${headers.join("")}
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
      ${visibility.vat_column ? `<tr><td>IVA (${data.vat_rate}%):</td><td class="right">${formatCurrency(data.vat_amount)}</td></tr>` : ""}
      <tr class="grand-total">
        <td>TOTALE:</td>
        <td class="right">${formatCurrency(data.total)}</td>
      </tr>
    </table>

    ${data.valid_until ? `<p style="margin-top:16px;color:#6b7280;">Validità: fino al ${escapeHtml(data.valid_until)}</p>` : ""}
    ${visibility.due_date && data.payment_due ? `<p style="margin-top:8px;color:#6b7280;">Scadenza pagamento: ${escapeHtml(data.payment_due)}</p>` : ""}
    ${visibility.payment_method && paymentMethods ? `<p style="margin-top:8px;color:#6b7280;">Modalità di pagamento: ${escapeHtml(paymentMethods)}</p>` : ""}

    ${visibility.notes && data.notes ? `<div class="notes"><h3>Note</h3><p>${escapeHtml(data.notes)}</p></div>` : ""}

    ${
      visibility.signature && data.artisan.signature_url
        ? `<div class="signature"><img src="${escapeHtml(data.artisan.signature_url)}" alt="Firma" /><div class="signature-line">Firma</div></div>`
        : ""
    }

    <div class="footer">
      <p>Documento generato con ArtigianoAI</p>
    </div>
    </div>
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

    const html = generateHtml(data);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileName = `${data.type}_${data.number.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.html`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, html, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);

    return new Response(JSON.stringify({ pdfUrl: urlData.publicUrl, html }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
