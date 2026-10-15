# a4ai Android app — WebView checklist

The Play Store app is a WebView around **https://www.a4ai.in**. Login lives in the page's
`localStorage` (key `a4ai.auth.token`): a short-lived access token plus a refresh token that the
site renews silently. If the WebView keeps its storage and tells the page when the app is
paused and resumed, users stay signed in for weeks. If it loses storage, they are logged out.

Please go through each item and reply with ✅ or what's different.

## 1. Storage must be on and must survive restarts
- [ ] `settings.domStorageEnabled = true` (without it `localStorage` doesn't exist and every app start is a fresh login).
- [ ] `settings.databaseEnabled = true`.
- [ ] Nothing wipes WebView data on start, exit or update:
      no `webView.clearCache(true)`, `WebStorage.getInstance().deleteAllData()`,
      `CookieManager.getInstance().removeAllCookies(...)`, `clearHistory()` plus a data wipe, or incognito-style setup.
- [ ] No `WebView.setDataDirectorySuffix(...)` that changes between launches.
- [ ] Cookies on: `CookieManager.getInstance().setAcceptCookie(true)`, and call `CookieManager.getInstance().flush()` in `onPause()`.

## 2. Always the same origin
- [ ] The app loads exactly `https://www.a4ai.in/...` (with `www`). `localStorage` is per origin.
      If the app sometimes opens `a4ai.in` and sometimes `www.a4ai.in`, users look logged out on one of them.
- [ ] Links to other a4ai paths stay inside the WebView (`shouldOverrideUrlLoading` returns `false` for `www.a4ai.in`).

## 3. Tell the page about pause / resume
The site refreshes the session when it becomes visible again, so a phone that slept overnight
recovers by itself, but only if the WebView reports the lifecycle.
- [ ] Activity `onPause()` → `webView.onPause()`; `onResume()` → `webView.onResume()`.
- [ ] If you call `webView.pauseTimers()` in `onPause()`, call `webView.resumeTimers()` in `onResume()`.
- [ ] Don't destroy and recreate the WebView when the app is backgrounded. After the OS kills the app,
      just load the URL again. The session is restored from storage.

## 4. User agent
- [ ] Keep the default WebView user agent (it contains `; wv)`), and **append** ` a4ai-android/<versionName>`:
      `settings.userAgentString = settings.userAgentString + " a4ai-android/" + BuildConfig.VERSION_NAME`.
      The site uses this to adapt the login screen. Don't replace the whole string.

## 5. Google sign-in (currently hidden in the app)
Google blocks OAuth inside WebViews (`403 disallowed_useragent`), so the site **hides
"Continue with Google" inside the app** and users sign in with email + password. To bring it back:
- [ ] When the WebView navigates to the Supabase authorize URL
      (`https://dcmnzvjftmdbywrjkust.supabase.co/auth/v1/authorize?...`) or `accounts.google.com`,
      open it in **Chrome Custom Tabs** instead (`shouldOverrideUrlLoading` → `CustomTabsIntent.launchUrl`).
- [ ] Add an **Android App Link** for `https://www.a4ai.in/auth/callback` (intent filter with
      `android:autoVerify="true"`), so the redirect after Google comes back to the app, not to Chrome.
      Send us the package name and the SHA-256 signing-certificate fingerprint. We will publish
      `https://www.a4ai.in/.well-known/assetlinks.json`.
- [ ] When the app receives that link, load the **full callback URL (with `?code=...`) into the existing WebView**.
      The one-time code can only be exchanged inside the WebView, because the matching secret was stored
      in the WebView's storage when sign-in started. Opening it anywhere else fails with "code verifier not found".
- [ ] Tell us when this ships. We then turn the Google button back on for app versions that support it
      (by the `a4ai-android/<version>` user-agent suffix).

## 6. Please test before release
- [ ] Sign in with email → kill the app → reopen: still signed in.
- [ ] Sign in → leave the phone overnight → open the app: still signed in, no login screen.
- [ ] Sign in → airplane mode for a minute → back online → keep using the app: still signed in.
- [ ] Settings → "Log out on this device" → reopen the app: login screen (session really cleared).
- [ ] Update the app over an older version: still signed in.
