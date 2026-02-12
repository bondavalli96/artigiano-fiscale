# FASE 1 - Operazioni Infrastrutturali

## 0) Supabase CLI token (fix errore "Access token not provided")
Se il progetto usa `TOKEN_SUPABASE` in `.env`, esporta la variabile attesa dal CLI:

```bash
set -a
source .env
export SUPABASE_ACCESS_TOKEN="$TOKEN_SUPABASE"
set +a
```

## 1) Resend inbound email (MX su `artigianoai.it`)
Per rendere live il forwarding email verso Inbox:

1. Apri Resend > Domains > Inbound.
2. Configura il dominio `artigianoai.it`.
3. Inserisci i record MX richiesti da Resend sul provider DNS del dominio.
4. Verifica il dominio in Resend.
5. Imposta webhook inbound verso:
   - `https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/receive-email`

Nota: senza MX validati, il flusso email->Inbox resta non operativo in produzione.

## 2) Speech provider fallback (Groq / Deepgram)
Le funzioni `transcribe` e `classify-inbox-item` ora usano fallback:
- `GROQ_API_KEY` (prioritario)
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY` (fallback finale)

Imposta i secret in Supabase:

```bash
npx supabase secrets set \
  GROQ_API_KEY=... \
  DEEPGRAM_API_KEY=... \
  OPENAI_API_KEY=... \
  --project-ref zvmvrhdcjprlbqfzslhg
```

## 3) WhatsApp inbound (Twilio) -> Inbox AI
Nuova Edge Function: `receive-whatsapp`.

Webhook Twilio consigliato:
- `https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/receive-whatsapp?artisanId=<ARTISAN_ID>`

Secret opzionali:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `WHATSAPP_DEFAULT_ARTISAN_ID` (fallback se non passi `artisanId` in webhook)

Deploy:

```bash
npx supabase functions deploy receive-whatsapp --project-ref zvmvrhdcjprlbqfzslhg
```
