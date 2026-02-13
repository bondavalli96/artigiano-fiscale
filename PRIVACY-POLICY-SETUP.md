# Privacy Policy Setup — ArtigianoAI

## Why This is Required

Both Apple App Store and Google Play Store **require** a privacy policy for apps that:
- Collect personal data (email, phone, name)
- Store financial information (invoices, payments)
- Use authentication
- Access device features (camera, microphone, notifications)

ArtigianoAI does all of the above, so a privacy policy is **mandatory**.

---

## What Data We Collect

### Personal Information
- **Identity:** Name, business name, fiscal code, VAT number
- **Contact:** Email, phone, address
- **Financial:** Invoice data, payment information (via Stripe)
- **Authentication:** User ID, session tokens

### Usage Data
- **Photos:** Job site photos (stored in Supabase Storage)
- **Voice Recordings:** Job descriptions (transcribed via Whisper)
- **Documents:** Uploaded invoices, PDFs

### Device Data
- **Expo Push Token:** For notifications
- **Device ID:** For app functionality

### Third-Party Services
- **Supabase:** Database and authentication
- **Stripe:** Payment processing
- **Resend:** Email delivery
- **Anthropic Claude:** AI processing
- **OpenAI Whisper:** Speech-to-text
- **Expo:** Push notifications and app services

---

## Recommended Solution: iubenda

**Why iubenda?**
- Specialized in GDPR compliance
- Generates legally-compliant policies
- Supports multiple languages (IT/EN/ES/PT)
- Auto-updates when laws change
- Designed for SaaS/mobile apps

**Cost:** ~€27/year for basic plan

---

## Step-by-Step Setup

### 1. Create iubenda Account

1. Go to: https://www.iubenda.com/en
2. Click **"Generate a Privacy Policy"**
3. Sign up with email
4. Choose **"Mobile App"** as product type

### 2. Configure Your Policy

#### Basic Information
- **App Name:** ArtigianoAI
- **Company/Individual:** Your business name
- **Website:** https://artigianoai.it
- **Country:** Italy (primary market)

#### Services to Add

Search and add these services in iubenda's database:

**Authentication & Backend:**
- ✅ **Supabase** (Authentication, Database)
  - Data: Email, user ID, profile data
  - Purpose: User authentication and data storage

**Payment Processing:**
- ✅ **Stripe** (Payment Processing)
  - Data: Payment information, invoices
  - Purpose: Process online payments
  - Privacy policy URL: https://stripe.com/privacy

**Email:**
- ✅ **Resend** (Transactional Emails)
  - Data: Email address
  - Purpose: Send invoices, quotes, reminders

**AI Services:**
- ✅ **Anthropic Claude API** (AI Processing)
  - Data: Text input, voice transcriptions
  - Purpose: Generate quotes, summaries, invoice extraction
  - Note: Data not used for training (per Anthropic policy)

- ✅ **OpenAI Whisper API** (Speech Recognition)
  - Data: Voice recordings
  - Purpose: Transcribe job descriptions
  - Note: Check current OpenAI data retention policy

**Mobile Services:**
- ✅ **Expo Push Notifications**
  - Data: Push token, device ID
  - Purpose: Send payment notifications, quote updates

**Device Permissions:**
- ✅ **Camera** (expo-image-picker)
  - Purpose: Take photos of job sites
  - Storage: Supabase Storage

- ✅ **Microphone** (expo-av)
  - Purpose: Record voice job descriptions
  - Storage: Temporary (deleted after transcription)

- ✅ **Notifications** (expo-notifications)
  - Purpose: Payment alerts, quote acceptance

#### Data Collection Purposes

Mark these purposes in iubenda:
- ✅ Providing the service (core functionality)
- ✅ Managing payments
- ✅ Sending notifications
- ✅ Customer support
- ✅ Analytics and statistics
- ✅ Legal compliance (tax documents)

#### User Rights (GDPR)

Enable these rights:
- ✅ Access personal data
- ✅ Rectification (edit data)
- ✅ Erasure (delete account)
- ✅ Data portability (export data)
- ✅ Withdraw consent
- ✅ Lodge a complaint with supervisory authority

### 3. Configure Languages

iubenda supports automatic translation:
- ✅ Italian (primary)
- ✅ English
- ✅ Spanish
- ✅ Portuguese

Enable all 4 languages for your policy.

### 4. Generate and Publish

1. Review the generated policy
2. Customize any sections if needed
3. Click **"Publish"**
4. Copy the policy URLs (one per language)

**Example URLs:**
```
IT: https://www.iubenda.com/privacy-policy/12345678
EN: https://www.iubenda.com/privacy-policy/12345678/en
ES: https://www.iubenda.com/privacy-policy/12345678/es
PT: https://www.iubenda.com/privacy-policy/12345678/pt
```

---

## Integration in the App

### 1. Add Links to Settings Screen

**app/(tabs)/settings/index.tsx:**

```typescript
import { Linking } from 'react-native';
import { List } from 'react-native-paper';

const PRIVACY_POLICY_URLS = {
  it: 'https://www.iubenda.com/privacy-policy/YOUR_ID',
  en: 'https://www.iubenda.com/privacy-policy/YOUR_ID/en',
  es: 'https://www.iubenda.com/privacy-policy/YOUR_ID/es',
  pt: 'https://www.iubenda.com/privacy-policy/YOUR_ID/pt',
};

export default function SettingsScreen() {
  const locale = useLocale(); // Your locale hook

  const openPrivacyPolicy = () => {
    const url = PRIVACY_POLICY_URLS[locale] || PRIVACY_POLICY_URLS.it;
    Linking.openURL(url);
  };

  return (
    <List.Section>
      <List.Item
        title="Privacy Policy"
        left={() => <List.Icon icon="shield-check" />}
        onPress={openPrivacyPolicy}
        right={() => <List.Icon icon="open-in-new" />}
      />
    </List.Section>
  );
}
```

### 2. Add to Registration Flow

**app/(auth)/register.tsx:**

```typescript
import { Checkbox, Text } from 'react-native-paper';

export default function RegisterScreen() {
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  return (
    <View>
      {/* ... registration form */}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
        <Checkbox
          status={acceptedPrivacy ? 'checked' : 'unchecked'}
          onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
        />
        <Text>
          Accetto la{' '}
          <Text
            style={{ color: '#3b82f6', textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URLS.it)}
          >
            Privacy Policy
          </Text>
        </Text>
      </View>

      <Button
        mode="contained"
        disabled={!acceptedPrivacy}
        onPress={handleRegister}
      >
        Registrati
      </Button>
    </View>
  );
}
```

### 3. Add to App Store Listings

**In app.json:**

```json
{
  "expo": {
    "ios": {
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "extra": {
      "privacyPolicyUrl": "https://www.iubenda.com/privacy-policy/YOUR_ID"
    }
  }
}
```

**In App Store Connect:**
- App Privacy → Privacy Policy URL: `https://www.iubenda.com/privacy-policy/YOUR_ID`

**In Google Play Console:**
- App content → Privacy policy → URL: `https://www.iubenda.com/privacy-policy/YOUR_ID`

---

## GDPR Compliance Checklist

### ✅ Data Subject Rights

Implement in app:

**1. Access Data (Export):**
```typescript
// In settings screen
const exportData = async () => {
  const { data: artisan } = await supabase
    .from('artisans')
    .select('*, clients(*), jobs(*), quotes(*), invoices_active(*)')
    .single();

  // Convert to JSON and share
  await Share.share({
    message: JSON.stringify(artisan, null, 2),
    title: 'I tuoi dati ArtigianoAI',
  });
};
```

**2. Delete Account:**
```typescript
const deleteAccount = async () => {
  Alert.alert(
    'Elimina Account',
    'Questa azione è irreversibile. Tutti i tuoi dati saranno eliminati permanentemente.',
    [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          // Delete from Supabase (cascades to all tables)
          await supabase.from('artisans').delete().eq('user_id', userId);
          await supabase.auth.signOut();
        },
      },
    ]
  );
};
```

**3. Edit Data:**
All data is already editable in the app (profile, clients, jobs, etc.)

### ✅ Data Retention

Add to privacy policy:
- **User data:** Retained until account deletion
- **Voice recordings:** Deleted after transcription (temporary)
- **Photos:** Retained until user deletes job
- **Invoices:** Retained for 10 years (Italian tax law requirement)
- **Backups:** 30-day rolling backups

### ✅ Data Security

Already implemented:
- ✅ RLS policies (data isolation)
- ✅ HTTPS/TLS encryption
- ✅ Supabase Auth (secure tokens)
- ✅ No sensitive data in client code
- ✅ Stripe PCI DSS compliance

### ✅ Third-Party Data Sharing

Declare in policy:
- **Stripe:** Payment processing (PCI DSS compliant)
- **Anthropic:** AI processing (data not used for training)
- **OpenAI:** Speech transcription (check retention policy)
- **Resend:** Email delivery (transactional only)

### ✅ Cookies (Web Only)

If you have a web version:
- Session cookies (authentication)
- No tracking cookies
- No third-party marketing cookies

---

## Alternative: DIY Privacy Policy

If you don't want to use iubenda, you can generate a policy using free tools:

### Free Generators
1. **TermsFeed:** https://www.termsfeed.com/privacy-policy-generator/
2. **FreePrivacyPolicy:** https://www.freeprivacypolicy.com/
3. **GetTerms:** https://getterms.io/

**⚠️ Warning:** Free generators may not be GDPR-compliant or updated with latest regulations. Not recommended for production.

### DIY Template

Minimum sections required:
1. **Introduction:** What data you collect and why
2. **Legal Basis:** GDPR Article 6(1)(b) - contract performance
3. **Data Types:** List all personal data collected
4. **Third Parties:** List Supabase, Stripe, Anthropic, etc.
5. **User Rights:** Access, rectification, erasure, portability
6. **Data Security:** Encryption, RLS, secure storage
7. **Retention:** How long you keep data
8. **Contact:** Your email for privacy inquiries
9. **Updates:** How you notify users of policy changes

---

## Store Submission Requirements

### Apple App Store

**App Privacy → Data Types:**
- ✅ **Contact Info:** Email, phone
- ✅ **Financial Info:** Payment info (via Stripe)
- ✅ **User Content:** Photos, voice, documents
- ✅ **Identifiers:** User ID

**Data Linked to User:**
- All of the above

**Data Used to Track You:**
- None

**Privacy Policy URL:**
- Required before submission

### Google Play Store

**Data safety section:**
- ✅ **Personal info:** Name, email, address
- ✅ **Financial info:** Payment info
- ✅ **Photos and videos:** User photos
- ✅ **Audio files:** Voice recordings

**Data sharing:**
- Yes (with Stripe, Anthropic, OpenAI, Resend)

**Data security:**
- ✅ Encrypted in transit
- ✅ Encrypted at rest (Supabase)
- ✅ Users can request deletion

---

## Testing Before Submission

### 1. Verify Links Work
Test privacy policy URL in browser for all languages.

### 2. Test Export Data
Ensure export function works and returns all user data.

### 3. Test Delete Account
Verify account deletion removes all data (test in staging).

### 4. Review Policy Accuracy
Ensure policy matches actual app behavior (don't over-promise).

---

## Maintenance

### When to Update Policy

Update your privacy policy when:
- ✅ Adding new third-party services
- ✅ Collecting new types of data
- ✅ Changing data retention periods
- ✅ Adding new features (e.g., analytics)
- ✅ Laws change (iubenda auto-updates)

### User Notification

When you update the policy:
1. Show in-app notification
2. Require re-acceptance for major changes
3. Send email to all users (via Resend)

**Example:**
```typescript
// In app/_layout.tsx
const checkPolicyVersion = async () => {
  const { data: artisan } = await supabase
    .from('artisans')
    .select('accepted_policy_version')
    .single();

  const CURRENT_POLICY_VERSION = '1.1'; // Update when policy changes

  if (artisan.accepted_policy_version !== CURRENT_POLICY_VERSION) {
    // Show modal requiring re-acceptance
    setShowPolicyUpdate(true);
  }
};
```

---

## Legal Disclaimer

**⚠️ This guide is not legal advice.**

For ArtigianoAI specifically:
- Consult a lawyer for GDPR compliance review
- Consider DPO (Data Protection Officer) if you process large volumes
- Check Italian tax law requirements for invoice retention
- Verify Stripe Connect merchant agreement compliance

---

## Support Contacts

**Privacy Inquiries:**
- Email: privacy@artigianoai.it
- Response time: 48 hours (GDPR requirement: 30 days)

**DPO (if required):**
- For apps with >250 employees or high-risk processing
- ArtigianoAI likely does not need a DPO

---

## Resources

- **iubenda:** https://www.iubenda.com/
- **GDPR Official Text:** https://gdpr-info.eu/
- **Italian Data Protection Authority:** https://www.garanteprivacy.it/
- **Apple Privacy Guidelines:** https://developer.apple.com/app-store/review/guidelines/#privacy
- **Google Play Data Safety:** https://support.google.com/googleplay/android-developer/answer/10787469

---

**Last Updated:** February 13, 2026
**Status:** ⏳ PENDING — Requires user action (iubenda setup)
**Estimated Time:** 2-3 hours
