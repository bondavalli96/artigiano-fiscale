export interface PaymentMethodsConfig {
  bank_transfer?: boolean;
  card?: boolean;
  stripe_link?: boolean;
  other?: boolean;
}

export interface InvoiceFieldVisibility {
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

export interface Artisan {
  id: string;
  user_id: string;
  business_name: string;
  trade: string;
  country_code: "IT" | "ES" | "PT";
  company_registration_number: string | null;
  fiscal_code: string | null;
  vat_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  preferred_input: "voice" | "text";
  sdi_code: string;
  expo_push_token: string | null;
  logo_url: string | null;
  signature_url: string | null;
  default_vat_rate: number | null;
  payment_methods: PaymentMethodsConfig | null;
  stripe_payment_link: string | null;
  payment_notes: string | null;
  subscription_plan: string | null;
  subscription_features: string[] | null;
  invoice_template_key: string | null;
  invoice_template_file_url: string | null;
  invoice_field_visibility: InvoiceFieldVisibility | null;
  inbox_email: string | null;
  created_at: string;
}

export interface PriceListItem {
  id: string;
  artisan_id: string;
  description: string;
  unit: string;
  default_price: number | null;
  category: string | null;
  usage_count: number;
  created_at: string;
}

export type ClientType = "privato" | "azienda";

export interface Client {
  id: string;
  artisan_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  reliability_score: number;
  client_type: ClientType;
  business_sector: string | null;
  vat_number: string | null;
  sdi_code: string | null;
  pec_address: string | null;
  created_at: string;
}

export type JobStatus =
  | "draft"
  | "quoted"
  | "accepted"
  | "invoiced"
  | "completed";

export interface Job {
  id: string;
  artisan_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  raw_voice_url: string | null;
  transcription: string | null;
  photos: string[] | null;
  ai_extracted_data: AIExtractedJobData | null;
  status: JobStatus;
  scheduled_date: string | null;
  created_at: string;
  client?: Client;
}

export interface AgendaEvent {
  id: string;
  artisan_id: string;
  client_id: string | null;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  client?: Client;
}

export interface AIExtractedJobData {
  tipo_lavoro: string | null;
  parole_chiave: string[] | null;
  prezzi_menzionati: number[] | null;
  materiali: string[] | null;
  urgenza: "bassa" | "media" | "alta" | null;
  note: string | null;
}

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

export interface QuoteItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: string;
  job_id: string;
  artisan_id: string;
  client_id: string | null;
  quote_number: string;
  status: QuoteStatus;
  items: QuoteItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  accepted_at: string | null;
  pdf_url: string | null;
  sent_via: string | null;
  created_at: string;
  client?: Client;
  job?: Job;
}

export type InvoiceActiveStatus = "draft" | "sent" | "paid" | "overdue";

export type SdiStatus = "not_sent" | "sent" | "delivered" | "rejected" | "accepted";

export interface InvoiceActive {
  id: string;
  quote_id: string | null;
  artisan_id: string;
  client_id: string | null;
  invoice_number: string;
  status: InvoiceActiveStatus;
  items: QuoteItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  payment_due: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  reminders_sent: number;
  last_reminder_at: string | null;
  reverse_charge: boolean;
  reverse_charge_article: string | null;
  digital_stamp: boolean;
  digital_stamp_amount: number;
  fiscal_notes: string[] | null;
  sdi_status: SdiStatus;
  sdi_id: string | null;
  xml_url: string | null;
  created_at: string;
  client?: Client;
}

export interface InvoicePassive {
  id: string;
  artisan_id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  category: string | null;
  subtotal: number | null;
  vat_amount: number | null;
  total: number | null;
  issue_date: string | null;
  payment_due: string | null;
  paid: boolean;
  paid_at: string | null;
  original_file_url: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  ai_flags: AIFlags | null;
  notes: string | null;
  created_at: string;
}

export interface AIFlags {
  duplicate?: boolean;
  unusual_amount?: boolean;
  near_deadline?: boolean;
  message?: string;
}

export interface AIPattern {
  id: string;
  artisan_id: string;
  pattern_type: string | null;
  data: Record<string, unknown> | null;
  suggestion: string | null;
  accepted: boolean | null;
  created_at: string;
}

export interface QuoteTemplate {
  id: string;
  artisan_id: string;
  name: string;
  description: string | null;
  items: QuoteItem[];
  vat_rate: number;
  notes: string | null;
  is_default: boolean;
  source: "manual" | "ai" | "import";
  usage_count: number;
  created_at: string;
}

export type InboxItemSource = "manual" | "email";

export type InboxItemFileType =
  | "image"
  | "pdf"
  | "audio"
  | "document"
  | "text";

export type InboxClassification =
  | "job"
  | "invoice_passive"
  | "client_info"
  | "receipt"
  | "other";

export type InboxItemStatus =
  | "new"
  | "classifying"
  | "classified"
  | "routed"
  | "error";

export interface InboxItem {
  id: string;
  artisan_id: string;
  source: InboxItemSource;
  source_email_from: string | null;
  source_email_subject: string | null;
  file_url: string | null;
  file_type: InboxItemFileType | null;
  file_name: string | null;
  raw_text: string | null;
  classification: InboxClassification | null;
  confidence: number | null;
  ai_extracted_data: Record<string, unknown> | null;
  ai_summary: string | null;
  status: InboxItemStatus;
  routed_to_table: string | null;
  routed_to_id: string | null;
  user_override_classification: InboxClassification | null;
  error_message: string | null;
  created_at: string;
  classified_at: string | null;
  routed_at: string | null;
}

export interface Trade {
  id: string;
  label: string;
  icon: string;
}

// --- Fiscal Compliance Types ---

export type FiscalRegime = "ordinario" | "forfettario" | "minimo";

export type SdiProvider = "fatture_in_cloud" | "aruba" | "fattura24";

export interface FiscalProfile {
  id: string;
  artisan_id: string;
  regime: FiscalRegime;
  coefficient: number | null;
  annual_revenue_limit: number;
  sdi_provider: SdiProvider | null;
  sdi_provider_api_key_encrypted: string | null;
  sdi_code: string;
  pec_address: string | null;
  digital_stamp_enabled: boolean;
  reverse_charge_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalYearTracking {
  id: string;
  artisan_id: string;
  year: number;
  total_revenue: number;
  total_expenses: number;
  invoice_count: number;
  last_updated: string;
}

export interface TaxRulesInput {
  regime_fiscale: FiscalRegime;
  client_type: ClientType;
  business_sector: string | null;
  intervention_type: string | null;
  amount: number;
  artisan_trade: string;
}

export interface TaxRulesOutput {
  vat_rate: number;
  vat_amount: number;
  reverse_charge: boolean;
  reverse_charge_article: string | null;
  digital_stamp: boolean;
  digital_stamp_amount: number;
  mandatory_notes: string[];
  warnings: string[];
}
