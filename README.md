# 🔐 Trino OAuth Demo

Full-stack application demonstrating OAuth 2.0 authentication (Authorization Code Flow with PKCE) for Trino queries.

## Features

- **Two-Client OAuth Setup** for enhanced security (Public + Confidential clients)
- Authorization Code Flow with PKCE (RFC 7636)
- Multi-provider support (Google, GitHub, Auth0, Keycloak)
- React frontend with Express.js backend
- Docker Compose deployment
- Token refresh support

## Architecture

This application uses **two separate OAuth clients**:

1. **Public Client** - Frontend React app (no secret, uses PKCE)
2. **Confidential Client** - Trino server (has secret for token validation)

📖 **[Read the detailed Two-Client Setup Guide](./TWO_CLIENT_SETUP.md)**

### Why Two Clients?

- ✅ Better security isolation
- ✅ Follows OAuth 2.0 best practices
- ✅ Frontend compromise doesn't expose backend secrets
- ✅ Proper separation of concerns

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OAuth2 credentials from Google, GitHub, Auth0, or Keycloak
- **Two OAuth clients** (one public, one confidential)

### 1. Get OAuth2 Credentials

**You need to create TWO clients:**

**Google Example**:

**Client 1: Public (Frontend)**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID → Web Application
3. Name: `Trino OAuth Demo - Frontend`
4. Add redirect URI: `http://localhost:5173/callback`
5. Copy Client ID → `OAUTH2_PUBLIC_CLIENT_ID`

**Client 2: Confidential (Trino)**
1. Create another OAuth 2.0 Client ID → Web Application
2. Name: `Trino OAuth Demo - Trino Server`
3. Add redirect URIs: 
   - `http://localhost:8080/oauth2/callback`
   - `http://localhost:8080/ui/oauth2/callback`
4. Copy Client ID → `OAUTH2_TRINO_CLIENT_ID`
5. Copy Client Secret → `OAUTH2_TRINO_CLIENT_SECRET`

📖 **[Detailed setup instructions for all providers →](./TWO_CLIENT_SETUP.md)**

### 2. Configure Environment

Create a `.env` file with both clients:

```bash
# Provider selection
VITE_OAUTH_PROVIDER=google

# PUBLIC CLIENT - Frontend (no secret)
OAUTH2_PUBLIC_CLIENT_ID=your-public-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-public-client-id.apps.googleusercontent.com

# CONFIDENTIAL CLIENT - Trino (with secret)
OAUTH2_TRINO_CLIENT_ID=your-trino-client-id.apps.googleusercontent.com
OAUTH2_TRINO_CLIENT_SECRET=GOCSPX-your-trino-client-secret

# OAuth endpoints
OAUTH2_ISSUER_URL=https://accounts.google.com
OAUTH2_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
OAUTH2_PRINCIPAL_FIELD=email

# URLs
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback
VITE_BACKEND_URL=http://localhost:3001

# Admin user
TRINO_ADMIN_USERNAME=your-email@gmail.com

# Security
TRINO_INTERNAL_SECRET=change-this-to-random-string-min-256-bits
```

### 3. Start the Application

```bash
docker compose up -d
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Trino: http://localhost:8080

## Security

- Uses Authorization Code Flow with PKCE (RFC 7636)
- PKCE prevents code interception without client secrets
- State parameter for CSRF protection
- Automatic token refresh

## Project Structure

```
trino-oauth-demo/
├── frontend/          # React + Vite
│   └── src/auth/      # OAuth implementation
├── backend/           # Express.js API
│   └── src/server.js  # Token exchange + Trino proxy
├── trino/etc/         # Trino configuration
└── docker-compose.yml
```

## Access Control

Edit `trino/etc/rules.json` to configure user permissions. Default allows all authenticated users.

Example:
```json
{
  "catalogs": [{
    "user": "admin@example.com",
    "catalog": ".*",
    "allow": "all"
  }]
}
```

Restart after changes: `docker compose restart trino`



## Troubleshooting

```bash
# View logs
docker compose logs -f

# Check service health
curl http://localhost:3001/health
```

Common issues:
- **Token exchange failed**: Verify `OAUTH2_CLIENT_ID` and redirect URI
- **Access denied**: Check `TRINO_ADMIN_USERNAME` matches OAuth email

## License

MIT License
