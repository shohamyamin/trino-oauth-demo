# Trino OAuth Demo - OAuth2 Provider Configuration Guide

This application supports multiple OAuth2 providers. Choose one and configure it below.

## 🔵 Google OAuth2 (Recommended)

**Setup Steps:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (or People API)
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth 2.0 Client ID**
6. Configure:
   - **Application type:** Web application
   - **Authorized JavaScript origins:** `http://localhost:5173`
   - **Authorized redirect URIs:** `http://localhost:5173/callback`
7. Copy the **Client ID**

**Configuration (.env):**
```env
VITE_OAUTH_PROVIDER=google
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback
```

---

## 🐙 GitHub OAuth2

**Setup Steps:**

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Configure:
   - **Application name:** Trino OAuth Demo
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:** `http://localhost:5173/callback`
4. Click **Register application**
5. Copy the **Client ID**

**Configuration (.env):**
```env
VITE_OAUTH_PROVIDER=github
VITE_GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
VITE_GITHUB_REDIRECT_URI=http://localhost:5173/callback
```

---

## 🔐 Auth0

**Setup Steps:**

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new application
3. Choose **Single Page Application**
4. Go to **Settings** tab
5. Configure:
   - **Allowed Callback URLs:** `http://localhost:5173/callback`
   - **Allowed Logout URLs:** `http://localhost:5173`
   - **Allowed Web Origins:** `http://localhost:5173`
6. Copy the **Domain** and **Client ID**

**Configuration (.env):**
```env
VITE_OAUTH_PROVIDER=auth0
VITE_AUTH0_DOMAIN=YOUR_DOMAIN.auth0.com
VITE_AUTH0_CLIENT_ID=YOUR_CLIENT_ID
VITE_AUTH0_REDIRECT_URI=http://localhost:5173/callback
```

---

## 🔑 Keycloak (Local/Docker)

**Setup Steps:**

If using the included Keycloak container, it's pre-configured. Otherwise:

1. Access Keycloak admin console
2. Create or select a realm
3. Create a new client
4. Configure:
   - **Client Protocol:** openid-connect
   - **Access Type:** public
   - **Valid Redirect URIs:** `http://localhost:5173/callback`
   - **Web Origins:** `http://localhost:5173`
5. Save the client

**Configuration (.env):**
```env
VITE_OAUTH_PROVIDER=keycloak
VITE_KEYCLOAK_URL=http://YOUR_KEYCLOAK_HOST:8080
VITE_KEYCLOAK_REALM=YOUR_REALM
VITE_KEYCLOAK_CLIENT_ID=YOUR_CLIENT_ID
```

---

## 🌐 Generic OAuth2 Provider

For any other OAuth2/OIDC provider:

**Configuration (.env):**
```env
VITE_OAUTH_PROVIDER=generic
VITE_OAUTH_AUTHORIZATION_URL=https://your-idp.com/oauth/authorize
VITE_OAUTH_TOKEN_URL=https://your-idp.com/oauth/token
VITE_OAUTH_USERINFO_URL=https://your-idp.com/oauth/userinfo
VITE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
VITE_OAUTH_SCOPE=openid profile email
```

---

## 🚀 After Configuration

1. Update `frontend/.env` with your chosen provider's credentials
2. Restart the frontend container:
   ```bash
   docker compose restart frontend
   ```
3. Open http://localhost:5173
4. Click "Login with [Provider]"

---

## ⚠️ Important Notes

- **Implicit Flow:** This app uses OAuth2 Implicit Flow (tokens in URL fragment)
- **Security:** For production, use Authorization Code Flow with PKCE
- **CORS:** Make sure your OAuth provider allows requests from `http://localhost:5173`
- **HTTPS:** Most providers require HTTPS in production
- **Redirect URI:** Must match exactly what's configured in your OAuth provider

---

## 🐛 Troubleshooting

### "Invalid redirect URI"
- Make sure `http://localhost:5173/callback` is added to your OAuth app's allowed redirect URIs
- Check for trailing slashes - some providers are strict about this

### "CORS error"
- Add `http://localhost:5173` to allowed origins in your OAuth provider settings

### "Blank page after login"
- Open browser console (F12) to see errors
- Check that your Client ID is correct
- Verify the provider is set correctly in `.env`

### "Token expired"
- Logout and login again
- Access tokens typically expire after 1 hour
