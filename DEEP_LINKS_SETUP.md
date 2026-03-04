# Deep Links Setup — iOS Universal Links & Android App Links

This document explains how to complete the deep linking configuration so that share URLs (e.g., `https://spotmeone.com/share/abc123`) open in the native SpotMe app when installed, and fall back to the web page when not installed.

---

## What's Already Configured

### 1. `public/.well-known/apple-app-site-association` (iOS)
- Hosted at `https://spotmeone.com/.well-known/apple-app-site-association`
- Tells iOS which URL paths should open in the app
- Covers: `/share/*`, `/need/*`, `/user/*`, `/thankyou/*`, `/payment-success`, `/payment-checkout`

### 2. `public/.well-known/assetlinks.json` (Android)
- Hosted at `https://spotmeone.com/.well-known/assetlinks.json`
- Tells Android which app is authorized to handle URLs from this domain

### 3. `app.json` — Native App Configuration
- **iOS**: `associatedDomains` configured for `applinks:spotmeone.com` and `applinks:www.spotmeone.com`
- **iOS**: `bundleIdentifier` set to `com.spotmeone.app`
- **Android**: `package` set to `com.spotmeone.app`
- **Android**: `intentFilters` configured with `autoVerify: true` for all deep link paths
- **URL Scheme**: `spotme://` for custom scheme deep links (fallback)

### 4. `vercel.json` — Hosting Configuration
- `.well-known` files served with `Content-Type: application/json` headers
- `.well-known` files have CORS headers (`Access-Control-Allow-Origin: *`)
- SPA catch-all rewrite does NOT interfere with `.well-known` file serving

---

## Required: Replace Placeholders

### Step 1: Apple Team ID (iOS)

Replace `XXXXXXXXXX` in `public/.well-known/apple-app-site-association` with your actual Apple Developer Team ID.

**How to find your Team ID:**
1. Go to [Apple Developer Account](https://developer.apple.com/account)
2. Click "Membership" in the sidebar
3. Your Team ID is listed there (10-character alphanumeric string)

**In the file, replace:**
```
"XXXXXXXXXX.com.spotmeone.app"
```
**With (example):**
```
"A1B2C3D4E5.com.spotmeone.app"
```

> Do this in BOTH places in the file (`appIDs` and `webcredentials.apps`).

---

### Step 2: Android SHA-256 Certificate Fingerprint

Replace the placeholder fingerprint in `public/.well-known/assetlinks.json` with your actual signing certificate's SHA-256 fingerprint.

**How to get your SHA-256 fingerprint:**

For **debug** builds:
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

For **release/production** builds (using your upload key):
```bash
keytool -list -v -keystore /path/to/your-upload-key.keystore
```

If using **Google Play App Signing** (recommended):
1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app → Setup → App signing
3. Copy the SHA-256 fingerprint from the "App signing key certificate" section

**In the file, replace:**
```
"XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX"
```
**With your actual fingerprint (example):**
```
"14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5"
```

> If you use both a debug and production certificate, add multiple fingerprints to the array.

---

## How It Works

### When a user taps a SpotMe link (e.g., from a text message, social media, or email):

**If the app IS installed:**
1. iOS/Android checks the `.well-known` verification files on `spotmeone.com`
2. The OS confirms the app (`com.spotmeone.app`) is authorized to handle these URLs
3. The link opens directly in the SpotMe app
4. expo-router handles the URL and navigates to the correct screen (e.g., `/share/abc123`)

**If the app is NOT installed:**
1. The OS has no matching app to open the URL
2. The link opens in the default browser
3. The browser loads the web version at `https://spotmeone.com/share/abc123`
4. The SPA catch-all rewrite serves `index.html`, and the client-side router handles the route

### URL → Screen Mapping

| URL Pattern | App Screen | Description |
|---|---|---|
| `/share/{id}` | TikTok-style landing page | Optimized sharing page for social media |
| `/need/{id}` | Need detail screen | Full need detail with contribute button |
| `/user/{id}` | User profile | Public user profile page |
| `/thankyou/{id}` | Thank you video | Thank you video player page |
| `/payment-success` | Payment confirmation | Post-payment success screen |
| `/payment-checkout` | Checkout flow | Payment checkout screen |

---

## Verification & Testing

### Test iOS Universal Links:
1. Deploy the updated `.well-known` files to `spotmeone.com`
2. Build and install the app on a device (simulator won't work for Universal Links)
3. Open Notes or Messages and type a link like `https://spotmeone.com/share/test123`
4. Tap the link — it should open in the SpotMe app
5. Long-press the link — you should see "Open in SpotMe" option

**Apple's validation tool:**
```
https://app-site-association.cdn-apple.com/a/v1/spotmeone.com
```

### Test Android App Links:
1. Deploy the updated `.well-known` files to `spotmeone.com`
2. Build and install the app on a device
3. Run the verification check:
   ```bash
   adb shell pm get-app-links com.spotmeone.app
   ```
4. Open a link in Chrome: `https://spotmeone.com/share/test123`
5. It should open directly in the SpotMe app without a disambiguation dialog

**Google's validation tool:**
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://spotmeone.com&relation=delegate_permission/common.handle_all_urls
```

### Verify files are served correctly:
```bash
# Check AASA file
curl -I https://spotmeone.com/.well-known/apple-app-site-association
# Should return Content-Type: application/json

# Check assetlinks file
curl -I https://spotmeone.com/.well-known/assetlinks.json
# Should return Content-Type: application/json

# Check AASA content
curl https://spotmeone.com/.well-known/apple-app-site-association | python3 -m json.tool

# Check assetlinks content
curl https://spotmeone.com/.well-known/assetlinks.json | python3 -m json.tool
```

---

## Troubleshooting

### iOS Universal Links not working?
- **Must be HTTPS** — Universal Links only work over HTTPS
- **Must be a real device** — Simulator doesn't support Universal Links
- **CDN caching** — Apple caches the AASA file via their CDN. Changes can take 24-48 hours to propagate
- **File must be valid JSON** — Use `python3 -m json.tool` to validate
- **No redirects** — The AASA file must be served directly (200), not via a redirect (301/302)
- **Team ID must match** — The Team ID in the AASA file must match your Apple Developer account

### Android App Links not working?
- **autoVerify must be true** — Already set in `app.json` intent filters
- **SHA-256 must match** — The fingerprint must match your signing certificate exactly
- **Google Play App Signing** — If using Play App Signing, use Google's fingerprint, not your upload key
- **Clear app defaults** — Go to Settings → Apps → SpotMe → Open by default → Clear defaults, then try again
- **Verification delay** — Android verifies links when the app is installed. Reinstall after updating assetlinks.json

### Links opening in browser instead of app?
- The app may not be installed
- The verification files may not be deployed yet
- The OS may have cached an old version of the verification files
- Try uninstalling and reinstalling the app to trigger re-verification

---

## Custom URL Scheme (Fallback)

In addition to Universal Links / App Links, the app also supports the `spotme://` custom URL scheme:

```
spotme://share/abc123
spotme://need/abc123
spotme://user/abc123
```

This is useful for:
- Deep linking from other apps that don't support Universal Links
- QR codes that need guaranteed app opening (when you know the app is installed)
- Push notification payloads

> Note: Custom URL schemes do NOT fall back to the web — they only work if the app is installed.
