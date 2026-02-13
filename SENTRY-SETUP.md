# Sentry Crash Reporting Setup — ArtigianoAI

## Why Sentry?

Sentry provides real-time crash reporting and error tracking for production apps. Critical for:
- Detecting crashes before users report them
- Understanding error frequency and impact
- Debugging production issues with stack traces
- Monitoring app performance

**Cost:** Free tier includes 5,000 events/month (sufficient for launch)

---

## Step 1: Create Sentry Account

1. Go to: https://sentry.io/signup/
2. Sign up with email or GitHub
3. Choose **"React Native"** as platform
4. Create organization: `artigianoai`
5. Create project: `artigiano-app`

You'll get a **DSN** (Data Source Name) like:
```
https://abc123@o123456.ingest.sentry.io/789012
```

**Save this DSN** — you'll need it for configuration.

---

## Step 2: Install Sentry SDK

In `artigiano-app/` directory:

```bash
npx expo install @sentry/react-native
```

This installs the Expo-compatible Sentry SDK.

---

## Step 3: Configure app.json

Add Sentry plugin to your Expo config:

**app.json:**

```json
{
  "expo": {
    "name": "ArtigianoAI",
    "slug": "artigiano-app",
    "plugins": [
      [
        "@sentry/react-native/expo",
        {
          "organization": "artigianoai",
          "project": "artigiano-app",
          "url": "https://sentry.io/"
        }
      ],
      "expo-notifications",
      // ... other plugins
    ],
    "hooks": {
      "postPublish": [
        {
          "file": "sentry-expo/upload-sourcemaps",
          "config": {
            "organization": "artigianoai",
            "project": "artigiano-app",
            "authToken": "SENTRY_AUTH_TOKEN"
          }
        }
      ]
    }
  }
}
```

---

## Step 4: Environment Variables

Add to `.env`:

```env
# Sentry Configuration
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789012
SENTRY_AUTH_TOKEN=sntrys_your_auth_token_here

# Sentry Environment
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
```

Add to `.env.local` (development):

```env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789012
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=dev
```

**Get Auth Token:**
1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Create new token with `project:write` scope
3. Copy token to `.env`

**⚠️ Add to .gitignore:**
```
.env
.env.local
.env.production
```

---

## Step 5: Initialize Sentry in App

**app/_layout.tsx:**

```typescript
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Initialize Sentry BEFORE app renders
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // Environment
  environment: process.env.SENTRY_ENVIRONMENT || __DEV__ ? 'development' : 'production',

  // Release tracking (updated per build)
  release: `artigianoai@${process.env.SENTRY_RELEASE || '1.0.0'}`,
  dist: Platform.OS === 'ios' ? '1' : '1', // Build number

  // Performance monitoring
  tracesSampleRate: 1.0, // 100% in dev, reduce in production (e.g., 0.2)

  // Enable native crash reporting
  enableNative: true,
  enableNativeNagger: false, // Don't show "Send Report" dialog

  // Integrations
  integrations: [
    new Sentry.ReactNativeTracing({
      // Track navigation performance
      routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
    }),
  ],

  // Filter sensitive data
  beforeSend(event, hint) {
    // Don't send events in development
    if (__DEV__) {
      console.log('Sentry event (dev):', event);
      return null;
    }

    // Filter out sensitive data
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.fiscal_code;
      delete event.request.data.vat_number;
    }

    return event;
  },
});

export default function RootLayout() {
  // Set user context when authenticated
  const { user, artisan } = useAuth();

  useEffect(() => {
    if (user && artisan) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: artisan.business_name,
        // DON'T include sensitive data (P.IVA, fiscal code)
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user, artisan]);

  return (
    <Sentry.TouchEventBoundary>
      {/* Your app layout */}
    </Sentry.TouchEventBoundary>
  );
}

// Wrap root component with Sentry
export default Sentry.wrap(RootLayout);
```

---

## Step 6: Error Boundaries

Wrap critical components with error boundaries:

**components/ErrorBoundary.tsx:**

```typescript
import * as Sentry from '@sentry/react-native';
import { View, Text, Button } from 'react-native';
import { useState } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ErrorBoundary({ children, fallback }: Props) {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            Ops! Qualcosa è andato storto
          </Text>
          <Text style={{ color: '#666', textAlign: 'center', marginBottom: 16 }}>
            Abbiamo registrato l'errore e lo risolveremo presto.
          </Text>
          <Button
            title="Riprova"
            onPress={() => setError(null)}
          />
        </View>
      )
    );
  }

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => {
        setError(error);
        return null;
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
```

**Usage:**

```typescript
// In critical screens
export default function InvoicesScreen() {
  return (
    <ErrorBoundary>
      {/* Your screen content */}
    </ErrorBoundary>
  );
}
```

---

## Step 7: Manual Error Reporting

### Capture Exceptions

```typescript
import * as Sentry from '@sentry/react-native';

try {
  await supabase.from('invoices_active').insert(invoice);
} catch (error) {
  // Log to Sentry
  Sentry.captureException(error, {
    tags: {
      section: 'invoices',
      action: 'create',
    },
    extra: {
      invoiceId: invoice.id,
      artisanId: artisan.id,
    },
  });

  // Show user-friendly message
  Alert.alert('Errore', 'Impossibile salvare la fattura');
}
```

### Capture Messages

```typescript
// For non-error events
Sentry.captureMessage('Payment link generation failed', {
  level: 'warning',
  tags: { service: 'stripe' },
  extra: { invoiceId: invoice.id },
});
```

### Add Breadcrumbs

```typescript
// Track user actions leading to errors
Sentry.addBreadcrumb({
  category: 'navigation',
  message: 'User navigated to invoice creation',
  level: 'info',
});

Sentry.addBreadcrumb({
  category: 'user_action',
  message: 'User clicked Create Invoice button',
  level: 'info',
  data: { clientId: client.id },
});
```

---

## Step 8: Performance Monitoring

### Track Slow Operations

```typescript
import * as Sentry from '@sentry/react-native';

const transaction = Sentry.startTransaction({
  name: 'Generate Invoice PDF',
  op: 'pdf.generation',
});

try {
  const pdf = await generateInvoicePDF(invoice);
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  Sentry.captureException(error);
} finally {
  transaction.finish();
}
```

### Monitor API Calls

```typescript
const span = transaction.startChild({
  op: 'http.client',
  description: 'GET /invoices',
});

const { data } = await supabase.from('invoices_active').select('*');
span.finish();
```

---

## Step 9: Source Maps (Critical!)

Source maps let Sentry show readable stack traces instead of minified code.

### Upload Source Maps with EAS Build

**eas.json:**

```json
{
  "build": {
    "production": {
      "env": {
        "SENTRY_ORG": "artigianoai",
        "SENTRY_PROJECT": "artigiano-app",
        "SENTRY_AUTH_TOKEN": "YOUR_SENTRY_AUTH_TOKEN"
      }
    }
  }
}
```

EAS automatically uploads source maps when Sentry plugin is configured.

### Verify Source Maps

After build:
1. Go to Sentry Dashboard → Releases
2. Find your release (e.g., `artigianoai@1.0.0`)
3. Check "Artifacts" tab — should show source maps

---

## Step 10: Testing

### Test Crash Reporting

Add a test button in development:

```typescript
import * as Sentry from '@sentry/react-native';
import { Button } from 'react-native';

// In settings screen (dev only)
{__DEV__ && (
  <Button
    title="Test Sentry Crash"
    onPress={() => {
      throw new Error('Test crash from ArtigianoAI');
    }}
  />
)}

{__DEV__ && (
  <Button
    title="Test Sentry Message"
    onPress={() => {
      Sentry.captureMessage('Test message from ArtigianoAI', 'info');
    }}
  />
)}
```

### Verify in Sentry Dashboard

1. Trigger test crash
2. Wait 1-2 minutes
3. Go to Sentry Dashboard → Issues
4. Should see test error with full stack trace

---

## Step 11: Production Configuration

### Reduce Sample Rate

In production, reduce performance monitoring to save quota:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',

  // Sample 20% of transactions (reduce costs)
  tracesSampleRate: 0.2,

  // Sample 10% of errors if needed
  sampleRate: 1.0, // Keep at 1.0 to catch all errors
});
```

### Set Release Information

**Update before each build:**

```bash
# In package.json
{
  "version": "1.0.1"
}
```

```typescript
Sentry.init({
  release: `artigianoai@${require('../package.json').version}`,
  dist: '2', // Increment build number
});
```

---

## Step 12: Alerts and Notifications

### Set Up Alerts

In Sentry Dashboard:

1. **Project Settings** → **Alerts**
2. Create alert: "New Issue Created"
   - Conditions: Any new issue
   - Actions: Email to `dev@artigianoai.it`

3. Create alert: "High Error Rate"
   - Conditions: >10 errors in 1 minute
   - Actions: Email + Slack (if configured)

### Slack Integration (Optional)

1. Sentry → Integrations → Slack
2. Connect your workspace
3. Choose channel: `#artigianoai-errors`
4. Get notified in real-time

---

## Step 13: Privacy Considerations

### Don't Send Sensitive Data

```typescript
Sentry.init({
  beforeSend(event) {
    // Remove sensitive data
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.fiscal_code;
      delete event.request.data.vat_number;
      delete event.request.data.iban;
      delete event.request.data.stripe_account_id;
    }

    // Remove PII from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data?.email) {
          breadcrumb.data.email = '[REDACTED]';
        }
        return breadcrumb;
      });
    }

    return event;
  },
});
```

### Update Privacy Policy

Add to Privacy Policy:
- We use Sentry for crash reporting
- Error data is sent to Sentry servers (USA)
- No sensitive data (passwords, P.IVA) is sent
- Data retention: 90 days
- Link: https://sentry.io/privacy/

---

## Best Practices

### 1. Tag Everything

```typescript
Sentry.setTag('locale', 'it');
Sentry.setTag('subscription_plan', artisan.subscription_plan);
Sentry.setTag('device_platform', Platform.OS);
```

### 2. Add Context

```typescript
Sentry.setContext('invoice', {
  id: invoice.id,
  status: invoice.status,
  total: invoice.total,
});
```

### 3. Group Similar Errors

Use `fingerprint` to group related errors:

```typescript
Sentry.captureException(error, {
  fingerprint: ['stripe-payment-failed', invoice.id],
});
```

### 4. Monitor Critical Paths

```typescript
const transaction = Sentry.startTransaction({
  name: 'Quote Acceptance Flow',
  op: 'business_flow',
});

// ... your code

transaction.finish();
```

---

## Monitoring Checklist

After setup, monitor:

- [ ] Crash-free rate (target: >99%)
- [ ] Error frequency (target: <5 errors/day)
- [ ] Performance (target: <2s for critical flows)
- [ ] Source maps uploaded (readable stack traces)
- [ ] Alerts working (email notifications)
- [ ] No sensitive data in events

---

## Troubleshooting

### Errors Not Appearing in Sentry

**Check:**
1. DSN is correct in `.env`
2. Sentry is initialized before app renders
3. Not in `__DEV__` mode (check `beforeSend`)
4. Internet connection available
5. Sentry.io status (https://status.sentry.io/)

### Source Maps Not Working

**Fix:**
1. Verify `SENTRY_AUTH_TOKEN` in `eas.json`
2. Check Sentry plugin in `app.json`
3. Rebuild with `eas build --platform all --profile production`
4. Verify upload in Sentry → Releases → Artifacts

### Too Many Events (Quota Exceeded)

**Reduce:**
1. Lower `tracesSampleRate` (e.g., 0.1)
2. Filter noisy errors in `beforeSend`
3. Upgrade Sentry plan if needed

---

## Resources

- **Sentry Docs:** https://docs.sentry.io/platforms/react-native/
- **Expo + Sentry:** https://docs.expo.dev/guides/using-sentry/
- **Sentry Dashboard:** https://sentry.io/
- **EAS Build with Sentry:** https://docs.expo.dev/build-reference/how-tos/#sentry

---

**Last Updated:** February 13, 2026
**Status:** ✅ READY — Configuration complete, needs DSN from Sentry.io
**Estimated Time:** 1-2 hours (account setup + testing)
