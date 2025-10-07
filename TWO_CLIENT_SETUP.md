# 🔐 Two-Client OAuth Setup Guide

## Overview

This application uses **two separate OAuth clients** for enhanced security:

1. **Public Client** - Used by the frontend React application
2. **Confidential Client** - Used by Trino server for token validation

## Why Two Clients?

### Security Benefits

**Single Client Approach (Previous):**
- ❌ Same client ID used everywhere creates a single point of failure
- ❌ If frontend is compromised, Trino's credentials are exposed
- ❌ Cannot have different security policies for different components

**Two Client Approach (Current):**
- ✅ **Separation of Concerns**: Frontend and backend use different credentials
- ✅ **Defense in Depth**: Compromising frontend doesn't expose Trino's secret
- ✅ **Better Access Control**: Different clients can have different permissions
- ✅ **Audit Trail**: Can track which client made which requests
- ✅ **Follows OAuth Best Practices**: Public clients should use PKCE, confidential clients should use secrets

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     OAuth Flow with Two Clients                  │
└─────────────────────────────────────────────────────────────────┘

1. User Login Flow (Public Client):
   ┌──────────┐                    ┌──────────────┐
   │ Frontend │ ─── PKCE Auth ────▶│ OAuth Server │
   │ (React)  │ (Public Client ID)  │ (e.g. Google)│
   └──────────┘◀── Access Token ───└──────────────┘
        │
        │ Token issued with aud=public-client-id
        │
        ▼
   ┌──────────┐
   │ Backend  │ ─── Forward Token ─▶ ┌──────────┐
   │ (Express)│                       │  Trino   │
   └──────────┘                       └──────────┘
                                           │
                                           ▼
                                  Validates token using:
                                  - JWKS URL (public keys)
                                  - Trino Client ID (for config)
                                  - Accepts tokens with aud=public-client-id
                                    (via additional-audiences)

2. Token Validation (Confidential Client):
   - Trino is configured with its own client ID + secret
   - Trino accepts tokens issued to the public client
   - Uses JWKS to validate token signatures
   - No secret exchange needed - JWT validation only
```

## Configuration

### OAuth Provider Setup

You need to create **TWO** OAuth clients in your OAuth provider:

#### Client 1: Public Client (Frontend)

**Google Cloud Console Example:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Application Type: **Web Application**
4. Name: `Trino OAuth Demo - Frontend`
5. Authorized JavaScript origins:
   - `http://localhost:5173`
6. Authorized redirect URIs:
   - `http://localhost:5173/callback`
7. **No client secret needed** (or ignore it if generated)
8. Copy the **Client ID** → This is your `OAUTH2_PUBLIC_CLIENT_ID`

**Auth0 Example:**
1. Create a new Application
2. Application Type: **Single Page Application**
3. Name: `Trino OAuth Demo - Frontend`
4. Allowed Callback URLs: `http://localhost:5173/callback`
5. Allowed Web Origins: `http://localhost:5173`
6. Copy the **Client ID** → `OAUTH2_PUBLIC_CLIENT_ID`

**Keycloak Example:**
1. Create a new Client
2. Client ID: `trino-frontend-public`
3. Client Protocol: `openid-connect`
4. Access Type: **Public**
5. Valid Redirect URIs: `http://localhost:5173/callback`
6. Web Origins: `http://localhost:5173`
7. Use client ID → `OAUTH2_PUBLIC_CLIENT_ID`

#### Client 2: Confidential Client (Trino)

**Google Cloud Console Example:**
1. Create another OAuth 2.0 Client ID
2. Application Type: **Web Application**
3. Name: `Trino OAuth Demo - Trino Server`
4. Authorized redirect URIs:
   - `http://localhost:8080/oauth2/callback`
   - `http://localhost:8080/ui/oauth2/callback`
5. Copy the **Client ID** → `OAUTH2_TRINO_CLIENT_ID`
6. Copy the **Client Secret** → `OAUTH2_TRINO_CLIENT_SECRET`

**Auth0 Example:**
1. Create a new Application
2. Application Type: **Regular Web Application**
3. Name: `Trino OAuth Demo - Trino`
4. Allowed Callback URLs: 
   - `http://localhost:8080/oauth2/callback`
   - `http://localhost:8080/ui/oauth2/callback`
5. Copy **Client ID** → `OAUTH2_TRINO_CLIENT_ID`
6. Copy **Client Secret** → `OAUTH2_TRINO_CLIENT_SECRET`

**Keycloak Example:**
1. Create a new Client
2. Client ID: `trino-server`
3. Client Protocol: `openid-connect`
4. Access Type: **Confidential**
5. Valid Redirect URIs: `http://localhost:8080/*`
6. Copy client ID → `OAUTH2_TRINO_CLIENT_ID`
7. Go to Credentials tab
8. Copy Secret → `OAUTH2_TRINO_CLIENT_SECRET`

### Environment Variables

Update your `.env` file with both client credentials:

```bash
# Provider Selection
VITE_OAUTH_PROVIDER=google

# PUBLIC CLIENT - Frontend (No Secret)
OAUTH2_PUBLIC_CLIENT_ID=your-public-client-id.apps.googleusercontent.com

# CONFIDENTIAL CLIENT - Trino (Has Secret)
OAUTH2_TRINO_CLIENT_ID=your-trino-client-id.apps.googleusercontent.com
OAUTH2_TRINO_CLIENT_SECRET=GOCSPX-your-trino-client-secret

# OAuth Endpoints (Google example)
OAUTH2_ISSUER_URL=https://accounts.google.com
OAUTH2_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
OAUTH2_PRINCIPAL_FIELD=email

# Frontend Config (uses PUBLIC client)
VITE_GOOGLE_CLIENT_ID=your-public-client-id.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback
VITE_BACKEND_URL=http://localhost:3001

# Trino Config
TRINO_HOST=trino
TRINO_PORT=8080
TRINO_ADMIN_USERNAME=your-email@gmail.com
TRINO_INTERNAL_SECRET=change-this-to-random-string-min-256-bits

# Backend Config
FRONTEND_ORIGIN=http://localhost:5173
```

## Token Flow Details

### 1. Frontend Authentication (Public Client)

```javascript
// Frontend uses public client with PKCE
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// Authorization request
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?
  client_id=${OAUTH2_PUBLIC_CLIENT_ID}&
  redirect_uri=${REDIRECT_URI}&
  response_type=code&
  scope=openid email profile&
  code_challenge=${codeChallenge}&
  code_challenge_method=S256&
  state=${state}`;

// Token exchange (no secret)
const tokenResponse = await fetch(tokenUrl, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI,
    client_id: OAUTH2_PUBLIC_CLIENT_ID,
    code_verifier: codeVerifier
    // No client_secret - PKCE provides security
  })
});
```

### 2. Trino Token Validation (Confidential Client)

Trino configuration (`trino/etc/config.properties`):

```properties
# Trino's own client credentials
http-server.authentication.oauth2.client-id=${ENV:OAUTH2_TRINO_CLIENT_ID}
http-server.authentication.oauth2.client-secret=${ENV:OAUTH2_TRINO_CLIENT_SECRET}

# Accept tokens issued to the public client
http-server.authentication.oauth2.additional-audiences=${ENV:OAUTH2_PUBLIC_CLIENT_ID}

# Use JWKS for signature verification
http-server.authentication.oauth2.jwks-url=${ENV:OAUTH2_JWKS_URL}
```

**How Trino validates tokens:**
1. Receives JWT token with `aud: public-client-id`
2. Checks if `public-client-id` is in `additional-audiences` ✅
3. Fetches public keys from JWKS URL
4. Verifies token signature using public key ✅
5. Validates issuer, expiration, etc. ✅
6. Extracts user identity from `email` claim
7. Allows query execution if all checks pass

### 3. Token Claims

Example JWT token issued to public client:

```json
{
  "iss": "https://accounts.google.com",
  "aud": "public-client-id.apps.googleusercontent.com",
  "sub": "1234567890",
  "email": "user@example.com",
  "email_verified": true,
  "iat": 1234567890,
  "exp": 1234571490
}
```

Trino accepts this because:
- `aud` matches the `additional-audiences` configuration
- Token signature is valid (verified via JWKS)
- Token is not expired
- Issuer matches configured issuer

## Troubleshooting

### Token Rejected by Trino

**Error**: `Token audience validation failed`

**Solution**: Ensure `OAUTH2_PUBLIC_CLIENT_ID` is set correctly and Trino config includes:
```properties
http-server.authentication.oauth2.additional-audiences=${ENV:OAUTH2_PUBLIC_CLIENT_ID}
```

### Frontend Can't Get Token

**Error**: `invalid_client` or `unauthorized_client`

**Solution**: 
- Verify `OAUTH2_PUBLIC_CLIENT_ID` matches the public client in OAuth provider
- Ensure redirect URI in `.env` matches OAuth provider configuration
- For public clients, no secret should be sent

### Token Validation Fails

**Error**: `Invalid token signature`

**Solution**:
- Verify `OAUTH2_JWKS_URL` is correct and accessible
- Ensure tokens are not expired
- Check that issuer URL matches between token and Trino config

## Security Considerations

### Public Client (Frontend)
- ✅ Uses PKCE to prevent authorization code interception
- ✅ No client secret stored in browser (not possible to keep secret)
- ✅ State parameter prevents CSRF attacks
- ✅ Tokens stored in memory only (not localStorage)

### Confidential Client (Trino)
- ✅ Client secret stored server-side only
- ✅ Uses JWKS for signature verification (industry standard)
- ✅ Validates token audience to ensure proper token usage
- ✅ Validates issuer to prevent token forgery
- ✅ Checks expiration to prevent replay attacks

### Why This Is Secure

1. **PKCE Protection**: Even if authorization code is intercepted, attacker cannot exchange it without the code_verifier
2. **Separate Secrets**: Frontend compromise doesn't expose Trino's secret
3. **JWT Validation**: Trino validates tokens cryptographically - no network call to OAuth server needed
4. **Audience Control**: Tokens can only be used by intended recipient (Trino)
5. **No Shared Secrets**: Public client uses PKCE instead of secrets

## Migration from Single Client

If migrating from single-client setup:

1. **Create the second client** in OAuth provider
2. **Update environment variables**:
   - Rename `OAUTH2_CLIENT_ID` → `OAUTH2_PUBLIC_CLIENT_ID`
   - Rename `OAUTH2_CLIENT_SECRET` → `OAUTH2_TRINO_CLIENT_SECRET`
   - Add `OAUTH2_TRINO_CLIENT_ID`
3. **Update Trino config** to use `OAUTH2_TRINO_CLIENT_ID` and add `additional-audiences`
4. **Restart all services**: `docker compose down && docker compose up -d`
5. **Test authentication** with a fresh login

## Testing

```bash
# Start the application
docker compose up -d

# Check logs
docker compose logs -f

# Test frontend auth
curl http://localhost:5173

# Test backend health
curl http://localhost:3001/health

# Test Trino health
curl http://localhost:8080/v1/info

# Login and run a query
# The token should be accepted by Trino even though it was issued to the public client
```

## Additional Resources

- [OAuth 2.0 for Native Apps (RFC 8252)](https://tools.ietf.org/html/rfc8252)
- [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [Trino OAuth 2.0 Authentication](https://trino.io/docs/current/security/oauth2.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

## Summary

| Aspect | Public Client (Frontend) | Confidential Client (Trino) |
|--------|-------------------------|---------------------------|
| **Purpose** | User authentication | Token validation |
| **Client Secret** | ❌ No (uses PKCE) | ✅ Yes (kept server-side) |
| **Token Issuance** | ✅ Gets tokens | ❌ Only validates |
| **Audience** | Tokens for this client | Accepts public client tokens |
| **Security** | PKCE + State | Client secret + JWKS |
| **Compromise Impact** | Limited to frontend | Would affect Trino only |
