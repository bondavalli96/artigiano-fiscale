#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mustEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function inferMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function main() {
  const supabaseUrl = mustEnv("EXPO_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const artisanId = process.env.E2E_ARTISAN_ID;
  let artisan;

  if (artisanId) {
    const { data, error } = await admin
      .from("artisans")
      .select("*")
      .eq("id", artisanId)
      .single();
    if (error) throw error;
    artisan = data;
  } else {
    const { data, error } = await admin
      .from("artisans")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    artisan = data;
  }

  const imagePath = process.env.E2E_IMAGE_PATH;
  let fileType = "text";
  let fileUrl = null;
  let fileName = null;
  let rawText =
    process.env.E2E_TEXT ||
    "Cliente Rossi: perdita urgente nel bagno, sostituire guarnizione e testare tenuta.";

  if (imagePath) {
    const absPath = path.resolve(imagePath);
    const content = await fs.readFile(absPath);
    const storagePath = `${artisan.id}/e2e_${Date.now()}_${path.basename(absPath)}`;
    const { error: uploadErr } = await admin.storage
      .from("inbox")
      .upload(storagePath, content, {
        contentType: inferMime(absPath),
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = admin.storage.from("inbox").getPublicUrl(storagePath);
    fileUrl = urlData.publicUrl;
    fileName = path.basename(absPath);
    fileType = inferMime(absPath).startsWith("image/") ? "image" : "pdf";
  }

  const { data: inboxItem, error: inboxErr } = await admin
    .from("inbox_items")
    .insert({
      artisan_id: artisan.id,
      source: "manual",
      file_type: fileType,
      file_url: fileUrl,
      file_name: fileName,
      raw_text: rawText,
      status: "new",
    })
    .select("*")
    .single();
  if (inboxErr) throw inboxErr;

  const classifyRes = await admin.functions.invoke("classify-inbox-item", {
    body: { inboxItemId: inboxItem.id },
  });
  if (classifyRes.error) {
    throw new Error(`classify-inbox-item failed: ${classifyRes.error.message}`);
  }

  let latest = inboxItem;
  for (let i = 0; i < 40; i++) {
    const { data, error } = await admin
      .from("inbox_items")
      .select("*")
      .eq("id", inboxItem.id)
      .single();
    if (error) throw error;
    latest = data;
    if (latest.status === "classified" || latest.status === "routed" || latest.status === "error") {
      break;
    }
    await sleep(1500);
  }

  if (latest.status === "error") {
    throw new Error(`Inbox classification error: ${latest.error_message || "unknown"}`);
  }
  if (latest.status !== "classified" && latest.status !== "routed") {
    throw new Error(`Timeout waiting classification. Last status: ${latest.status}`);
  }

  const routeRes = await admin.functions.invoke("route-inbox-item", {
    body: {
      inboxItemId: inboxItem.id,
      overrideClassification: "job",
      overrideData: {
        title: "E2E Test - Intervento urgente bagno",
        description: rawText,
        materials: ["guarnizione", "silicone"],
        urgency: "alta",
      },
    },
  });
  if (routeRes.error) {
    throw new Error(`route-inbox-item failed: ${routeRes.error.message}`);
  }

  const routedJobId = routeRes.data?.routed_to_id;
  if (!routedJobId) {
    throw new Error("No routed job id returned");
  }

  const { count, error: countErr } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("artisan_id", artisan.id);
  if (countErr) throw countErr;

  const quoteNumber = `PRV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, "0")}`;
  const items = [
    {
      description: "Intervento idraulico urgente",
      quantity: 1,
      unit: "pz",
      unit_price: 150,
      total: 150,
    },
  ];
  const subtotal = 150;
  const vatRate = Number(artisan.default_vat_rate || 22);
  const vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
  const total = Number((subtotal + vatAmount).toFixed(2));

  const { data: quote, error: quoteErr } = await admin
    .from("quotes")
    .insert({
      artisan_id: artisan.id,
      job_id: routedJobId,
      client_id: null,
      quote_number: quoteNumber,
      status: "sent",
      items,
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total,
    })
    .select("*")
    .single();
  if (quoteErr) throw quoteErr;

  const pdfRes = await admin.functions.invoke("generate-pdf", {
    body: {
      type: "quote",
      number: quoteNumber,
      date: new Date().toISOString().slice(0, 10),
      artisan: {
        business_name: artisan.business_name,
        company_registration_number: artisan.company_registration_number,
        vat_number: artisan.vat_number,
        fiscal_code: artisan.fiscal_code,
        address: artisan.address,
        phone: artisan.phone,
        email: artisan.email,
        website: artisan.website,
        sdi_code: artisan.sdi_code,
        logo_url: artisan.logo_url,
        signature_url: artisan.signature_url,
      },
      items,
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total,
      template_key: artisan.invoice_template_key || "classic",
      template_file_url: artisan.invoice_template_file_url || undefined,
      field_visibility: artisan.invoice_field_visibility || undefined,
      payment_methods: artisan.payment_methods || undefined,
    },
  });
  if (pdfRes.error) {
    throw new Error(`generate-pdf failed: ${pdfRes.error.message}`);
  }

  const pdfUrl = pdfRes.data?.pdfUrl || null;
  if (pdfUrl) {
    await admin.from("quotes").update({ pdf_url: pdfUrl }).eq("id", quote.id);
  }

  const whatsappMessage = encodeURIComponent(
    `Preventivo ${quoteNumber} - EUR ${total.toFixed(2)}\nDocumento: ${pdfUrl || "N/A"}`
  );
  const whatsappUrl = `whatsapp://send?text=${whatsappMessage}`;

  console.log(
    JSON.stringify(
      {
        ok: true,
        artisan_id: artisan.id,
        inbox_item_id: inboxItem.id,
        routed_job_id: routedJobId,
        quote_id: quote.id,
        quote_number: quoteNumber,
        pdf_url: pdfUrl,
        whatsapp_url: whatsappUrl,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("E2E flow failed:", error.message);
  process.exit(1);
});
