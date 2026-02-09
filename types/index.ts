export interface Artisan {
  id: string;
  user_id: string;
  business_name: string;
  trade: string;
  fiscal_code: string | null;
  vat_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  preferred_input: "voice" | "text";
  sdi_code: string;
  expo_push_token: string | null;
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

export interface Client {
  id: string;
  artisan_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  reliability_score: number;
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

export interface Trade {
  id: string;
  label: string;
  icon: string;
}
