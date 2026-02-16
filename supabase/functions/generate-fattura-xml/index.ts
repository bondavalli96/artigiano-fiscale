import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface XmlRequest {
  invoiceId: string;
  artisanId: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
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
    const { invoiceId, artisanId }: XmlRequest = await req.json();

    if (!invoiceId || !artisanId) {
      return new Response(
        JSON.stringify({ error: "invoiceId and artisanId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice with client
    const { data: invoice, error: invError } = await supabase
      .from("invoices_active")
      .select("*, client:clients(*)")
      .eq("id", invoiceId)
      .eq("artisan_id", artisanId)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch artisan
    const { data: artisan } = await supabase
      .from("artisans")
      .select("*")
      .eq("id", artisanId)
      .single();

    if (!artisan) {
      return new Response(
        JSON.stringify({ error: "Artisan not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch fiscal profile
    const { data: fiscalProfile } = await supabase
      .from("fiscal_profiles")
      .select("*")
      .eq("artisan_id", artisanId)
      .single();

    // Build FatturaPA XML 1.2.2
    const progressivoInvio = invoice.invoice_number.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
    const codiceDestinatario = invoice.client?.sdi_code || fiscalProfile?.sdi_code || "0000000";
    const regime = fiscalProfile?.regime === "forfettario" ? "RF19" : "RF01";

    const items = (invoice.items as any[]) || [];
    const invoiceDate = formatDate(invoice.created_at);

    // Determine natura for VAT exemptions
    let naturaCode = "";
    if (invoice.reverse_charge) {
      naturaCode = "N6.7"; // Reverse charge edilizia
    } else if (fiscalProfile?.regime === "forfettario") {
      naturaCode = "N2.2"; // Non soggetto - regime forfettario
    }

    // Generate line items XML
    const dettaglioLinee = items
      .map((item: any, index: number) => {
        const lineNum = index + 1;
        const qty = item.quantity || 1;
        const unitPrice = item.unit_price || 0;
        const total = item.total || qty * unitPrice;
        const vatRate = invoice.reverse_charge
          ? 0
          : fiscalProfile?.regime === "forfettario"
          ? 0
          : invoice.vat_rate || 22;

        return `
        <DettaglioLinee>
          <NumeroLinea>${lineNum}</NumeroLinea>
          <Descrizione>${escapeXml(item.description || "")}</Descrizione>
          ${item.unit ? `<UnitaMisura>${escapeXml(item.unit)}</UnitaMisura>` : ""}
          <Quantita>${formatAmount(qty)}</Quantita>
          <PrezzoUnitario>${formatAmount(unitPrice)}</PrezzoUnitario>
          <PrezzoTotale>${formatAmount(total)}</PrezzoTotale>
          <AliquotaIVA>${formatAmount(vatRate)}</AliquotaIVA>
          ${naturaCode ? `<Natura>${naturaCode}</Natura>` : ""}
        </DettaglioLinee>`;
      })
      .join("");

    // VAT summary
    const vatRate = invoice.reverse_charge || fiscalProfile?.regime === "forfettario"
      ? 0
      : invoice.vat_rate || 22;

    const riepilogoIva = `
        <DatiRiepilogo>
          <AliquotaIVA>${formatAmount(vatRate)}</AliquotaIVA>
          <ImponibileImporto>${formatAmount(invoice.subtotal || 0)}</ImponibileImporto>
          <Imposta>${formatAmount(invoice.vat_amount || 0)}</Imposta>
          ${naturaCode ? `<Natura>${naturaCode}</Natura>` : ""}
          <EsigibilitaIVA>I</EsigibilitaIVA>
          ${invoice.reverse_charge ? `<RiferimentoNormativo>Art. 17 c.6 DPR 633/72</RiferimentoNormativo>` : ""}
          ${fiscalProfile?.regime === "forfettario" ? `<RiferimentoNormativo>Art. 1 c.54-89 L. 190/2014</RiferimentoNormativo>` : ""}
        </DatiRiepilogo>`;

    // Digital stamp (bollo)
    const datiBollo = invoice.digital_stamp
      ? `
          <DatiBollo>
            <BolloVirtuale>SI</BolloVirtuale>
            <ImportoBollo>${formatAmount(invoice.digital_stamp_amount || 2)}</ImportoBollo>
          </DatiBollo>`
      : "";

    // Build complete XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versione="FPR12" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_v1.2.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(artisan.fiscal_code || artisan.vat_number || "")}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${escapeXml(progressivoInvio)}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXml(codiceDestinatario)}</CodiceDestinatario>
      ${invoice.client?.pec_address ? `<PECDestinatario>${escapeXml(invoice.client.pec_address)}</PECDestinatario>` : ""}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(artisan.vat_number || "")}</IdCodice>
        </IdFiscaleIVA>
        ${artisan.fiscal_code ? `<CodiceFiscale>${escapeXml(artisan.fiscal_code)}</CodiceFiscale>` : ""}
        <Anagrafica>
          <Denominazione>${escapeXml(artisan.business_name)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${regime}</RegimeFiscale>
      </DatiAnagrafici>
      ${artisan.address ? `<Sede>
        <Indirizzo>${escapeXml(artisan.address)}</Indirizzo>
        <CAP>00000</CAP>
        <Comune>-</Comune>
        <Nazione>IT</Nazione>
      </Sede>` : ""}
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        ${invoice.client?.vat_number ? `<IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(invoice.client.vat_number)}</IdCodice>
        </IdFiscaleIVA>` : ""}
        <Anagrafica>
          <Denominazione>${escapeXml(invoice.client?.name || "Cliente")}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      ${invoice.client?.address ? `<Sede>
        <Indirizzo>${escapeXml(invoice.client.address)}</Indirizzo>
        <CAP>00000</CAP>
        <Comune>-</Comune>
        <Nazione>IT</Nazione>
      </Sede>` : ""}
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${invoiceDate}</Data>
        <Numero>${escapeXml(invoice.invoice_number)}</Numero>
        <ImportoTotaleDocumento>${formatAmount(invoice.total || 0)}</ImportoTotaleDocumento>${datiBollo}
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>${dettaglioLinee}${riepilogoIva}
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

    // Upload XML to storage
    const fileName = `fattura_${invoice.invoice_number.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.xml`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, xml, {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Update invoice with XML URL
    await supabase
      .from("invoices_active")
      .update({ xml_url: urlData.publicUrl })
      .eq("id", invoiceId);

    return new Response(
      JSON.stringify({
        xml,
        xmlUrl: urlData.publicUrl,
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
