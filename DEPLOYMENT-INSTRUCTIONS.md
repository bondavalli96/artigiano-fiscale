# Deployment Instructions — ArtigianoAI

## Edge Functions Deployment

### Prerequisites
Install Supabase CLI:
```bash
brew install supabase/tap/supabase
# OR
npm install -g supabase
```

Login to Supabase:
```bash
supabase login
```

Link to your project:
```bash
supabase link --project-ref zvmvrhdcjprlbqfzslhg
```

### Deploy All Functions

Deploy all Edge Functions at once:
```bash
# From artigiano-app directory
cd supabase/functions

# Deploy all functions
supabase functions deploy classify-inbox-item
supabase functions deploy extract-invoice
supabase functions deploy suggest-default-templates
supabase functions deploy extract-template
supabase functions deploy monthly-summary
supabase functions deploy analyze-patterns
supabase functions deploy extract-job
supabase functions deploy suggest-quote
supabase functions deploy suggest-price-list
supabase functions deploy transcribe
supabase functions deploy generate-pdf
supabase functions deploy send-reminder
supabase functions deploy stats-summary
supabase functions deploy route-inbox-item
supabase functions deploy receive-email
supabase functions deploy receive-whatsapp
supabase functions deploy check-anomalies
```

### Verify Deployment

Check function status:
```bash
supabase functions list
```

Test a function:
```bash
supabase functions serve classify-inbox-item
# Then test with curl or Postman
```

## Recently Updated Functions (Multilingual Support)

The following functions now support `locale` parameter (IT/EN/ES/PT):

1. **classify-inbox-item** — Updated Feb 13, 2026
   - Added multilingual prompts for IT/EN/ES/PT
   - User prompts translated
   - All AI responses now in correct locale

2. **extract-invoice** — Updated Feb 13, 2026
   - Multilingual extraction prompts
   - Localized warning messages (high amount, due dates, overdue)

3. **suggest-default-templates** — Updated Feb 13, 2026
   - Templates generated in correct language
   - Market-appropriate pricing per locale

4. **extract-template** — Updated Feb 13, 2026
   - Document analysis in multiple languages
   - Localized field names and instructions

### Testing Multilingual Functions

Test with different locales:
```bash
# Italian (default)
curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/classify-inbox-item \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"inboxItemId": "xxx", "locale": "it"}'

# English
curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/classify-inbox-item \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"inboxItemId": "xxx", "locale": "en"}'

# Spanish
curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/classify-inbox-item \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"inboxItemId": "xxx", "locale": "es"}'

# Portuguese
curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/classify-inbox-item \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"inboxItemId": "xxx", "locale": "pt"}'
```

## Secrets Management

Ensure all required secrets are set:
```bash
supabase secrets list

# Should include:
# - ANTHROPIC_API_KEY
# - OPENAI_API_KEY (optional, for Whisper)
# - GROQ_API_KEY (optional, for transcription)
# - DEEPGRAM_API_KEY (optional, for transcription)
# - RESEND_API_KEY (for emails)
# - STRIPE_SECRET_KEY (for payments)
# - STRIPE_WEBHOOK_SECRET (for Stripe webhooks)
```

Set a secret:
```bash
supabase secrets set RESEND_API_KEY=re_...
```

## Database Migrations

Apply pending migrations:
```bash
supabase migration list
supabase db push
```

## Manual Deployment Steps

If automatic deployment fails:

1. Go to Supabase Dashboard: https://app.supabase.com/project/zvmvrhdcjprlbqfzslhg
2. Navigate to Edge Functions
3. Create or update function
4. Copy/paste function code
5. Deploy

## Rollback

If deployment causes issues:
```bash
# Redeploy previous version
git checkout HEAD~1 supabase/functions/classify-inbox-item/index.ts
supabase functions deploy classify-inbox-item
```

---

**Last Updated:** February 13, 2026
**Version:** 1.0
