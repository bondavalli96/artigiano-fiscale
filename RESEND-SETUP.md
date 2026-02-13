# Resend Email Setup — ArtigianoAI

## Overview
Resend is used for all transactional emails: payment reminders, quote notifications, invoice delivery.

## Prerequisites

1. **Resend Account**
   - Sign up at: https://resend.com/
   - Free tier: 3,000 emails/month
   - Pro: $20/month for 50,000 emails

2. **Domain Verification**
   - Add your domain: `artigianoai.it`
   - Verify DNS records

## Setup Steps

### 1. Create Resend Account

Go to https://resend.com/ and create an account.

### 2. Get API Key

1. Go to: API Keys
2. Click "Create API Key"
3. Name: `ArtigianoAI Production`
4. Permissions: Send emails
5. Copy the key: `re_...`

### 3. Set Supabase Secret

```bash
export SUPABASE_ACCESS_TOKEN=$TOKEN_SUPABASE
cd artigiano-app
supabase secrets set RESEND_API_KEY=re_...
```

### 4. Verify Domain (Production)

**Important:** For production emails to work reliably, you must verify your domain.

#### Add DNS Records to your domain registrar:

Go to: Domains → Add Domain → `artigianoai.it`

Resend will provide DNS records like:

**SPF Record:**
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

**DKIM Records:**
```
Type: TXT
Name: resend._domainkey
Value: [provided by Resend]
```

**DMARC Record:**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@artigianoai.it
```

**MX Records (for receiving emails - optional):**
```
Type: MX
Name: @
Value: mx1.resend.com (Priority: 10)
Value: mx2.resend.com (Priority: 20)
```

#### Verify Setup

After adding records (wait 5-10 minutes):
1. Go to Resend Dashboard → Domains
2. Click "Verify"
3. Status should show "Verified" ✓

### 5. Test Email Sending

Test from Edge Function:

```bash
curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/send-reminder \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"invoiceId": "test-invoice-id"}'
```

Or test directly with Resend API:

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_..." \
  -H "Content-Type: application/json" \
  -d '{
    "from": "ArtigianoAI <noreply@artigianoai.it>",
    "to": ["test@example.com"],
    "subject": "Test Email",
    "html": "<p>Test email from ArtigianoAI</p>"
  }'
```

## Email Templates

Professional HTML email templates are located in:
```
lib/email-templates/
├── reminder.html           # Payment reminder
├── quote-sent.html         # Quote notification
└── invoice-sent.html       # Invoice delivery
```

### Template Variables

Templates use Handlebars-style variables:

**reminder.html:**
- `{{artisan_name}}`
- `{{client_name}}`
- `{{invoice_number}}`
- `{{total}}`
- `{{due_date}}`
- `{{days_overdue}}`
- `{{reminder_message}}`
- `{{payment_link}}` (optional)
- `{{is_final_warning}}` (boolean)
- `{{artisan_email}}`
- `{{artisan_phone}}`

**quote-sent.html:**
- `{{artisan_name}}`
- `{{client_name}}`
- `{{quote_number}}`
- `{{job_title}}`
- `{{total}}`
- `{{valid_until}}`
- `{{accept_link}}`
- `{{pdf_link}}`
- `{{artisan_email}}`
- `{{artisan_phone}}`

**invoice-sent.html:**
- `{{artisan_name}}`
- `{{client_name}}`
- `{{invoice_number}}`
- `{{issue_date}}`
- `{{due_date}}`
- `{{total}}`
- `{{payment_link}}` (optional)
- `{{payment_methods}}` (HTML)
- `{{artisan_email}}`
- `{{artisan_phone}}`

## Edge Functions Using Resend

### 1. send-reminder
- **Purpose:** Payment reminders with adaptive tone
- **Triggers:**
  - Manual (from app)
  - Scheduled (daily cron at 9 AM)
- **Features:**
  - AI-generated message text
  - HTML email template
  - Tracks reminder count
  - Adjusts tone based on reminder number

### 2. send-quote (to create)
- **Purpose:** Send quote to client
- **Includes:** PDF attachment
- **CTA:** Accept link

### 3. send-invoice (to create)
- **Purpose:** Send invoice to client
- **Includes:** PDF attachment
- **CTA:** Payment link (if Stripe enabled)

## Implementation Example

### Update send-reminder to use HTML template

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read template
const templatePath = join(Deno.cwd(), '../lib/email-templates/reminder.html');
const template = readFileSync(templatePath, 'utf-8');

// Replace variables
let html = template
  .replace(/\{\{artisan_name\}\}/g, artisanName)
  .replace(/\{\{client_name\}\}/g, clientName)
  .replace(/\{\{invoice_number\}\}/g, invoiceNumber)
  .replace(/\{\{total\}\}/g, total.toFixed(2))
  .replace(/\{\{due_date\}\}/g, dueDate)
  .replace(/\{\{days_overdue\}\}/g, daysOverdue.toString())
  .replace(/\{\{reminder_message\}\}/g, reminderMessage);

// Send with Resend
await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RESEND_API_KEY}`,
  },
  body: JSON.stringify({
    from: "ArtigianoAI <noreply@artigianoai.it>",
    to: [clientEmail],
    subject: `Sollecito pagamento fattura ${invoiceNumber}`,
    html: html,
    // Optional: include PDF attachment
    attachments: [{
      filename: `fattura-${invoiceNumber}.pdf`,
      content: pdfBase64,
    }]
  }),
});
```

## Email Best Practices

### 1. Deliverability
- ✅ Verify domain with SPF/DKIM
- ✅ Use consistent "From" name
- ✅ Include unsubscribe link (for marketing)
- ✅ Keep HTML clean and simple
- ✅ Test spam score: https://www.mail-tester.com/

### 2. Content
- Keep subject lines under 50 characters
- Personalize with recipient name
- Clear call-to-action (CTA)
- Mobile-responsive design
- Plain text fallback

### 3. Timing
- **Reminders:** 9:00 AM local time
- **Invoices:** Immediately after generation
- **Quotes:** Within 24h of request

## Monitoring & Analytics

### Resend Dashboard

Track email performance:
- Delivery rate
- Open rate (if enabled)
- Bounce rate
- Complaint rate

### Webhooks (Optional)

Set up webhooks to track email events:

**Webhook URL:**
```
https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/resend-webhook
```

**Events:**
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.complained`

## Troubleshooting

### Emails not sending
1. Check API key is set: `supabase secrets list`
2. Verify domain status in Resend Dashboard
3. Check Edge Function logs: `supabase functions logs send-reminder`
4. Test with curl directly

### Emails going to spam
1. Verify SPF/DKIM records
2. Add DMARC policy
3. Use verified domain (not @resend.dev)
4. Check content for spam triggers
5. Warm up sending (start with low volume)

### Rate limits
- Free tier: 100 emails/day
- Pro tier: 50,000 emails/month
- Burst: 10 emails/second

If exceeded, upgrade plan or implement queue.

## Costs

**Free Tier:**
- 3,000 emails/month
- 100 emails/day
- 1 domain
- Email API only

**Pro Plan ($20/month):**
- 50,000 emails/month
- No daily limit
- 10 domains
- Email API + Webhooks
- Analytics

**Scale Plan ($80/month):**
- 300,000 emails/month
- Unlimited domains
- Priority support

## Migration from Development to Production

### Development (using @resend.dev)
```typescript
from: "ArtigianoAI <onboarding@resend.dev>"
```

### Production (using verified domain)
```typescript
from: "ArtigianoAI <noreply@artigianoai.it>"
```

**Steps:**
1. Verify domain in Resend
2. Update all Edge Functions to use production domain
3. Test with real email address
4. Monitor deliverability

## Security

1. **API Key Protection**
   - Never commit to git
   - Store in Supabase Secrets only
   - Rotate if compromised

2. **Email Content**
   - Sanitize user input
   - Escape HTML special characters
   - Validate recipient addresses

3. **Rate Limiting**
   - Implement per-user sending limits
   - Prevent abuse via API

## Resources

- Resend Docs: https://resend.com/docs
- Email Testing: https://www.mail-tester.com/
- HTML Email Guide: https://templates.mailchimp.com/
- Deliverability Guide: https://postmarkapp.com/guides/deliverability

---

**Last Updated:** February 13, 2026
**Version:** 1.0
