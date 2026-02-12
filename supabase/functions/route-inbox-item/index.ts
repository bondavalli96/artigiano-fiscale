import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const { inboxItemId, overrideClassification, overrideData } = body;

    if (!inboxItemId) {
      return new Response(
        JSON.stringify({ error: "inboxItemId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch inbox item
    const { data: item, error: fetchErr } = await supabase
      .from("inbox_items")
      .select("*")
      .eq("id", inboxItemId)
      .single();

    if (fetchErr || !item) {
      return new Response(
        JSON.stringify({ error: "Inbox item not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const classification =
      (overrideClassification as string) || item.classification;
    const extractedData =
      (overrideData as Record<string, unknown>) || item.ai_extracted_data || {};

    let routedToTable = "";
    let routedToId = "";

    if (classification === "job") {
      // Create a new job
      const { data: newJob, error: jobErr } = await supabase
        .from("jobs")
        .insert({
          artisan_id: item.artisan_id,
          title:
            (extractedData.title as string) || item.ai_summary || "Nuovo lavoro da inbox",
          description:
            (extractedData.description as string) || item.raw_text || "",
          photos: item.file_url && item.file_type === "image" ? [item.file_url] : [],
          ai_extracted_data: {
            tipo_lavoro: (extractedData.title as string) || null,
            materiali: (extractedData.materials as string[]) || null,
            urgenza: (extractedData.urgency as string) || null,
            parole_chiave: null,
            prezzi_menzionati: null,
            note: item.ai_summary || null,
          },
          status: "draft",
        })
        .select("id")
        .single();

      if (jobErr) {
        return new Response(
          JSON.stringify({ error: `Failed to create job: ${jobErr.message}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      routedToTable = "jobs";
      routedToId = newJob.id;
    } else if (classification === "invoice_passive") {
      // Create a passive invoice
      const { data: newInv, error: invErr } = await supabase
        .from("invoices_passive")
        .insert({
          artisan_id: item.artisan_id,
          supplier_name: (extractedData.supplier_name as string) || null,
          invoice_number: (extractedData.invoice_number as string) || null,
          category: (extractedData.category as string) || "altro",
          subtotal: parseFloat(String(extractedData.subtotal)) || null,
          vat_amount: parseFloat(String(extractedData.vat_amount)) || null,
          total: parseFloat(String(extractedData.total)) || null,
          issue_date: (extractedData.issue_date as string) || null,
          original_file_url: item.file_url || null,
          ai_extracted_data: extractedData,
          notes: item.ai_summary || null,
        })
        .select("id")
        .single();

      if (invErr) {
        return new Response(
          JSON.stringify({
            error: `Failed to create invoice: ${invErr.message}`,
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      routedToTable = "invoices_passive";
      routedToId = newInv.id;
    } else if (classification === "client_info") {
      // Check if client exists (by name) or create new
      const clientName = (extractedData.name as string) || "Nuovo cliente";

      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("artisan_id", item.artisan_id)
        .ilike("name", clientName)
        .maybeSingle();

      if (existing) {
        // Update existing client
        const updates: Record<string, unknown> = {};
        if (extractedData.phone) updates.phone = extractedData.phone;
        if (extractedData.email) updates.email = extractedData.email;
        if (extractedData.address) updates.address = extractedData.address;

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("clients")
            .update(updates)
            .eq("id", existing.id);
        }

        routedToTable = "clients";
        routedToId = existing.id;
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({
            artisan_id: item.artisan_id,
            name: clientName,
            phone: (extractedData.phone as string) || null,
            email: (extractedData.email as string) || null,
            address: (extractedData.address as string) || null,
            notes: item.ai_summary || null,
          })
          .select("id")
          .single();

        if (clientErr) {
          return new Response(
            JSON.stringify({
              error: `Failed to create client: ${clientErr.message}`,
            }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        routedToTable = "clients";
        routedToId = newClient.id;
      }
    } else {
      // receipt or other — just mark as routed, no table creation
      routedToTable = "none";
      routedToId = "";
    }

    // Update inbox item as routed
    const updatePayload: Record<string, unknown> = {
      status: "routed",
      routed_to_table: routedToTable,
      routed_at: new Date().toISOString(),
    };
    if (routedToId) {
      updatePayload.routed_to_id = routedToId;
    }
    if (overrideClassification) {
      updatePayload.user_override_classification = overrideClassification;
    }

    await supabase
      .from("inbox_items")
      .update(updatePayload)
      .eq("id", inboxItemId);

    return new Response(
      JSON.stringify({
        routed_to_table: routedToTable,
        routed_to_id: routedToId,
        classification,
      }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
