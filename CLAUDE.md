# CLAUDE.md — ArtigianoAI (React Native / Expo)

## Progetto
App mobile NATIVA per artigiani italiani (idraulici, elettricisti, muratori, ecc.) che automatizza il ciclo completo: lavoro → preventivo → fattura → incasso → controllo costi. L'AI è un copilota, mai un decisore. L'artigiano ha sempre il controllo.

## MCP Servers Attivi
- Context7: per documentazione aggiornata librerie
- Expo MCP: per gestione progetto Expo
- Playwright: per test browser
- Supabase MCP: per gestione database

## Regole MCP e Plugin

### Context7
- PRIMA di scrivere codice che usa una libreria (expo-av, expo-image-picker, 
  NativeWind, Supabase, React Navigation, ecc.), usa Context7 per fetchare 
  la documentazione aggiornata. Non fidarti della tua memoria.
- Usa "use context7" per qualsiasi libreria con versione > 1 anno.

### Expo MCP
- Usa sempre `npx expo install` per installare dipendenze (non npm install) 
  così le versioni sono compatibili con l'SDK.
- Quando non sei sicuro di un'API Expo, consulta la documentazione via Expo MCP 
  prima di scrivere codice.

### Playwright
- Dopo ogni fase completata, testa le pagine web (accettazione preventivo, ecc.) 
  con Playwright per verificare che funzionino.

### Supabase MCP
- Usa Supabase MCP per eseguire migrations e verificare che le tabelle 
  siano create correttamente.
- Non indovinare mai la sintassi SQL di Supabase, verifica sempre.

### Regola generale
- Se non sei sicuro di un'API o di una sintassi, cerca la documentazione 
  PRIMA di scrivere codice. Mai inventare.
- Quando una libreria dà errore, prima verifica la versione corretta con 
  Context7, poi fixa.

## Stack Tecnologico
- **Frontend:** React Native con Expo SDK 52+ (Managed Workflow)
- **Navigazione:** Expo Router (file-based routing, come Next.js)
- **UI:** NativeWind (Tailwind CSS per React Native) + React Native Paper (componenti Material)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI:** Anthropic Claude API (claude-sonnet-4-5-20250929) — chiamate via Supabase Edge Functions
- **Speech-to-Text:** expo-av per registrazione + OpenAI Whisper API per trascrizione
- **Fotocamera:** expo-image-picker
- **PDF:** react-native-pdf-lib per generazione, expo-sharing per condivisione
- **Notifiche:** expo-notifications (push notifications native)
- **Database locale:** @react-native-async-storage/async-storage (cache offline)
- **Deploy:** EAS Build (Expo Application Services) → App Store + Play Store

## Perché Expo e non bare React Native
- Expo Router = routing file-based, Ralph ci lavora meglio
- Managed workflow = no Xcode/Android Studio per buildare
- EAS Build = build in cloud, deploy sugli store senza Mac
- Accesso nativo completo a: fotocamera, microfono, notifiche push, file system, haptics, share sheet

## Struttura Database (Supabase)

### Tabelle principali

```sql
-- Profilo artigiano
CREATE TABLE artisans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  trade TEXT NOT NULL, -- idraulico, elettricista, ecc.
  fiscal_code TEXT,
  vat_number TEXT, -- P.IVA
  address TEXT,
  phone TEXT,
  email TEXT,
  preferred_input TEXT DEFAULT 'text', -- 'voice' | 'text'
  sdi_code TEXT DEFAULT '0000000', -- codice destinatario SDI
  expo_push_token TEXT, -- per notifiche push
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Listino prezzi personalizzato
CREATE TABLE price_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'ore', -- ore, pezzo, metro, forfait
  default_price NUMERIC(10,2),
  category TEXT, -- manodopera, materiale, trasferta
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clienti
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  reliability_score INTEGER DEFAULT 50, -- 0-100
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lavori
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  title TEXT NOT NULL,
  description TEXT,
  raw_voice_url TEXT,
  transcription TEXT,
  photos TEXT[],
  ai_extracted_data JSONB,
  status TEXT DEFAULT 'draft', -- draft, quoted, accepted, invoiced, completed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Preventivi
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  quote_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2),
  vat_rate NUMERIC(4,2) DEFAULT 22.00,
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  notes TEXT,
  valid_until DATE,
  accepted_at TIMESTAMPTZ,
  pdf_url TEXT,
  sent_via TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fatture attive (emesse)
CREATE TABLE invoices_active (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, paid, overdue
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2),
  vat_rate NUMERIC(4,2) DEFAULT 22.00,
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  payment_due DATE,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  reminders_sent INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fatture passive (ricevute / costi)
CREATE TABLE invoices_passive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  supplier_name TEXT,
  invoice_number TEXT,
  category TEXT, -- materiali, servizi, attrezzature, trasporto, altro
  subtotal NUMERIC(10,2),
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  issue_date DATE,
  payment_due DATE,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  original_file_url TEXT,
  ai_extracted_data JSONB,
  ai_flags JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pattern AI (apprendimento silenzioso)
CREATE TABLE ai_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  pattern_type TEXT,
  data JSONB,
  suggestion TEXT,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS)
Ogni tabella ha RLS abilitato:
```sql
CREATE POLICY "Users can only access their own data"
ON [table_name] FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));
```

### Supabase Edge Functions
Tutta la logica AI gira nelle Edge Functions di Supabase (Deno runtime) per:
- Non esporre API keys nel client mobile
- Mantenere la logica server-side
- Avere endpoint richiamabili dal client con `supabase.functions.invoke()`

```
supabase/functions/
├── suggest-price-list/index.ts   # Genera listino per mestiere
├── transcribe/index.ts           # Whisper STT
├── extract-job/index.ts          # Estrai dati da testo/vocale
├── suggest-quote/index.ts        # Genera bozza preventivo
├── generate-pdf/index.ts         # Genera PDF preventivo/fattura
├── extract-invoice/index.ts      # Estrai dati fattura passiva
├── check-anomalies/index.ts      # Controllo anomalie
├── monthly-summary/index.ts      # Riassunto mensile AI
├── send-reminder/index.ts        # Sollecito pagamento
└── analyze-patterns/index.ts     # Apprendimento pattern
```

## Struttura File del Progetto

```
artigiano-app/
├── CLAUDE.md
├── RALPH-LOOP.md
├── app.json                       # Expo config
├── eas.json                       # EAS Build config
├── tailwind.config.js             # NativeWind config
├── app/
│   ├── _layout.tsx                # Root layout
│   ├── index.tsx                  # Entry → redirect auth/dashboard
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── onboarding/
│   │   └── index.tsx              # Onboarding wizard
│   ├── (tabs)/
│   │   ├── _layout.tsx            # Tab navigator (5 tabs)
│   │   ├── index.tsx              # Dashboard / Home
│   │   ├── jobs/
│   │   │   ├── index.tsx          # Lista lavori
│   │   │   ├── new.tsx            # Nuovo lavoro
│   │   │   └── [id].tsx           # Dettaglio lavoro
│   │   ├── quotes/
│   │   │   ├── index.tsx          # Lista preventivi
│   │   │   └── [id].tsx           # Editor preventivo
│   │   ├── invoices/
│   │   │   ├── index.tsx          # Tab attive/passive
│   │   │   ├── active/[id].tsx    # Dettaglio fattura attiva
│   │   │   └── passive/new.tsx    # Upload fattura passiva
│   │   └── settings/
│   │       ├── index.tsx          # Impostazioni
│   │       └── price-list.tsx     # Listino prezzi
│   └── quote-accept/
│       └── [id].tsx               # Deep link accettazione (pubblico)
├── components/
│   ├── VoiceRecorder.tsx          # Registratore vocale nativo
│   ├── PhotoPicker.tsx            # Picker foto con expo-image-picker
│   ├── QuoteEditor.tsx            # Editor preventivo editabile
│   ├── InvoiceCard.tsx            # Card fattura con stato
│   ├── AISuggestionBanner.tsx     # Banner suggerimenti AI
│   ├── DashboardSummary.tsx       # Riassunto entrate/uscite
│   ├── StatusBadge.tsx            # Badge stato colorato
│   ├── ClientAutocomplete.tsx     # Autocomplete clienti
│   └── EmptyState.tsx             # Componente stato vuoto
├── lib/
│   ├── supabase.ts                # Client Supabase inizializzato
│   ├── ai/
│   │   └── prompts.ts             # Tutti i prompt AI centralizzati
│   ├── pdf/
│   │   └── generator.ts           # Generazione PDF
│   └── utils/
│       ├── format.ts              # Formattazione €, date italiane
│       └── validators.ts          # Validazione P.IVA, CF
├── hooks/
│   ├── useAuth.ts                 # Hook autenticazione
│   ├── useArtisan.ts              # Hook profilo artigiano
│   └── useSupabase.ts             # Hook query Supabase
├── constants/
│   └── trades.ts                  # Lista mestieri + icone
├── types/
│   └── index.ts                   # TypeScript types
└── supabase/
    ├── migrations/                # SQL migrations
    └── functions/                 # Edge Functions (vedi sopra)
```

## Principi AI

### L'AI è un COPILOTA, mai un decisore
- L'AI PROPONE, l'artigiano CONFERMA
- Nessun prezzo viene mai imposto dall'AI
- Nessuna azione irreversibile senza conferma umana
- Ogni suggerimento AI è modificabile o ignorabile

### Chiamate AI
Tutte le chiamate AI passano per Supabase Edge Functions. Il client mobile NON chiama mai direttamente Claude o Whisper. Pattern:
```typescript
// Nel client mobile
const { data, error } = await supabase.functions.invoke('extract-job', {
  body: { text: jobDescription, artisanId: artisan.id }
});
```

### Prompt Strategy
Tutti i prompt centralizzati in `lib/ai/prompts.ts` per consistenza. Ogni prompt specifica:
- Ruolo: assistente per artigiani italiani
- Output: sempre JSON valido
- Regola: mai inventare dati, usare solo ciò che è fornito

### Linguaggio
- Zero gergo tecnico-contabile
- Riassunti AI tipo: "Questo mese hai incassato 4.200€ ma hai speso 1.800€ in materiali. Margine: 2.400€."

## Regole di Sviluppo

### Mobile-First e NATIVO
- Tutto è pensato per il dito, non per il mouse
- Bottoni min 48x48 punti (accessibilità)
- Haptic feedback su azioni importanti
- Pull-to-refresh su ogni lista
- Swipe actions (archivia, elimina)
- Bottom sheet per form secondari
- KeyboardAvoidingView su ogni form

### Performance
- Lista lavori/fatture con FlashList (non FlatList)
- Immagini ottimizzate con expo-image
- Skeleton loaders durante caricamento
- Offline-first dove possibile (cache locale)

### Sicurezza
- RLS Supabase su ogni tabella
- API keys MAI nel client — solo in Edge Functions
- Validazione input sia client che server
- Secure storage per token (expo-secure-store)

### Notifiche Push
- Reminder fatture scadute
- Preventivo accettato dal cliente
- Nuova fattura passiva in scadenza
- Configurate via expo-notifications + Supabase Edge Functions

## Variabili Ambiente

### Client (.env)
```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Supabase Edge Functions (secrets)
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set RESEND_API_KEY=re_...
```

## Build & Deploy

### Development
```bash
npx expo start         # Avvia dev server
# Scan QR con Expo Go su telefono
```

### Build per store
```bash
eas build --platform ios      # Build iOS
eas build --platform android  # Build Android
eas submit --platform ios     # Submit su App Store
eas submit --platform android # Submit su Play Store
```

### Requisiti per pubblicazione
- **Apple:** Apple Developer Account (99€/anno), certificati gestiti da EAS
- **Google:** Google Play Console (25$ una tantum)
- **Privacy Policy:** necessaria per entrambi gli store (l'app gestisce dati personali/fiscali)
