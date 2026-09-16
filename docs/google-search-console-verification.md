# Google Search Console Ownership Verification

This guide outlines the production procedure for completing **Google Search Console Ownership Verification** for Saarvi at `https://saarvi-beta.vercel.app/` to facilitate Google OAuth Branding Verification.

---

## 1. Concept Clarity & System Boundaries

It is critical to distinguish between the three distinct Google and Supabase systems:

| System | Role & Purpose | Where Configured | What It Controls |
| :--- | :--- | :--- | :--- |
| **Google Search Console (GSC)** | Verifies website ownership to confirm you control the public web domain. | [Google Search Console](https://search.google.com/search-console) | Search indexing, URL ownership badge, webmaster tools. |
| **Google Cloud Console (OAuth Branding)** | Verifies user-facing app name, logo, domain, and privacy policy for Google Sign-In consent screens. | [Google Cloud Console](https://console.cloud.google.com/apis/credentials/consent) | Removes "Unverified App" warning during user login with Google. Requires verified GSC domain ownership. |
| **Supabase Auth** | Handles OAuth PKCE code exchange, user creation, and JWT session issuance. | Supabase Project Dashboard (`Auth` → `Providers` → `Google`) | Client ID & Client Secret storage, Authorized Redirect URI routing. |

> **IMPORTANT**: Google OAuth Branding verification **requires** that the Authorized Domain (`saarvi-beta.vercel.app`) is verified in **Google Search Console** by the same Google account or Google Cloud Organization that owns the OAuth project.

---

## 2. Step-by-Step Verification Procedure

Follow these 15 exact steps:

1. **Open Google Search Console**:
   Navigate to [https://search.google.com/search-console](https://search.google.com/search-console). Sign in with the Google Account that manages the Google Cloud project for Saarvi.

2. **Add a URL-prefix Property**:
   Click the property selector dropdown in the top left and select **Add property**.

3. **Enter Site URL**:
   Choose the **URL prefix** option (NOT Domain) and enter:
   ```text
   https://saarvi-beta.vercel.app/
   ```
   Click **Continue**.

4. **Select HTML Tag Verification**:
   Under "Other verification methods", click to expand **HTML tag**.

5. **Copy the Verification Token**:
   The HTML tag provided by Google will resemble:
   ```html
   <meta name="google-site-verification" content="abcdef1234567890_EXAMPLE_TOKEN_STRING" />
   ```
   Copy **ONLY the content string** (e.g., `abcdef1234567890_EXAMPLE_TOKEN_STRING`), or copy the whole tag and extract the `content` attribute value.

6. **Set Environment Variable Locally (Optional for Dev)**:
   In `.env.local`:
   ```bash
   GOOGLE_SITE_VERIFICATION="your_copied_token_here"
   ```

7. **Add Variable to Vercel Production Environment**:
   - Go to your [Vercel Dashboard](https://vercel.com).
   - Select the `saarvi` project.
   - Navigate to **Settings** → **Environment Variables**.
   - Add Key: `GOOGLE_SITE_VERIFICATION`
   - Value: `your_copied_token_here`
   - Environments: Check **Production** (and Preview if desired).
   - Click **Save**.

8. **Redeploy Saarvi**:
   Trigger a new deployment on Vercel so the environment variable is injected into the Next.js runtime metadata:
   - Go to **Deployments** → Click **...** on the latest deployment → Select **Redeploy**.

9. **Open Live Production Homepage**:
   Navigate to [https://saarvi-beta.vercel.app/](https://saarvi-beta.vercel.app/) in a browser (or incognito window).

10. **Inspect Page Source**:
    Right-click anywhere on the homepage and select **View Page Source** (or press `Ctrl+U` / `Cmd+Option+U`).

11. **Confirm Meta Tag Presence**:
    Search for `google-site-verification` in the HTML `<head>`. Confirm it renders:
    ```html
    <meta name="google-site-verification" content="your_copied_token_here" />
    ```
    Confirm that it does NOT render `undefined` or `null`.

12. **Return to Google Search Console**:
    Return to the Google Search Console tab with the HTML tag dialog open.

13. **Click Verify**:
    Click the **Verify** button. Google Search Console will crawl `https://saarvi-beta.vercel.app/`, detect the tag in `<head>`, and confirm:
    > "Ownership verified"

14. **Return to Google Cloud Console (OAuth Consent Screen)**:
    Open [Google Cloud Console Consent Screen](https://console.cloud.google.com/apis/credentials/consent). Under **Authorized domains**, ensure `saarvi-beta.vercel.app` is listed. Because your account now owns the Search Console property, the domain will show as verified.

15. **Request Re-Verification**:
    Complete all required app branding fields (Application Name, User Support Email, Developer Contact) and submit for verification to finalize OAuth brand approval.

---

## 3. Safe Configuration Checklist

- [x] **No hardcoded tokens**: Token is read purely from `process.env.GOOGLE_SITE_VERIFICATION`.
- [x] **No undefined/null leakage**: If the environment variable is not configured, the `google-site-verification` meta tag is omitted completely.
- [x] **Public homepage accessibility**: Tag is injected into Root Layout metadata, ensuring `/` has the verification tag without requiring authentication.
- [x] **Dynamic Base URL**: Canonical and metadata base URLs respect `NEXT_PUBLIC_SITE_URL` and default to `https://saarvi-beta.vercel.app/`.
