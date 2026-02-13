# Expo Push Notifications Setup — ArtigianoAI

## Overview
Push notifications keep artisans informed about important events:
- Payment received
- Quote accepted by client
- Invoice overdue
- New inbox item received

## Prerequisites

1. **Expo Account**
   - Sign up at: https://expo.dev/
   - Project must be registered with EAS

2. **Physical Device**
   - Push notifications don't work on simulators/emulators
   - Need iOS device or Android device for testing

## Implementation

### 1. Install Dependencies

Already installed in the project:
```bash
npx expo install expo-notifications expo-device
```

### 2. Configure app.json

Push notification permissions already configured in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#3b82f6",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSUserNotificationsUsageDescription": "ArtigianoAI sends notifications for payments, quotes, and important updates."
      }
    },
    "android": {
      "permissions": [
        "POST_NOTIFICATIONS"
      ],
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### 3. Hook Implementation

Use `usePushNotifications` hook in root layout:

**app/_layout.tsx:**
```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function RootLayout() {
  const { expoPushToken, notification } = usePushNotifications();

  // Token is automatically saved to database
  // Notifications are automatically handled

  return (
    // ... your layout
  );
}
```

## Sending Push Notifications

### From Edge Functions

```typescript
// In any Edge Function (e.g., stripe-webhook, quote-accept)
const { data: artisan } = await supabase
  .from('artisans')
  .select('expo_push_token')
  .eq('id', artisanId)
  .single();

if (artisan?.expo_push_token) {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      pushToken: artisan.expo_push_token,
      title: 'Pagamento ricevuto! 💰',
      body: `La fattura ${invoiceNumber} è stata pagata`,
      data: {
        screen: 'invoices/active',
        invoiceId: invoice.id,
      },
    },
  });
}
```

### From Client

```typescript
import { supabase } from '@/lib/supabase';

const sendNotification = async () => {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      pushToken: 'ExponentPushToken[...]',
      title: 'Test Notification',
      body: 'This is a test',
      data: { test: true },
    },
  });
};
```

## Notification Scenarios

### 1. Payment Received

**Trigger:** Stripe webhook `payment_intent.succeeded`

```typescript
// In stripe-webhook/index.ts
await supabase.functions.invoke('send-push-notification', {
  body: {
    pushToken: artisan.expo_push_token,
    title: 'Pagamento ricevuto! 💰',
    body: `La fattura ${invoice.invoice_number} è stata pagata`,
    data: {
      screen: 'invoices/active',
      invoiceId: invoice.id,
    },
    badge: unreadCount + 1,
  },
});
```

### 2. Quote Accepted

**Trigger:** Client accepts quote via deep link

```typescript
// In quote-accept/[id].tsx after acceptance
await supabase.functions.invoke('send-push-notification', {
  body: {
    pushToken: artisan.expo_push_token,
    title: 'Preventivo accettato! ✅',
    body: `${client.name} ha accettato il preventivo ${quote.quote_number}`,
    data: {
      screen: 'quotes',
      quoteId: quote.id,
    },
  },
});
```

### 3. Invoice Overdue

**Trigger:** Scheduled function (daily at 9 AM)

```typescript
// In scheduled-reminders Edge Function
for (const invoice of overdueInvoices) {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      pushToken: artisan.expo_push_token,
      title: 'Fattura scaduta ⚠️',
      body: `La fattura ${invoice.invoice_number} è scaduta da ${daysOverdue} giorni`,
      data: {
        screen: 'invoices/active',
        invoiceId: invoice.id,
      },
    },
  });
}
```

### 4. New Inbox Item

**Trigger:** Email/WhatsApp received and classified

```typescript
// In receive-email or receive-whatsapp
await supabase.functions.invoke('send-push-notification', {
  body: {
    pushToken: artisan.expo_push_token,
    title: 'Nuovo messaggio ricevuto 📬',
    body: summary,
    data: {
      screen: 'inbox',
      inboxItemId: item.id,
    },
  },
});
```

## Deep Linking

Notifications automatically navigate to correct screen when tapped:

```typescript
// usePushNotifications hook handles navigation
responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data;

  if (data.screen === 'invoices/active' && data.invoiceId) {
    router.push(`/(tabs)/invoices/active/${data.invoiceId}`);
  }
  // ... other screens
});
```

## Testing

### 1. Test on Physical Device

```bash
# Run on iOS
npx expo run:ios --device

# Run on Android
npx expo run:android --device
```

### 2. Send Test Notification

Use Expo Push Notification Tool:
https://expo.dev/notifications

Or curl:
```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN]",
    "title": "Test",
    "body": "This is a test notification"
  }'
```

### 3. Verify Token Saved

Check database:
```sql
SELECT id, business_name, expo_push_token
FROM artisans
WHERE expo_push_token IS NOT NULL;
```

## Production Configuration

### iOS APNs Configuration

1. **Apple Developer Account**
   - Certificates, Identifiers & Profiles
   - Create Push Notification certificate
   - Download .p12 file

2. **Upload to Expo**
   ```bash
   eas credentials
   # Select iOS → Push Notifications
   # Upload .p12 file
   ```

3. **EAS Build**
   ```bash
   eas build --platform ios --profile production
   ```

### Android FCM Configuration

1. **Firebase Project**
   - Go to: https://console.firebase.google.com/
   - Create project: ArtigianoAI
   - Add Android app: `com.artigianoai.app`

2. **Get google-services.json**
   - Download from Firebase Console
   - Place in: `artigiano-app/google-services.json`
   - Add to .gitignore

3. **Upload to Expo**
   ```bash
   eas credentials
   # Select Android → FCM Server Key
   # Upload google-services.json
   ```

## Notification Permissions

### Request at Right Time

❌ **Bad:** Request immediately on app launch

✅ **Good:** Request after user sees value

**Example:**
```typescript
// After user completes onboarding
const { status } = await Notifications.requestPermissionsAsync();
if (status === 'granted') {
  // Register for push notifications
}
```

### Handle Denied Permissions

```typescript
if (status !== 'granted') {
  Alert.alert(
    'Notifiche Disabilitate',
    'Abilita le notifiche nelle impostazioni per ricevere aggiornamenti importanti.',
    [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Impostazioni', onPress: () => Linking.openSettings() },
    ]
  );
}
```

## Best Practices

### 1. Frequency
- Don't spam users
- Batch related notifications
- Respect quiet hours (10 PM - 8 AM)

### 2. Content
- Keep title under 40 characters
- Keep body under 100 characters
- Use emojis sparingly (1-2 max)
- Make action clear

### 3. Timing
- Send during business hours
- Immediate for urgent (payment received)
- Batched for non-urgent (daily summary)

### 4. Personalization
- Use client/invoice names
- Include amounts
- Relevant emojis

### 5. Analytics
- Track open rates
- A/B test copy
- Monitor opt-out rates

## Scheduled Notifications

For recurring notifications, use Supabase Cron:

**supabase/functions/scheduled-reminders/index.ts:**
```typescript
Deno.serve(async () => {
  // Run daily at 9 AM CET
  const overdueInvoices = await getOverdueInvoices();

  for (const invoice of overdueInvoices) {
    // Send push notification
    await sendPushNotification({
      pushToken: invoice.artisan.expo_push_token,
      title: 'Fattura scaduta',
      body: `Fattura ${invoice.invoice_number} scaduta`,
    });
  }
});
```

**Configure in Supabase Dashboard:**
```sql
SELECT cron.schedule(
  'daily-reminders',
  '0 9 * * *', -- Every day at 9 AM
  $$
  SELECT net.http_post(
    url := 'https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/scheduled-reminders',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
  );
  $$
);
```

## Troubleshooting

### Token not saving
- Check artisan table has expo_push_token column
- Verify RLS policies allow update
- Check network connectivity

### Notifications not received
- Verify device is physical (not simulator)
- Check permissions granted
- Validate token format
- Test with Expo tool first

### Navigation not working
- Check router paths match app structure
- Verify data passed correctly
- Add console.logs in response listener

### Production not working
- Verify APNs/FCM credentials uploaded
- Check EAS build includes notifications
- Test with production build, not Expo Go

## Resources

- Expo Notifications Docs: https://docs.expo.dev/push-notifications/overview/
- Push Notification Tool: https://expo.dev/notifications
- APNs Guide: https://developer.apple.com/documentation/usernotifications
- FCM Guide: https://firebase.google.com/docs/cloud-messaging

---

**Last Updated:** February 13, 2026
**Version:** 1.0
