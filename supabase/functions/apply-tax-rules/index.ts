import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * apply-tax-rules — Motore di compliance fiscale italiana
 *
 * Determina automaticamente:
 * - Aliquota IVA corretta
 * - Applicabilità Reverse Charge (art. 17 DPR 633/72)
 * - Marca da bollo (DM 17.06.2014)
 * - Diciture obbligatorie per regime e operazione
 */

interface TaxRulesInput {
  regime_fiscale: "ordinario" | "forfettario" | "minimo";
  client_type: "privato" | "azienda";
  business_sector: string | null;
  intervention_type: string | null;
  amount: number;
  artisan_trade: string;
}

interface TaxRulesOutput {
  vat_rate: number;
  vat_amount: number;
  reverse_charge: boolean;
  reverse_charge_article: string | null;
  digital_stamp: boolean;
  digital_stamp_amount: number;
  mandatory_notes: string[];
  warnings: string[];
}

// Mestieri soggetti a reverse charge in edilizia (art. 17, c.6, lett. a)
const REVERSE_CHARGE_TRADES = [
  "muratore",
  "edile",
  "piastrellista",
  "imbianchino",
  "cartongessista",
  "idraulico",
  "elettricista",
  "fabbro",
  "carpentiere",
  "lattoniere",
  "serramentista",
  "pavimentista",
  "stuccatore",
  "impermeabilizzatore",
];

// Tipi di intervento che attivano il reverse charge
const REVERSE_CHARGE_INTERVENTIONS = [
  "ristrutturazione",
  "manutenzione",
  "costruzione",
  "demolizione",
  "installazione",
  "rifacimento",
  "restauro",
  "ampliamento",
  "consolidamento",
];

// Settori che attivano il reverse charge
const REVERSE_CHARGE_SECTORS = [
  "edilizia",
  "costruzioni",
  "impiantistica",
  "ristrutturazioni",
];

// Coefficienti di redditivita forfettario per codice ATECO (semplificati per mestiere)
const FORFETTARIO_COEFFICIENTS: Record<string, number> = {
  muratore: 86,
  edile: 86,
  piastrellista: 86,
  imbianchino: 86,
  cartongessista: 86,
  idraulico: 86,
  elettricista: 86,
  fabbro: 86,
  carpentiere: 86,
  falegname: 86,
  serramentista: 86,
  lattoniere: 86,
  pavimentista: 86,
  giardiniere: 86,
  default: 78,
};

function normalizeString(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isReverseChargeApplicable(
  trade: string,
  clientType: string,
  businessSector: string | null,
  interventionType: string | null
): boolean {
  // Reverse charge only applies when client is a business (azienda)
  if (clientType !== "azienda") return false;

  const normalizedTrade = normalizeString(trade);
  const normalizedSector = normalizeString(businessSector);
  const normalizedIntervention = normalizeString(interventionType);

  // Check if the artisan's trade is in the reverse charge list
  const tradeMatches = REVERSE_CHARGE_TRADES.some(
    (t) => normalizedTrade.includes(t) || t.includes(normalizedTrade)
  );

  if (!tradeMatches) return false;

  // Check if sector or intervention type matches
  const sectorMatches = REVERSE_CHARGE_SECTORS.some(
    (s) => normalizedSector.includes(s) || s.includes(normalizedSector)
  );

  const interventionMatches = REVERSE_CHARGE_INTERVENTIONS.some(
    (i) =>
      normalizedIntervention.includes(i) || i.includes(normalizedIntervention)
  );

  return sectorMatches || interventionMatches;
}

function applyTaxRules(input: TaxRulesInput): TaxRulesOutput {
  const {
    regime_fiscale,
    client_type,
    business_sector,
    intervention_type,
    amount,
    artisan_trade,
  } = input;

  const result: TaxRulesOutput = {
    vat_rate: 22,
    vat_amount: 0,
    reverse_charge: false,
    reverse_charge_article: null,
    digital_stamp: false,
    digital_stamp_amount: 0,
    mandatory_notes: [],
    warnings: [],
  };

  // --- REGIME FORFETTARIO ---
  if (regime_fiscale === "forfettario") {
    result.vat_rate = 0;
    result.vat_amount = 0;

    // Diciture obbligatorie forfettario
    result.mandatory_notes.push(
      "Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, della Legge n. 190/2014 — Regime forfettario"
    );
    result.mandatory_notes.push(
      "Si richiede la non applicazione della ritenuta alla fonte a titolo d'acconto ai sensi dell'art. 1, comma 67, Legge n. 190/2014"
    );

    // Marca da bollo: obbligatoria se importo > 77.47 EUR
    if (amount > 77.47) {
      result.digital_stamp = true;
      result.digital_stamp_amount = 2.0;
      result.mandatory_notes.push(
        "Imposta di bollo da 2,00 euro assolta in modo virtuale ai sensi del D.M. 17 giugno 2014"
      );
    }

    return result;
  }

  // --- REGIME MINIMO ---
  if (regime_fiscale === "minimo") {
    result.vat_rate = 0;
    result.vat_amount = 0;

    result.mandatory_notes.push(
      "Operazione effettuata ai sensi dell'art. 27, commi 1 e 2, D.L. n. 98/2011 — Regime dei minimi"
    );
    result.mandatory_notes.push(
      "Si richiede la non applicazione della ritenuta alla fonte a titolo d'acconto ai sensi dell'art. 27, comma 5, D.L. n. 98/2011"
    );

    // Marca da bollo per regime minimo
    if (amount > 77.47) {
      result.digital_stamp = true;
      result.digital_stamp_amount = 2.0;
      result.mandatory_notes.push(
        "Imposta di bollo da 2,00 euro assolta in modo virtuale ai sensi del D.M. 17 giugno 2014"
      );
    }

    return result;
  }

  // --- REGIME ORDINARIO ---

  // Check reverse charge (Art. 17, comma 6, lett. a, DPR 633/72)
  const reverseChargeApplicable = isReverseChargeApplicable(
    artisan_trade,
    client_type,
    business_sector,
    intervention_type
  );

  if (reverseChargeApplicable) {
    result.reverse_charge = true;
    result.vat_rate = 0;
    result.vat_amount = 0;
    result.reverse_charge_article =
      "Art. 17, comma 6, lett. a), DPR n. 633/72";
    result.mandatory_notes.push(
      "Operazione soggetta al meccanismo dell'inversione contabile (Reverse Charge) ai sensi dell'art. 17, comma 6, lett. a), del DPR n. 633/72"
    );

    // Anche con reverse charge, se non c'e IVA e importo > 77.47, serve bollo
    if (amount > 77.47) {
      result.digital_stamp = true;
      result.digital_stamp_amount = 2.0;
      result.mandatory_notes.push(
        "Imposta di bollo da 2,00 euro assolta in modo virtuale ai sensi del D.M. 17 giugno 2014"
      );
    }

    result.warnings.push(
      "Reverse Charge applicato: il tuo cliente (azienda) versera l'IVA al posto tuo"
    );
  } else {
    // IVA ordinaria al 22%
    result.vat_rate = 22;
    result.vat_amount = Math.round(amount * 0.22 * 100) / 100;
  }

  return result;
}

Deno.serve(async (req) => {
  // CORS
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
    const input: TaxRulesInput = await req.json();

    // Validate required fields
    if (!input.regime_fiscale || !input.client_type || input.amount == null) {
      return new Response(
        JSON.stringify({
          error:
            "Campi obbligatori: regime_fiscale, client_type, amount",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate regime
    if (!["ordinario", "forfettario", "minimo"].includes(input.regime_fiscale)) {
      return new Response(
        JSON.stringify({
          error:
            "regime_fiscale deve essere: ordinario, forfettario, o minimo",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate client_type
    if (!["privato", "azienda"].includes(input.client_type)) {
      return new Response(
        JSON.stringify({
          error: "client_type deve essere: privato o azienda",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = applyTaxRules(input);

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
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
