# 🔧 Centralized Configuration Guide

## Overview

All OAuth2 and application configuration is now consolidated in a **single `.env` file** at the project root. This simplifies configuration management and ensures consistency across all services.

## Configuration Structure

```
trino-oauth-demo/
├── .env                    # ✅ Single source of truth for ALL configuration
├── .env.example            # Template with setup instructions
├── docker-compose.yml      # All services use root .env file
├── frontend/               # No separate .env needed
├── backend/                # No separate .env needed
└── trino/
    ├── etc/
    │   └── config.properties  # Uses ${ENV:VAR_NAME} placeholders
    └── docker-entrypoint.sh   # Substitutes env vars at startup
```

## Environment Variable Categories

### 1. OAuth2 Core Configuration

Used by **Trino** for JWT validation:

```bash
# Client credentials
OAUTH2_CLIENT_ID=your-oauth2-client-id
OAUTH2_CLIENT_SECRET=your-oauth2-client-secret

# OAuth2 endpoints
OAUTH2_ISSUER_URL=https://accounts.google.com
OAUTH2_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
OAUTH2_AUTHORIZATION_URL=https://accounts.google.com/o/oauth2/v2/auth
OAUTH2_TOKEN_URL=https://oauth2.googleapis.com/token
OAUTH2_USERINFO_URL=https://www.googleapis.com/oauth2/v3/userinfo

# Settings
OAUTH2_SCOPES=openid email profile
OAUTH2_REDIRECT_URI=http://localhost:5173/callback
OAUTH2_PRINCIPAL_FIELD=email
```

### 2. Frontend Configuration

Used by **React/Vite frontend** (requires `VITE_` prefix):

```bash
# Backend API
VITE_BACKEND_URL=http://localhost:3001

# Provider selection
VITE_OAUTH_PROVIDER=google  # Options: google, github, auth0, keycloak, generic

# Provider-specific configs
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback

VITE_GITHUB_CLIENT_ID=your-github-client-id
VITE_GITHUB_REDIRECT_URI=http://localhost:5173/callback

VITE_AUTH0_DOMAIN=your-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_REDIRECT_URI=http://localhost:5173/callback
```

> **Why VITE_ prefix?** Vite only exposes environment variables that start with `VITE_` to the browser bundle for security reasons.

### 3. Backend Configuration

Used by **Express.js backend**:

```bash
TRINO_HOST=trino
TRINO_PORT=8080
TRINO_CATALOG=tpch
TRINO_SCHEMA=sf1
```

### 4. Trino Configuration

Used by **Trino server**:

```bash
TRINO_INTERNAL_SECRET=trino-internal-secret-change-in-production
```

## How It Works

### 1. Docker Compose Configuration

All services reference the root `.env` file:

```yaml
services:
  trino:
    env_file:
      - .env  # ✅ Root .env
    
  backend:
    env_file:
      - .env  # ✅ Root .env
    
  frontend:
    env_file:
      - .env  # ✅ Root .env
```

### 2. Trino Environment Variable Substitution

Trino **natively supports** environment variables in `config.properties` using the `${ENV:VAR_NAME}` syntax:

**config.properties**:
```properties
http-server.authentication.oauth2.issuer=${ENV:OAUTH2_ISSUER_URL}
http-server.authentication.oauth2.jwks-url=${ENV:OAUTH2_JWKS_URL}
http-server.authentication.oauth2.client-id=${ENV:OAUTH2_CLIENT_ID}
http-server.authentication.oauth2.client-secret=${ENV:OAUTH2_CLIENT_SECRET}
http-server.authentication.oauth2.principal-field=${ENV:OAUTH2_PRINCIPAL_FIELD}
internal-communication.shared-secret=${ENV:TRINO_INTERNAL_SECRET}
```

At startup, Trino automatically replaces `${ENV:VAR_NAME}` with the actual environment variable values. No additional scripting needed!

### 3. Frontend Build-Time Variables

Vite injects `VITE_*` variables at **build time** into the browser bundle:

```javascript
// Frontend code can access them via import.meta.env
const backendUrl = import.meta.env.VITE_BACKEND_URL;
const provider = import.meta.env.VITE_OAUTH_PROVIDER;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
```

### 4. Backend Runtime Variables

Express.js accesses env vars at runtime via `process.env`:

```javascript
const trinoHost = process.env.TRINO_HOST;
const trinoPort = process.env.TRINO_PORT;
```

## Setup Instructions

### 1. Copy the Example File

```bash
cp .env.example .env
```

### 2. Configure Your OAuth2 Provider

#### For Google:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:5173/callback`
4. Update `.env`:
   ```bash
   VITE_OAUTH_PROVIDER=google
   OAUTH2_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
   OAUTH2_CLIENT_SECRET=<your-client-secret>
   VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
   OAUTH2_ISSUER_URL=https://accounts.google.com
   OAUTH2_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
   ```

#### For GitHub:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create New OAuth App
3. Set Authorization callback URL: `http://localhost:5173/callback`
4. Update `.env`:
   ```bash
   VITE_OAUTH_PROVIDER=github
   OAUTH2_CLIENT_ID=<your-github-client-id>
   OAUTH2_CLIENT_SECRET=<your-github-client-secret>
   VITE_GITHUB_CLIENT_ID=<your-github-client-id>
   OAUTH2_ISSUER_URL=https://github.com
   OAUTH2_JWKS_URL=https://token.actions.githubusercontent.com/.well-known/jwks
   ```

#### For Auth0:
1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create Application (Single Page Application)
3. Add Allowed Callback URL: `http://localhost:5173/callback`
4. Update `.env`:
   ```bash
   VITE_OAUTH_PROVIDER=auth0
   VITE_AUTH0_DOMAIN=<your-domain>.auth0.com
   VITE_AUTH0_CLIENT_ID=<your-client-id>
   OAUTH2_CLIENT_ID=<your-client-id>
   OAUTH2_CLIENT_SECRET=<your-client-secret>
   OAUTH2_ISSUER_URL=https://<your-domain>.auth0.com/
   OAUTH2_JWKS_URL=https://<your-domain>.auth0.com/.well-known/jwks.json
   ```

### 3. Start the Services

```bash
docker compose up -d
```

### 4. Verify Configuration

#### Check Backend Environment:
```bash
docker compose exec backend printenv | grep -E "TRINO_|OAUTH2_"
```

#### Check Frontend Environment:
```bash
docker compose exec frontend printenv | grep VITE_
```

#### Check Trino Configuration:
```bash
docker compose exec trino cat /etc/trino/config.properties
```

You should see the placeholders replaced with actual values.

## Updating Configuration

### To Change OAuth2 Provider:

1. Update `.env`:
   ```bash
   VITE_OAUTH_PROVIDER=github  # Change from google to github
   ```

2. Restart services:
   ```bash
   docker compose restart
   ```

### To Change Trino Settings:

1. Update `.env`:
   ```bash
   OAUTH2_ISSUER_URL=https://new-provider.com
   OAUTH2_JWKS_URL=https://new-provider.com/.well-known/jwks.json
   ```

2. Restart Trino (will automatically load new env vars):
   ```bash
   docker compose restart trino
   ```

3. Verify (Trino reads env vars at startup):
   ```bash
   docker compose logs trino | grep oauth2
   ```

## Benefits of Centralized Configuration

✅ **Single Source of Truth**: All configuration in one file  
✅ **No Duplication**: Don't repeat OAuth2 credentials across files  
✅ **Easy Updates**: Change provider in one place  
✅ **Version Control**: Only `.env` needs to be git-ignored  
✅ **Consistency**: Same values used by all services  
✅ **Security**: Secrets in one file, easier to protect  

## Troubleshooting

### Frontend can't access environment variables

**Problem**: `import.meta.env.VITE_GOOGLE_CLIENT_ID` is undefined

**Solution**: 
1. Variables must start with `VITE_`
2. Restart frontend container (Vite injects at build time)
   ```bash
   docker compose restart frontend
   ```

### Trino shows authentication errors

**Problem**: Trino can't validate JWT tokens

**Solution**: Check Trino logs for OAuth2 configuration:
```bash
docker compose logs trino | grep -i oauth
```

Verify environment variables are set:
```bash
docker compose exec trino printenv | grep OAUTH2_
```

If variables are missing, check that `.env` file exists and `docker-compose.yml` references it.

### Backend can't connect to Trino

**Problem**: Connection refused to Trino

**Solution**: Verify backend has correct Trino host:
```bash
docker compose exec backend printenv | grep TRINO_HOST
```

Should be `trino` (Docker service name), not `localhost`.

## Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
2. **Use strong secrets** - Change `TRINO_INTERNAL_SECRET` in production
3. **Restrict redirect URIs** - Only allow specific callback URLs in OAuth2 provider
4. **Use HTTPS in production** - Update all URLs from `http://` to `https://`
5. **Rotate credentials** - Regularly update `OAUTH2_CLIENT_SECRET`

## Migration from Old Setup

If you had separate `.env` files before:

```bash
# Old structure (removed)
frontend/.env  ❌
backend/.env   ❌

# New structure
.env  ✅ (consolidated)
```

All variables are now in the root `.env` with appropriate prefixes:
- `VITE_*` for frontend
- `OAUTH2_*` for Trino OAuth2
- `TRINO_*` for Trino connection settings

---

**Need Help?** Check the `.env.example` file for complete examples with all supported OAuth2 providers!
