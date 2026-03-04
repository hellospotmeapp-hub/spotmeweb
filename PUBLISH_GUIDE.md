# SpotMe — App Store Publishing Guide

> Everything you need to publish SpotMe to the **Apple App Store** and **Google Play Store** tonight.

---

## Prerequisites

1. **Node.js 18+** installed
2. **EAS CLI** installed: `npm install -g eas-cli`
3. **Expo account** — sign up free at [expo.dev](https://expo.dev)
4. **Apple Developer account** ($99/year) — [developer.apple.com](https://developer.apple.com)
5. **Google Play Developer account** ($25 one-time) — [play.google.com/console](https://play.google.com/console)

---

## Step 1: Prepare Your App Icon

Your logo: `https://d64gsuwffb70l.cloudfront.net/698fde14023eba656fc44cdf_1772154941891_05f53862.jpg`

You need to save this image as local files in `assets/images/`:

| File | Size | Purpose |
|------|------|---------|
| `icon.png` | 1024×1024 px | App Store / Play Store icon |
| `adaptive-icon.png` | 1024×1024 px | Android adaptive icon (foreground layer) |
| `splash-icon.png` | 288×288 px | Splash screen center icon |
| `favicon.png` | 48×48 px | Web favicon |

### Quick steps:
1. Download your logo from the URL above
2. Use [squoosh.app](https://squoosh.app) or any image editor to resize
3. Save as PNG files in `assets/images/`
4. For `adaptive-icon.png`, keep the icon centered with ~30% padding around edges (Android crops this into circles/squircles)
5. For `splash-icon.png`, use just the heart+hand icon portion on a transparent background

> **Tip:** The splash screen background is set to `#F5A623` (your logo's orange) in `app.json`, so the splash icon should be the white heart/hand portion only.

---

## Step 2: Set Up EAS

```bash
# Log in to your Expo account
eas login

# Link this project (creates the EAS project)
eas init

# This will give you a project ID — copy it
```

After running `eas init`, update `app.json` in TWO places:
```json
"extra": {
  "eas": {
    "projectId": "YOUR_ACTUAL_PROJECT_ID"   // ← paste here
  }
}
```
```json
"updates": {
  "url": "https://u.expo.dev/YOUR_ACTUAL_PROJECT_ID"   // ← and here
}
```

---

## Step 3: Build for iOS

```bash
# First build (will prompt you to set up credentials)
eas build --platform ios --profile production
```

EAS will ask:
- **Apple ID**: Enter your Apple Developer email
- **Team**: Select your team
- **Bundle ID**: It will register `com.spotmeone.app` automatically
- **Provisioning**: Choose "Let EAS handle it" (recommended)

The build takes ~15-20 minutes. You'll get a URL to download the `.ipa` file.

---

## Step 4: Build for Android

```bash
eas build --platform android --profile production
```

This produces an `.aab` (Android App Bundle) file. Takes ~10-15 minutes.

---

## Step 5: Submit to Apple App Store

### Option A: Auto-submit via EAS (easiest)
```bash
eas submit --platform ios
```

### Option B: Manual via App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Name**: SpotMe: Everyday Support
   - **Bundle ID**: com.spotmeone.app
   - **SKU**: spotme-everyday-support
   - **Primary Language**: English (U.S.)
4. Upload the `.ipa` using **Transporter** app (free on Mac App Store)
5. Fill in the required metadata (see below)

### Required App Store Metadata:
- **Subtitle**: Help your neighbors with everyday needs
- **Description**: (see App Store Description section below)
- **Keywords**: community, support, help, neighbors, fundraising, mutual aid, donate, needs, bills, groceries
- **Category**: Primary: Lifestyle, Secondary: Finance
- **Age Rating**: 4+ (no objectionable content)
- **Price**: Free
- **Privacy Policy URL**: https://spotmeone.com/terms
- **Support URL**: https://spotmeone.com/about
- **Screenshots**: Required for each device size (see Screenshot section)

---

## Step 6: Submit to Google Play Store

### Option A: Auto-submit via EAS
First, create a service account key in Google Play Console:
1. Go to **Setup** → **API access** in Play Console
2. Create a service account with "Release manager" permissions
3. Download the JSON key file
4. Save it as `google-services.json` in your project root

Then update `eas.json`:
```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-services.json",
      "track": "internal"
    }
  }
}
```

```bash
eas submit --platform android
```

### Option B: Manual upload
1. Go to [Google Play Console](https://play.google.com/console)
2. **Create app** → Fill in details
3. Go to **Production** → **Create new release**
4. Upload the `.aab` file
5. Fill in release notes and required metadata

### Required Play Store Metadata:
- **App name**: SpotMe: Everyday Support
- **Short description**: Help your neighbors with everyday needs. Small acts, big impact.
- **Full description**: (see App Store Description section below)
- **Category**: Social
- **Content rating**: Complete the questionnaire (should be "Everyone")
- **Privacy Policy URL**: https://spotmeone.com/terms
- **Screenshots**: Minimum 2, recommended 8

---

## Step 7: Update Deep Links

After your app is published, update the verification files:

### iOS — `public/.well-known/apple-app-site-association`
Replace `XXXXXXXXXX` with your Apple Team ID (found at developer.apple.com → Membership)

### Android — `public/.well-known/assetlinks.json`
Replace the SHA-256 fingerprint with your app signing key's fingerprint:
- Go to Play Console → Your App → Setup → App signing
- Copy the SHA-256 fingerprint

See `DEEP_LINKS_SETUP.md` for full instructions.

---

## App Store Description

Use this for both stores:

```
SpotMe — No Tragedy. Just Life.

Help your neighbors with everyday needs. Not emergencies or medical bills — just the regular stuff that adds up: groceries, kids' school supplies, a car repair, or this month's electric bill.

HOW IT WORKS:

📋 Post a Need
Share what you need help with, pick a category, and set a goal up to $300. Your need is live for 14 days.

💛 Spot Someone
Browse real requests from real people. See something you can help with? Tap "Spot Them" and contribute any amount — even $2 makes a difference.

🤝 Spread the Love
Can't decide who to help? Use Smart Split to divide one payment across multiple people at once.

✅ Get Paid
When your goal is met (or your need expires), request a payout directly to your bank account via Stripe.

FEATURES:
• Real-time progress tracking on every need
• Categories: Bills, Kids, Groceries, Health, Transportation, Self-Care
• Mama Recharge — a special Thursday spotlight for self-care needs
• Thank-you videos and updates from people you've helped
• Trust scores and community verification
• Secure payments powered by Stripe
• Works on iPhone, Android, and web

SpotMe is for the everyday moments when a little help goes a long way. No judgment — just people helping people.
```

---

## Screenshots

You need screenshots for:
- **iPhone 6.7"** (iPhone 15 Pro Max) — 1290×2796 px
- **iPhone 6.5"** (iPhone 14 Plus) — 1284×2778 px
- **iPad 12.9"** (if supporting tablet) — 2048×2732 px
- **Android Phone** — 1080×1920 px minimum

### How to take screenshots:
```bash
# Run on iOS Simulator
eas build --platform ios --profile development
# Then use Simulator → File → Screenshot

# Run on Android Emulator
eas build --platform android --profile development
# Then use emulator screenshot button
```

### Recommended screenshot screens:
1. Home feed showing active needs with progress bars
2. Need detail page with contribute button
3. Post a Need form
4. Spread the Love / Smart Split feature
5. Profile page with trust score
6. Notifications / activity feed

---

## Quick Command Reference

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in
eas login

# Initialize project
eas init

# Build iOS (production)
eas build --platform ios --profile production

# Build Android (production)
eas build --platform android --profile production

# Build both at once
eas build --platform all --profile production

# Submit iOS
eas submit --platform ios

# Submit Android
eas submit --platform android

# Build a test APK (for sharing with testers)
eas build --platform android --profile preview

# Build iOS simulator build (for testing)
eas build --platform ios --profile development

# Push an OTA update (no new build needed!)
eas update --branch production --message "Bug fix"
```

---

## After Publishing: OTA Updates

One of the best parts of Expo — you can push updates WITHOUT going through app review:

```bash
# Push a code update to all production users
eas update --branch production --message "Fixed a bug"
```

This updates JavaScript code instantly. For native changes (new permissions, new native modules), you'll need a new build.

---

## Troubleshooting

### "No bundle identifier found"
→ Make sure `app.json` has `ios.bundleIdentifier: "com.spotmeone.app"`

### "Build failed: provisioning profile"
→ Run `eas credentials` and let EAS manage your certificates

### "App rejected: missing privacy policy"
→ Make sure https://spotmeone.com/terms is accessible

### "App rejected: incomplete metadata"
→ Ensure all required fields are filled in App Store Connect / Play Console

### Build succeeds but app crashes on launch
→ Check that all `window.` and `localStorage` references are guarded with `Platform.OS === 'web'` checks (already done in this codebase)

---

## Timeline Estimate

| Step | Time |
|------|------|
| Set up icons | 15 min |
| EAS init + first build | 25 min |
| iOS build | 15-20 min |
| Android build | 10-15 min |
| App Store Connect setup | 30 min |
| Play Console setup | 20 min |
| **Total** | **~2 hours** |

Apple review typically takes 24-48 hours. Google review takes 1-7 days for first submission.

---

## Files Modified for App Store Readiness

| File | What Changed |
|------|-------------|
| `app.json` | Full iOS/Android config: bundleIdentifier, package, permissions, splash screen, adaptive icon, deep links, privacy manifests |
| `eas.json` | Build profiles for development, preview, and production with auto-increment |
| `app/_layout.tsx` | Added native splash screen handling with `expo-splash-screen` |
| `DEEP_LINKS_SETUP.md` | Already configured for universal links |

Your app is ready to build. Just add your icon files and run `eas build`! 🚀
