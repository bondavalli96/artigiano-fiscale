import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendRequest {
  action: "send" | "test_connection" | "check_status";
  invoiceId?: string;
  artisanId: string;
}

// Provider API adapters
async function sendViaFattureInCloud(
  xmlContent: string,
  apiKey: string,
  invoiceNumber: string
): Promise<{ success: boolean; sdiId?: string; error?: string }> {
  try {
    const response = await fetch(
      "https://api-v2.fattureincloud.it/c/0/issued_documents/e_invoice/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            xml: btoa(xmlContent),
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      sdiId: data?.data?.id?.toString() || invoiceNumber,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function sendViaAruba(
  xmlContent: string,
  apiKey: string,
  invoiceNumber: string
): Promise<{ success: boolean; sdiId?: string; error?: string }> {
  try {
    const response = await fetch(
      "https://ws.fatturazioneelettronica.aruba.it/services/invoice/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/xml",
        },
        body: xmlContent,
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.text();
    return {
      success: true,
      sdiId: data || invoiceNumber,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function sendViaFattura24(
  xmlContent: string,
  apiKey: string,
  invoiceNumber: string
): Promise<{ success: boolean; sdiId?: string; error?: string }> {
  try {
    const response = await fetch(
      "https://www.app.fattura24.com/api/v0.3/SendDocument",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          apiKey,
          xml: xmlContent,
        }),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.text();
    return {
      success: true,
      sdiId: data || invoiceNumber,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function testProviderConnection(
  provider: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let url: string;
    let headers: Record<string, string>;

    switch (provider) {
      case "fatture_in_cloud":
        url = "https://api-v2.fattureincloud.it/user/companies";
        headers = { Authorization: `Bearer ${apiKey}` };
        break;
      case "aruba":
        url =
          "https://ws.fatturazioneelettronica.aruba.it/services/invoice/status";
        headers = { Authorization: `Bearer ${apiKey}` };
        break;
      case "fattura24":
        url = "https://www.app.fattura24.com/api/v0.3/TestKey";
        headers = { "Content-Type": "application/x-www-form-urlencoded" };
        break;
      default:
        return { success: false, error: "Unknown provider" };
    }

    const fetchOptions: RequestInit = {
      method: provider === "fattura24" ? "POST" : "GET",
      headers,
    };

    if (provider === "fattura24") {
      fetchOptions.body = new URLSearchParams({ apiKey });
    }

    const response = await fetch(url, fetchOptions);
    return { success: response.ok };
  } catch (err) {
    return { success: false, error: (err as Error).message };
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
    const { action, invoiceId, artisanId }: SendRequest = await req.json();

    if (!artisanId) {
      return new Response(
        JSON.stringify({ error: "artisanId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get fiscal profile with provider info
    const { data: fiscalProfile } = await supabase
      .from("fiscal_profiles")
      .select("*")
      .eq("artisan_id", artisanId)
      .single();

    if (!fiscalProfile?.sdi_provider || !fiscalProfile?.sdi_provider_api_key_encrypted) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No SdI provider configured. Go to Settings > Fiscal to set up.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const provider = fiscalProfile.sdi_provider;
    const apiKey = fiscalProfile.sdi_provider_api_key_encrypted;

    // Handle test connection
    if (action === "test_connection") {
      const result = await testProviderConnection(provider, apiKey);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle send
    if (action === "send") {
      if (!invoiceId) {
        return new Response(
          JSON.stringify({ error: "invoiceId is required for send action" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // First, generate XML if not already done
      const { data: invoice } = await supabase
        .from("invoices_active")
        .select("*")
        .eq("id", invoiceId)
        .eq("artisan_id", artisanId)
        .single();

      if (!invoice) {
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      let xmlContent: string;

      if (invoice.xml_url) {
        // Fetch existing XML
        const xmlResponse = await fetch(invoice.xml_url);
        xmlContent = await xmlResponse.text();
      } else {
        // Generate XML first by calling generate-fattura-xml internally
        const xmlGenUrl = `${supabaseUrl}/functions/v1/generate-fattura-xml`;
        const xmlResponse = await fetch(xmlGenUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invoiceId, artisanId }),
        });

        if (!xmlResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to generate XML" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const xmlData = await xmlResponse.json();
        xmlContent = xmlData.xml;
      }

      // Update status to sending
      await supabase
        .from("invoices_active")
        .update({ sdi_status: "sent" })
        .eq("id", invoiceId);

      // Send via provider
      let result: { success: boolean; sdiId?: string; error?: string };

      switch (provider) {
        case "fatture_in_cloud":
          result = await sendViaFattureInCloud(xmlContent, apiKey, invoice.invoice_number);
          break;
        case "aruba":
          result = await sendViaAruba(xmlContent, apiKey, invoice.invoice_number);
          break;
        case "fattura24":
          result = await sendViaFattura24(xmlContent, apiKey, invoice.invoice_number);
          break;
        default:
          result = { success: false, error: "Unknown provider" };
      }

      if (result.success) {
        await supabase
          .from("invoices_active")
          .update({
            sdi_status: "sent",
            sdi_id: result.sdiId || null,
          })
          .eq("id", invoiceId);

        return new Response(
          JSON.stringify({
            success: true,
            sdiId: result.sdiId,
            sdiStatus: "sent",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Revert status on failure
        await supabase
          .from("invoices_active")
          .update({ sdi_status: "not_sent" })
          .eq("id", invoiceId);

        return new Response(
          JSON.stringify({
            success: false,
            error: result.error,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Handle check_status
    if (action === "check_status") {
      if (!invoiceId) {
        return new Response(
          JSON.stringify({ error: "invoiceId is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { data: invoice } = await supabase
        .from("invoices_active")
        .select("sdi_status, sdi_id")
        .eq("id", invoiceId)
        .eq("artisan_id", artisanId)
        .single();

      return new Response(
        JSON.stringify({
          sdiStatus: invoice?.sdi_status || "not_sent",
          sdiId: invoice?.sdi_id || null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
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
