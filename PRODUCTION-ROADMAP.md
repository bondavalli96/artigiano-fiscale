# 🚀 PRODUCTION-READY ROADMAP — ArtigianoAI

Roadmap completa per portare l'app ArtigianoAI a produzione e pubblicarla su App Store e Google Play Store.

---

## 📋 INDICE

1. [Edge Functions Rimanenti](#1-edge-functions-rimanenti)
2. [Servizi Esterni e API](#2-servizi-esterni-e-api)
3. [Stripe Integrazione Pagamenti](#3-stripe-integrazione-pagamenti)
4. [Sicurezza e Compliance](#4-sicurezza-e-compliance)
5. [Build e Deploy App Stores](#5-build-e-deploy-app-stores)
6. [Monitoring e Analytics](#6-monitoring-e-analytics)
7. [Legal e Privacy](#7-legal-e-privacy)
8. [Testing Pre-Lancio](#8-testing-pre-lancio)

---

## 1. EDGE FUNCTIONS RIMANENTI

### ✅ Già tradotte (IT/EN/ES/PT):
- `monthly-summary` - Riassunto mensile AI
- `analyze-patterns` - Pattern AI e suggerimenti
- `extract-job` - Estrazione dati da testo lavoro
- `suggest-quote` - Generazione bozza preventivo
- `suggest-price-list` - Generazione listino base

### 🔶 Da tradurre (priorità media):
- `classify-inbox-item` - Classifica item inbox
- `extract-invoice` - Estrae dati da fattura passiva
- `suggest-default-templates` - Genera template standard
- `extract-template` - Estrae template da file

### 🔵 Funzioni non AI (già OK):
- `generate-pdf` - Generazione PDF
- `transcribe` - Trascrizione Whisper
- `send-reminder` - Invio solleciti
- `stats-summary` - Statistiche
- `route-inbox-item` - Routing inbox
- `receive-email` - Ricevi email
- `receive-whatsapp` - Ricevi WhatsApp
- `check-anomalies` - Controllo anomalie

### 📝 TODO:
```bash
# Per ogni funzione da tradurre:
1. Aggiungere parametro `locale = "it"` all'input
2. Creare oggetto `prompts: Record<string, string>` con IT/EN/ES/PT
3. Usare `const prompt = prompts[locale] || prompts.it;`
4. Testare con tutti e 4 i locale
5. Deploy: `supabase functions deploy <nome-funzione>`
```

---

## 2. SERVIZI ESTERNI E API

### 🔑 API Keys Necessarie

#### ✅ Già configurate:
- **Anthropic Claude API** - AI features (già in uso)
- **Supabase** - Database, Auth, Storage (già in uso)

#### 🆕 Da configurare:

1. **OpenAI API** (per Whisper STT)
   - URL: https://platform.openai.com/
   - Cost: ~$0.006 per minuto di audio
   - Setup:
     ```bash
     # In Supabase Edge Function secrets
     supabase secrets set OPENAI_API_KEY=sk-...
     ```
   - Usato in: `transcribe` Edge Function

2. **Resend** (Email transazionale)
   - URL: https://resend.com/
   - Cost: 3,000 email/mese gratis, poi $20/mese
   - Setup:
     ```bash
     supabase secrets set RESEND_API_KEY=re_...
     ```
   - Usato in: `send-reminder`, `receive-email`
   - Features: Invia PDF fatture, solleciti, notifiche

3. **Twilio** (WhatsApp Business API) - OPZIONALE
   - URL: https://www.twilio.com/
   - Cost: Pay-as-you-go (~$0.005 per messaggio)
   - Setup:
     ```bash
     supabase secrets set TWILIO_ACCOUNT_SID=AC...
     supabase secrets set TWILIO_AUTH_TOKEN=...
     supabase secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+...
     ```
   - Usato in: `send-reminder`, `receive-whatsapp`
   - Alternative: Usare solo link WhatsApp (gratis, no API)

4. **Expo Push Notifications**
   - URL: https://expo.dev/
   - Cost: Gratis
   - Setup: Già incluso in Expo SDK
   - Usato per: Notifiche push native (preventivo accettato, fattura scaduta)

---

## 3. STRIPE INTEGRAZIONE PAGAMENTI

### 🎯 Scopo
Permettere agli artigiani di ricevere pagamenti online dai clienti e gestire abbonamenti app.

### 📦 Implementazione

#### Step 1: Account Stripe
1. Registrati su https://stripe.com/
2. Attiva account business (verifica identità)
3. Ottieni API keys:
   - **Publishable key**: `pk_live_...` (va nel client)
   - **Secret key**: `sk_live_...` (va in Edge Function)

#### Step 2: Stripe Connect (Pagamenti Artigiani)
- URL: https://stripe.com/connect
- Permette agli artigiani di ricevere pagamenti dai loro clienti
- Setup:
  ```typescript
  // In Edge Function: create-stripe-account
  import Stripe from 'stripe';
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  
  // Crea account Connect per artigiano
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'IT',
    email: artisan.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  
  // Genera onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://app.artigianoai.com/settings/billing',
    return_url: 'https://app.artigianoai.com/settings/billing?success=true',
    type: 'account_onboarding',
  });
  ```

#### Step 3: Payment Links (per fatture)
- Genera link di pagamento per ogni fattura
- Il cliente clicca il link, paga con carta
- Stripe trasferisce soldi all'artigiano (meno fee)
- Edge Function: `create-payment-link`
  ```typescript
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Fattura ${invoice.invoice_number}`,
          },
          unit_amount: invoice.total * 100, // centesimi
        },
        quantity: 1,
      },
    ],
    application_fee_amount: Math.round(invoice.total * 100 * 0.029), // 2.9% fee app
    transfer_data: {
      destination: artisan.stripe_account_id,
    },
  });
  ```

#### Step 4: Abbonamenti App (Subscription)
- 3 piani: Starter (€19/mese), Pro (€29/mese), Business (€49/mese)
- Edge Function: `create-subscription`
  ```typescript
  // Crea prodotti Stripe (una volta)
  const starterProduct = await stripe.products.create({
    name: 'ArtigianoAI Starter',
    description: 'Piano base per artigiani',
  });
  const starterPrice = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 1900, // €19.00
    currency: 'eur',
    recurring: { interval: 'month' },
  });
  
  // Crea subscription per artigiano
  const subscription = await stripe.subscriptions.create({
    customer: artisan.stripe_customer_id,
    items: [{ price: starterPrice.id }],
  });
  ```

#### Step 5: Webhooks
- Gestire eventi Stripe (pagamento ricevuto, abbonamento scaduto)
- Endpoint: `supabase/functions/stripe-webhook/index.ts`
  ```typescript
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers.get('stripe-signature')!,
    STRIPE_WEBHOOK_SECRET
  );
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Marca fattura come pagata
      break;
    case 'customer.subscription.deleted':
      // Downgrade account artigiano
      break;
  }
  ```

### 💰 Costi Stripe
- **Stripe Connect**: 2.9% + €0.25 per transazione
- **Platform fee**: Puoi aggiungere 1-3% come fee app
- **Abbonamenti**: 2.9% + €0.25 per rinnovo mensile

### 📝 Tabelle DB da aggiungere
```sql
-- Aggiungi a tabella artisans
ALTER TABLE artisans ADD COLUMN stripe_account_id TEXT;
ALTER TABLE artisans ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE artisans ADD COLUMN subscription_plan TEXT DEFAULT 'starter';
ALTER TABLE artisans ADD COLUMN subscription_status TEXT DEFAULT 'active';

-- Aggiungi a tabella invoices_active
ALTER TABLE invoices_active ADD COLUMN stripe_payment_link TEXT;
ALTER TABLE invoices_active ADD COLUMN stripe_payment_intent_id TEXT;
```

---

## 4. SICUREZZA E COMPLIANCE

### 🔒 Sicurezza Tecnica

#### Row Level Security (RLS) - Supabase
✅ Già implementato su tutte le tabelle, ma verifica:
```sql
-- Verifica RLS su ogni tabella
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

-- Deve ritornare 0 righe (tutte le tabelle devono avere RLS)
```

#### API Rate Limiting
- Implementare rate limiting su Edge Functions critiche
- Supabase include rate limiting base (100 req/sec)
- Per protezione extra, usa Cloudflare (gratuito)

#### Secrets Management
✅ Tutte le API keys devono essere in Supabase Secrets:
```bash
supabase secrets list  # Verifica secrets configurati
```

Mai hardcodare keys nel codice! ❌

#### HTTPS Ovunque
✅ Supabase e Expo usano HTTPS di default

### 📜 GDPR e Privacy

#### Privacy Policy (OBBLIGATORIA)
- Documento legale che spiega:
  - Quali dati raccogliamo (email, P.IVA, fatture)
  - Come li usiamo (gestione business artigiano)
  - Con chi li condividiamo (Stripe per pagamenti, Anthropic per AI)
  - Diritti utente (accesso, cancellazione, portabilità)
- Generatore: https://www.iubenda.com/en/privacy-policy-generator
- Cost: ~€27/anno
- Link deve essere in: Login, Register, Settings

#### Terms of Service
- Condizioni d'uso dell'app
- Responsabilità, limitazioni di garanzia
- Template: https://www.termsofservicegenerator.net/

#### Cookie Policy (se usi Analytics web)
- Se usi Google Analytics o altri tracker
- iubenda include anche cookie banner

#### Consent Management
- Aggiungi checkbox in registrazione:
  ```tsx
  [x] Accetto la Privacy Policy
  [x] Accetto i Termini di Servizio
  ```

### 🇮🇹 Compliance Italia (Fatturazione Elettronica)

#### SDI (Sistema di Interscambio)
- ✅ Già supportato: campo `sdi_code` nella tabella artisans
- L'artigiano inserisce il suo codice SDI (7 caratteri)
- Le fatture PDF includono il codice SDI

#### XML Fattura Elettronica
- OPZIONALE: Generare file XML FatturaPA
- Libreria: https://github.com/italia/fatturapa
- Edge Function: `generate-fattura-xml`
- Cost: Sviluppo custom ~8-10 ore lavoro

#### Conservazione Sostitutiva
- OBBLIGATORIA: Conservare fatture per 10 anni
- Soluzione: Storage Supabase (incluso)
- Backup automatici Supabase (già attivi)

---

## 5. BUILD E DEPLOY APP STORES

### 📱 Apple App Store

#### Requisiti
1. **Apple Developer Account**
   - Cost: $99/anno
   - URL: https://developer.apple.com/
   - Tempo: ~2-3 giorni verifica identità

2. **App Store Connect**
   - Crea App ID: `com.artigianoai.app`
   - Carica screenshots (6.7", 6.5", 5.5")
   - Privacy Nutrition Label (dettagli dati raccolti)

3. **Build con EAS**
   ```bash
   # Installa EAS CLI
   npm install -g eas-cli
   
   # Login Expo account
   eas login
   
   # Configura progetto
   eas build:configure
   
   # Build iOS production
   eas build --platform ios --profile production
   
   # Submit ad App Store
   eas submit --platform ios
   ```

4. **eas.json config**
   ```json
   {
     "build": {
       "production": {
         "ios": {
           "bundleIdentifier": "com.artigianoai.app",
           "buildNumber": "1",
           "distribution": "store"
         }
       }
     },
     "submit": {
       "production": {
         "ios": {
           "appleId": "your@email.com",
           "ascAppId": "123456789",
           "appleTeamId": "ABC123"
         }
       }
     }
   }
   ```

5. **App Review Guidelines**
   - Non crashare ❌
   - Privacy Policy presente ✅
   - Funzionalità demo per reviewer
   - Account test: test@artigianoai.it / password demo

#### Timeline
- Build: ~15-30 minuti
- Review Apple: 1-3 giorni lavorativi
- Approval → App live: ~24 ore

### 🤖 Google Play Store

#### Requisiti
1. **Google Play Console Account**
   - Cost: $25 (una tantum)
   - URL: https://play.google.com/console/

2. **Build Android**
   ```bash
   # Build Android production
   eas build --platform android --profile production
   
   # Submit a Play Store
   eas submit --platform android
   ```

3. **eas.json config Android**
   ```json
   {
     "build": {
       "production": {
         "android": {
           "package": "com.artigianoai.app",
           "versionCode": 1,
           "buildType": "app-bundle"
         }
       }
     },
     "submit": {
       "production": {
         "android": {
           "serviceAccountKeyPath": "./google-service-account.json",
           "track": "production"
         }
       }
     }
   }
   ```

4. **Google Play Listing**
   - Screenshots (min 2, max 8)
   - Feature graphic (1024x500px)
   - App icon (512x512px)
   - Privacy Policy URL
   - Content rating questionnaire

#### Timeline
- Build: ~10-20 minuti
- Review Google: ~1-3 giorni
- Approval → App live: ~1 ora

### 🖼️ Assets Necessari

#### App Icon
- **iOS**: 1024x1024px PNG (no alpha)
- **Android**: 1024x1024px PNG
- Tool: https://www.appicon.co/

#### Splash Screen
- Expo gestisce automaticamente con `app.json`
- Image: 1242x2436px (iPhone 13 Pro Max)

#### Screenshots
- Usa simulator/emulator per fare screenshot
- Tool: https://www.screely.com/ (aggiungi device frame)
- Necessari:
  - iPhone 6.7" (iPhone 14 Pro Max): 1290x2796px
  - iPhone 6.5" (iPhone 11 Pro Max): 1242x2688px
  - Android: 1080x1920px

### 🔄 Updates OTA (Over-The-Air)
Expo supporta update senza rifare submit agli store:
```bash
# Publish update
eas update --branch production --message "Fix bug fatture"
```
- Limitazioni: Solo JS/TypeScript
- Modifiche native richiedono nuovo build + submit

---

## 6. MONITORING E ANALYTICS

### 📊 Analytics

#### Expo Analytics (Gratis)
- URL: https://expo.dev/
- Include:
  - Crash reports
  - Performance metrics
  - Update statistics
- Setup: Già incluso in Expo

#### Sentry (Crash Reporting)
- URL: https://sentry.io/
- Cost: Gratis fino a 5k eventi/mese
- Setup:
  ```bash
  npm install @sentry/react-native
  eas build:configure
  ```
  ```typescript
  // app/_layout.tsx
  import * as Sentry from '@sentry/react-native';
  
  Sentry.init({
    dsn: 'https://...@sentry.io/...',
    environment: __DEV__ ? 'development' : 'production',
  });
  ```

#### PostHog (Product Analytics) - OPZIONALE
- URL: https://posthog.com/
- Cost: Gratis fino a 1M eventi/mese
- Features: Funnels, session replay, feature flags
- Setup:
  ```bash
  npm install posthog-react-native
  ```

### 🔔 Uptime Monitoring

#### Better Stack (ex Better Uptime)
- URL: https://betterstack.com/
- Cost: Gratis fino a 3 monitors
- Monitor:
  - Supabase API: `https://<project>.supabase.co/rest/v1/`
  - Edge Functions: `https://<project>.supabase.co/functions/v1/health`
- Alert via email/Slack se down

### 📈 Database Monitoring
- Supabase Dashboard include:
  - Query performance
  - Database size
  - Connection pooling
  - Automatic backups

---

## 7. LEGAL E PRIVACY

### 📄 Documenti Necessari

1. **Privacy Policy** ✅ OBBLIGATORIO
   - Usa iubenda.com (~€27/anno)
   - Include: GDPR, Cookie Policy
   - Aggiungi link in app (footer login/register)

2. **Terms of Service** ✅ OBBLIGATORIO
   - Condizioni d'uso app
   - Generatore: termsofservicegenerator.net (gratis)

3. **EULA** (End User License Agreement) - OPZIONALE
   - Richiesto da Apple per app a pagamento/subscription
   - Template: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

### 🍪 Cookie e Tracking

Se usi Google Analytics o altri tracker WEB (non nell'app mobile):
- Cookie banner OBBLIGATORIO (GDPR)
- iubenda include cookie solution

### 📧 Email Marketing

Se invii newsletter/marketing (oltre a notifiche transazionali):
- Serve consenso esplicito opt-in
- Link unsubscribe in ogni email
- Usa Resend o Mailchimp con compliance GDPR

---

## 8. TESTING PRE-LANCIO

### ✅ Checklist Finale

#### Funzionalità Core
- [ ] Registrazione + Onboarding completo
- [ ] Creazione lavoro (voce + testo + foto)
- [ ] Generazione preventivo AI
- [ ] Conversione preventivo → fattura
- [ ] Solleciti pagamento
- [ ] Upload fattura passiva
- [ ] Statistiche e dashboard
- [ ] Export CSV per commercialista
- [ ] Cambio lingua IT/EN/ES/PT funziona ovunque

#### AI Features
- [ ] Tutti i prompt AI funzionano in 4 lingue
- [ ] Trascrizione vocale Whisper (se implementato)
- [ ] Riassunto mensile AI in tutte le lingue
- [ ] Pattern AI e suggerimenti localizzati

#### Stripe (se implementato)
- [ ] Onboarding Stripe Connect artigiano
- [ ] Generazione payment link fattura
- [ ] Pagamento test funziona
- [ ] Webhook Stripe riceve eventi
- [ ] Abbonamento mensile funziona

#### Mobile Native
- [ ] Fotocamera funziona (iOS + Android)
- [ ] Microfono funziona (iOS + Android)
- [ ] Notifiche push funzionano
- [ ] Share PDF via WhatsApp/Email
- [ ] App non crasha su orientamento schermo
- [ ] Keyboard avoiding view funziona

#### Performance
- [ ] App si carica < 3 secondi
- [ ] Liste scorrevoli smooth (no lag)
- [ ] Immagini optimizzate (expo-image)
- [ ] Bundle size < 50MB

#### Sicurezza
- [ ] Nessuna API key nel codice client
- [ ] RLS attivo su tutte le tabelle Supabase
- [ ] HTTPS su tutte le chiamate
- [ ] Password hash (Supabase Auth già lo fa)

#### Legal
- [ ] Privacy Policy linkata in app
- [ ] Terms of Service linkati in app
- [ ] Checkbox consenso in registrazione
- [ ] Email di benvenuto con link privacy

#### Testing Utenti Beta
- [ ] TestFlight iOS (max 100 beta tester)
- [ ] Google Play Internal Testing (max 100 tester)
- [ ] Raccogliere feedback
- [ ] Fixare bug critici

### 🧪 Test Accounts
Crea account demo con dati realistici:
- `test@artigianoai.it` / `Test123!`
- Dati: 10 lavori, 5 preventivi, 3 fatture
- Per reviewer App Store/Play Store

---

## 📊 RIEPILOGO COSTI MENSILI

| Servizio | Piano | Costo/mese | Note |
|----------|-------|------------|------|
| **Supabase** | Pro | $25 | Database + Auth + Storage + Edge Functions |
| **Anthropic Claude API** | Pay-as-go | ~$50-200 | Dipende da utilizzo AI features |
| **OpenAI Whisper API** | Pay-as-go | ~$10-30 | Solo se usi voice-to-text |
| **Resend** | Free/Pro | $0-20 | 3k email gratis, poi $20 |
| **Twilio WhatsApp** | Pay-as-go | $0-50 | OPZIONALE, solo se serve API |
| **Stripe** | % fee | ~2.9% | 2.9% + €0.25 per transazione |
| **iubenda Privacy** | Basic | ~€2 | ~€27/anno = ~€2/mese |
| **Sentry** | Free | $0 | Gratis fino 5k errori/mese |
| **Expo** | Free | $0 | Gratis, EAS Build $29/mese OPZIONALE |
| **Apple Developer** | Annual | ~€8 | $99/anno = ~€8/mese |
| **Google Play** | One-time | €0 | $25 una tantum |

**Totale minimo**: ~€100-150/mese  
**Totale con tutte le features**: ~€200-300/mese

---

## 🚀 PROSSIMI STEP CONSIGLIATI

### Settimana 1-2: Completamento Features
1. ✅ Tradurre Edge Functions rimanenti (ES/PT)
2. 🔧 Implementare Stripe Connect + Payment Links
3. 🔧 Configurare Resend per email transazionali
4. 🔧 Setup notifiche push Expo

### Settimana 3-4: Legal e Sicurezza
1. 📄 Creare Privacy Policy con iubenda
2. 📄 Creare Terms of Service
3. 🔒 Audit completo RLS Supabase
4. 🔒 Setup Sentry crash reporting

### Settimana 5-6: Build e Testing
1. 📱 Build iOS production con EAS
2. 🤖 Build Android production con EAS
3. 🧪 Beta testing con TestFlight (iOS)
4. 🧪 Internal testing Play Store (Android)
5. 🐛 Fix bug dai beta tester

### Settimana 7-8: Launch
1. 📸 Creare screenshots professionali
2. ✍️ Scrivere App Store description (4 lingue)
3. 🚀 Submit Apple App Store
4. 🚀 Submit Google Play Store
5. 📣 Marketing e comunicazione lancio

**Timeline totale**: ~8 settimane per launch completo

---

## 📞 SUPPORTO

Per domande specifiche:
- **Expo**: https://docs.expo.dev/
- **Supabase**: https://supabase.com/docs
- **Stripe**: https://stripe.com/docs
- **App Store**: https://developer.apple.com/app-store/review/guidelines/

---

**Ultimo aggiornamento**: Febbraio 2026  
**Versione**: 1.0  
**Status**: Production-Ready Roadmap
