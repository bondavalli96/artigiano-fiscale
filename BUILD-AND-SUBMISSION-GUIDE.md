# Build and Submission Guide — ArtigianoAI

Complete guide for building and submitting ArtigianoAI to Apple App Store and Google Play Store.

---

## Table of Contents

1. [Pre-Build Checklist](#pre-build-checklist)
2. [EAS Build Setup](#eas-build-setup)
3. [Building for iOS](#building-for-ios)
4. [Building for Android](#building-for-android)
5. [TestFlight (iOS Beta)](#testflight-ios-beta)
6. [Google Play Internal Testing](#google-play-internal-testing)
7. [App Store Submission](#app-store-submission)
8. [Play Store Submission](#play-store-submission)
9. [Post-Submission](#post-submission)
10. [Troubleshooting](#troubleshooting)

---

## Pre-Build Checklist

Before building, ensure these are completed:

### Legal Requirements
- [ ] Privacy Policy created and hosted (see [PRIVACY-POLICY-SETUP.md](PRIVACY-POLICY-SETUP.md))
- [ ] Terms of Service created and hosted (see [TERMS-OF-SERVICE.md](TERMS-OF-SERVICE.md))
- [ ] Links added to app settings screen
- [ ] Acceptance required during registration

### Technical Requirements
- [ ] All Edge Functions deployed to Supabase
- [ ] Database migrations applied
- [ ] RLS policies verified (see [RLS-SECURITY-AUDIT.md](RLS-SECURITY-AUDIT.md))
- [ ] Sentry configured (see [SENTRY-SETUP.md](SENTRY-SETUP.md))
- [ ] Environment variables set in `.env`
- [ ] App tested on physical devices (iOS + Android)

### Content Requirements
- [ ] App icon created (1024x1024px)
- [ ] Screenshots prepared (6+ per platform, see below)
- [ ] App Store descriptions written (4 languages, see [APP-STORE-LISTINGS.md](APP-STORE-LISTINGS.md))
- [ ] Promotional text prepared
- [ ] What's New text prepared

### Accounts Required
- [ ] Apple Developer Account ($99/year) — https://developer.apple.com/
- [ ] Google Play Console ($25 one-time) — https://play.google.com/console/
- [ ] Expo EAS account (free tier OK for start) — https://expo.dev/

---

## EAS Build Setup

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Login to Expo

```bash
eas login
```

Enter your Expo credentials.

### 3. Configure Project

If not already done:

```bash
cd artigiano-app
eas build:configure
```

This creates/updates `eas.json`.

### 4. Set Environment Variables

Create `.env` file (don't commit):

```env
EXPO_PUBLIC_SUPABASE_URL=https://zvmvrhdcjprlbqfzslhg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ENVIRONMENT=production
```

### 5. Verify Configuration

```bash
cat eas.json
```

Ensure `production` profile is configured correctly (see `eas.json` in repo).

---

## Building for iOS

### Prerequisites

1. **Apple Developer Account**
   - Sign up: https://developer.apple.com/programs/
   - Cost: $99/year
   - Verify email and complete enrollment

2. **App Store Connect**
   - Create app: https://appstoreconnect.apple.com/
   - Bundle ID: `com.artigianoai.app`
   - Name: ArtigianoAI

### Build iOS (First Time)

```bash
eas build --platform ios --profile production
```

EAS will:
- Ask for Apple ID credentials
- Generate iOS certificates automatically
- Create provisioning profiles
- Build the app in the cloud

**Time:** 15-30 minutes

### Build iOS (Subsequent Builds)

```bash
eas build --platform ios --profile production --auto-submit
```

The `--auto-submit` flag uploads directly to App Store Connect.

### Download Build

If you didn't auto-submit:

```bash
eas build:list --platform ios
```

Find your build and download `.ipa` file.

### Manual Upload to App Store Connect

If needed:

```bash
eas submit --platform ios --latest
```

Or use Transporter app (macOS):
1. Download from Mac App Store
2. Drag `.ipa` file into Transporter
3. Click "Deliver"

---

## Building for Android

### Prerequisites

1. **Google Play Console Account**
   - Sign up: https://play.google.com/console/
   - Cost: $25 one-time
   - Verify identity

2. **Create App in Play Console**
   - Click "Create app"
   - Name: ArtigianoAI
   - Language: Italian (primary)
   - App/Game: App
   - Free/Paid: Free

### Build Android (First Time)

```bash
eas build --platform android --profile production
```

EAS will:
- Generate Android keystore automatically
- Build AAB (App Bundle)
- Store credentials securely

**Time:** 15-25 minutes

### Build Android (Subsequent Builds)

```bash
eas build --platform android --profile production --auto-submit
```

### Download Build

```bash
eas build:list --platform android
```

Download `.aab` file (App Bundle) for Play Store or `.apk` for testing.

### Manual Upload to Play Console

```bash
eas submit --platform android --latest
```

Or upload manually:
1. Go to Play Console → Release → Production
2. Click "Create new release"
3. Upload `.aab` file

---

## TestFlight (iOS Beta)

TestFlight allows beta testing before public release.

### 1. Upload to App Store Connect

```bash
eas build --platform ios --profile production --auto-submit
```

Or manually via Transporter.

### 2. Enable TestFlight

1. Go to App Store Connect
2. Select your app
3. Go to "TestFlight" tab
4. Select the uploaded build

### 3. Set Beta Information

- **Beta App Name:** ArtigianoAI
- **Beta App Description:** App per artigiani con AI
- **Feedback Email:** beta@artigianoai.it
- **Privacy Policy URL:** https://artigianoai.it/privacy
- **Test Information:**
  - Demo credentials (if needed)
  - Testing notes for reviewers

### 4. Add Internal Testers

- Add emails of your team
- They'll receive invitation via email
- Up to 100 internal testers (free)

### 5. Add External Testers (Optional)

- For public beta
- Requires App Store review first
- Create public link or invite by email
- Up to 10,000 external testers

### 6. Distribute

Click "Start Testing" — testers get notified via email.

### 7. Monitor Feedback

- TestFlight shows crash logs
- Testers can send feedback via TestFlight app
- Monitor in App Store Connect → TestFlight → Feedback

---

## Google Play Internal Testing

Similar to TestFlight for Android.

### 1. Create Internal Testing Track

1. Go to Play Console
2. Testing → Internal testing
3. Click "Create new release"

### 2. Upload Build

```bash
eas submit --platform android --latest --track internal
```

Or manually upload `.aab` in Play Console.

### 3. Set Release Information

- **Release name:** v1.0.0 (Beta)
- **Release notes:** Italian: "Prima versione beta per test interni"

### 4. Add Testers

- Create email list (up to 100 for internal testing)
- Add tester emails
- Save and review

### 5. Distribute

- Click "Save" → "Review release" → "Start rollout"
- Testers receive email with Play Store link

### 6. Monitor

- Play Console → Quality → Android vitals
- Crash reports
- ANR (App Not Responding) reports

---

## App Store Submission

After beta testing and fixes.

### 1. Prepare Store Listing

In App Store Connect:

#### App Information
- **Name:** ArtigianoAI - Preventivi & Fatture
- **Subtitle:** Gestione smart con AI per artigiani
- **Category:** Business (Primary), Productivity (Secondary)
- **Content Rights:** Include third-party content → Yes (AI-generated content)

#### Pricing and Availability
- **Price:** Free
- **In-App Purchases:** Yes (subscriptions)
- **Countries:** Italy, Spain, Portugal (initially)

#### App Privacy
Use privacy labels from [APP-STORE-LISTINGS.md](APP-STORE-LISTINGS.md):

- Contact Info: Email, Phone
- Financial Info: Payment Info
- User Content: Photos, Audio
- Identifiers: User ID

All data "linked to user" and "used to track user" = No.

#### Prepare for Submission
- **Screenshots:** 6.7" display (1290 x 2796px) — 6+ screenshots
- **App Preview (optional):** 30-second video
- **Description:** Use Italian version from APP-STORE-LISTINGS.md
- **Keywords:** fatture, preventivi, artigiano, AI, gestionale
- **Support URL:** https://artigianoai.it/support
- **Marketing URL:** https://artigianoai.it
- **Privacy Policy URL:** https://artigianoai.it/privacy

### 2. Add Subscriptions

1. **Features → In-App Purchases**
2. Create subscription groups
3. Add subscriptions:
   - **Starter:** €19/month
   - **Pro:** €29/month
   - **Business:** €49/month

4. For each subscription:
   - Product ID: `com.artigianoai.app.starter`
   - Reference Name: "Starter Plan"
   - Duration: 1 month
   - Price: €19
   - Localized description (IT/EN/ES/PT)

### 3. Submit Build

1. Go to "App Store" tab (not TestFlight)
2. Click "+ Version" → "1.0"
3. Select uploaded build from TestFlight
4. Fill in "What's New" text
5. Set age rating (4+)
6. Add reviewer notes (if needed)

### 4. Submit for Review

Click **"Submit for Review"**

Apple review process:
- **In Review:** 1-3 days typically
- **Rejection:** Fix issues and resubmit
- **Approved:** App goes live automatically (or on date you set)

### 5. Monitor Status

- Check App Store Connect daily
- Respond to rejection within 48 hours if needed
- Enable "Auto-Release" or set release date

---

## Play Store Submission

### 1. Complete Store Listing

In Play Console → Store presence → Main store listing:

#### App Details
- **App name:** ArtigianoAI - Fatture e Preventivi
- **Short description:** (80 chars) "App per artigiani: preventivi, fatture e gestione con AI"
- **Full description:** Use Italian version from APP-STORE-LISTINGS.md
- **App icon:** 512 x 512px PNG
- **Feature graphic:** 1024 x 500px

#### Screenshots
- **Phone:** 1080 x 1920px (minimum 2, max 8)
- **7-inch tablet (optional):** 1024 x 768px
- **10-inch tablet (optional):** 2048 x 1536px

#### Categorization
- **App category:** Business
- **Tags:** Invoicing, Productivity, Small Business

#### Contact Details
- **Email:** support@artigianoai.it
- **Website:** https://artigianoai.it
- **Phone:** +39 XXX XXX XXXX (optional)

#### Privacy Policy
- **URL:** https://artigianoai.it/privacy

### 2. Content Rating

Complete questionnaire:
- **Violence:** None
- **Sexual content:** None
- **Language:** None
- **Gambling:** No
- **User interaction:** No
- **Sensitive info:** Yes (personal info for business use)

Result: Rated for **Everyone**

### 3. App Content

#### Data Safety
- **Collects data:** Yes
- **Shares data:** Yes (with Stripe, Anthropic)
- **Data types:**
  - Personal info: Name, Email, Phone, Address
  - Financial info: Payment info
  - Photos and videos
  - Audio files
- **Security:**
  - Data encrypted in transit
  - Data encrypted at rest
  - Users can request deletion

#### Government Content
- Not a government app

#### COVID-19 Contact Tracing
- No

#### Data Deletion Instructions
- **URL:** https://artigianoai.it/support/delete-account
- Or: "Users can delete their account from Settings → Delete Account"

### 4. Set Up In-App Products

1. **Monetize → Products → Subscriptions**
2. Create subscription:
   - **Product ID:** `starter_monthly`
   - **Name:** Starter Plan
   - **Description:** Full access to ArtigianoAI features
   - **Price:** €19/month
3. Repeat for Pro (€29) and Business (€49)

### 5. Create Production Release

1. **Release → Production**
2. **Create new release**
3. Upload build (or submit via EAS)
4. **Release name:** 1.0.0
5. **Release notes (IT):**

```
Prima versione di ArtigianoAI!

✨ Novità:
• Preventivi e fatture con AI
• Registrazione vocale lavori
• Solleciti automatici
• Pagamenti online Stripe
• Dashboard statistiche

Grazie per il supporto! 🚀
```

6. Save → Review release

### 6. Submit for Review

Click **"Start rollout to Production"**

Google review process:
- **Under review:** 1-3 days
- **Rejection:** Fix and resubmit
- **Approved:** Live within hours

### 7. Rollout Options

- **Staged rollout:** Release to 20% of users, then increase
- **Full rollout:** Release to 100% immediately

Choose **Full rollout** for initial launch.

---

## Post-Submission

### Monitor Health

**iOS (App Store Connect):**
- Crashes: App Analytics → Crashes
- Reviews: Ratings and Reviews
- Sales: Sales and Trends

**Android (Play Console):**
- Crashes: Quality → Android vitals → Crashes
- ANRs: Quality → Android vitals → ANRs
- Reviews: User feedback → Reviews

### Respond to Reviews

- Respond within 48 hours
- Be professional and helpful
- Thank positive reviews
- Address negative reviews with solutions

### Monitor Sentry

- Check Sentry dashboard daily
- Fix high-priority errors
- Track crash-free rate (target: >99%)

### Release Updates

When bugs are fixed:

```bash
# Increment version in app.json
"version": "1.0.1"

# Build and submit
eas build --platform all --profile production --auto-submit
```

Update "What's New" with bug fixes list.

---

## Troubleshooting

### iOS Build Fails

**Error: Provisioning profile doesn't include signing certificate**

```bash
eas credentials --platform ios
```

Delete credentials and regenerate.

**Error: Bundle identifier is not available**

Change bundle ID in `app.json`:
```json
"ios": {
  "bundleIdentifier": "com.artigianoai.app.beta"
}
```

### Android Build Fails

**Error: Keystore not found**

```bash
eas credentials --platform android
```

Regenerate keystore.

**Error: Gradle build failed**

Check `android/app/build.gradle` for syntax errors.

### TestFlight Upload Fails

**Error: Missing compliance**

In App Store Connect → App Information:
- Export Compliance: No encryption (or provide documentation)

### Play Console Rejection

**Common reasons:**
- Missing privacy policy
- Incomplete data safety section
- App crashes on tester devices

**Fix:** Address issues in rejection email and resubmit.

### Sentry Source Maps Not Working

Ensure `SENTRY_AUTH_TOKEN` is set in `eas.json`:

```json
"env": {
  "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}"
}
```

And in your shell:

```bash
export SENTRY_AUTH_TOKEN=your-token
```

---

## Screenshots Guide

### Required Sizes

**iOS:**
- 6.7" display (iPhone 14 Pro Max): 1290 x 2796px
- 6.5" display (iPhone 11 Pro Max): 1242 x 2688px

**Android:**
- Phone: 1080 x 1920px (minimum)

### Suggested Screenshots

1. **Dashboard** — Financial overview with stats
2. **Voice Recording** — Recording a job description
3. **AI Quote** — Generated quote preview
4. **Invoice List** — Active invoices with status
5. **Client Management** — Client list
6. **AI Inbox** — Classified messages

### Tools

- **Figma:** Design mockups with app screenshots
- **Shotbot:** https://shotbot.io/ (automated screenshots)
- **Screenshot Designer:** Canva templates
- **Device Frames:** https://www.screely.com/

### Tips

- Use realistic data (not "Lorem ipsum")
- Show key features
- Add titles/captions on screenshots
- Use light mode (better contrast)
- Show app in action (not just empty screens)

---

## Launch Checklist

**1 Week Before:**
- [ ] Beta testing complete
- [ ] All critical bugs fixed
- [ ] Privacy policy & ToS live
- [ ] Screenshots prepared
- [ ] Store listings written (4 languages)
- [ ] Support email ready (support@artigianoai.it)

**3 Days Before:**
- [ ] Final build submitted to both stores
- [ ] Marketing materials ready
- [ ] Social media posts scheduled
- [ ] Press release (if applicable)
- [ ] Support documentation live

**Launch Day:**
- [ ] Monitor Sentry for crashes
- [ ] Respond to first reviews
- [ ] Post on social media
- [ ] Email existing waitlist (if any)
- [ ] Monitor server load (Supabase, Stripe)

**Week 1:**
- [ ] Daily monitoring of crashes
- [ ] Respond to all reviews
- [ ] Fix critical bugs (hotfix if needed)
- [ ] Collect user feedback
- [ ] Plan v1.1 based on feedback

---

## Resources

### Apple
- **App Store Connect:** https://appstoreconnect.apple.com/
- **Developer Portal:** https://developer.apple.com/
- **Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **App Store Connect Help:** https://developer.apple.com/help/app-store-connect/

### Google
- **Play Console:** https://play.google.com/console/
- **Developer Policies:** https://play.google.com/about/developer-content-policy/
- **Launch Checklist:** https://developer.android.com/distribute/best-practices/launch/launch-checklist

### Expo
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **EAS Submit:** https://docs.expo.dev/submit/introduction/
- **App Store Deployment:** https://docs.expo.dev/distribution/app-stores/

---

**Last Updated:** February 13, 2026
**Status:** ✅ READY — Complete guide for production deployment
**Estimated Time to Launch:** 2-4 weeks (including app review)
