export type ComplianceCountry = "IT" | "ES" | "PT";

export interface FiscalDocument {
  id: string;
  number: string;
  issueDate: string;
  total: number;
  vatAmount: number;
  customerName: string;
}

export interface CompliancePayload {
  documents: FiscalDocument[];
  business: {
    vatNumber?: string | null;
    fiscalCode?: string | null;
    businessName: string;
  };
}

export interface ComplianceResult {
  format: "XML" | "JSON" | "SAF-T";
  content: string;
  warnings: string[];
}

export interface ComplianceProvider {
  country: ComplianceCountry;
  export(payload: CompliancePayload): Promise<ComplianceResult>;
}

export function normalizeComplianceCountry(input?: string | null): ComplianceCountry {
  if (input === "ES" || input === "PT") return input;
  return "IT";
}

export function getComplianceRegimeLabel(country: ComplianceCountry): string {
  if (country === "ES") return "SII / TicketBAI";
  if (country === "PT") return "SAF-T";
  return "Fatturazione PA / SDI XML";
}

const italyProvider: ComplianceProvider = {
  country: "IT",
  async export(payload) {
    const warnings = [
      "Stub provider: integrare tracciato FatturaPA/SDI XML in produzione.",
    ];

    const content = `<?xml version="1.0" encoding="UTF-8"?><FatturaElettronica><Cedente>${payload.business.businessName}</Cedente></FatturaElettronica>`;

    return {
      format: "XML",
      content,
      warnings,
    };
  },
};

const spainProvider: ComplianceProvider = {
  country: "ES",
  async export(payload) {
    const warnings = [
      "Stub provider: integrare endpoint SII/TicketBAI regionali in produzione.",
    ];

    return {
      format: "JSON",
      content: JSON.stringify(
        {
          schema: "sii-ticketbai-draft",
          documents: payload.documents,
        },
        null,
        2
      ),
      warnings,
    };
  },
};

const portugalProvider: ComplianceProvider = {
  country: "PT",
  async export(payload) {
    const warnings = [
      "Stub provider: integrare esportazione SAF-T PT validata in produzione.",
    ];

    return {
      format: "SAF-T",
      content: JSON.stringify(
        {
          schema: "saf-t-pt-draft",
          company: payload.business,
          invoices: payload.documents,
        },
        null,
        2
      ),
      warnings,
    };
  },
};

const providers: Record<ComplianceCountry, ComplianceProvider> = {
  IT: italyProvider,
  ES: spainProvider,
  PT: portugalProvider,
};

export async function exportFiscalCompliance(payload: CompliancePayload) {
  const provider = providers.IT;
  return provider.export(payload);
}

export async function exportFiscalComplianceByCountry(
  country: ComplianceCountry,
  payload: CompliancePayload
) {
  const provider = providers[country];
  return provider.export(payload);
}
