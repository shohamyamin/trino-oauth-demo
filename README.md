# 🔐 Trino OAuth Demo

Full-stack application demonstrating OAuth 2.0 authentication (Authorization Code Flow with PKCE) for Trino queries.

## Features

- Authorization Code Flow with PKCE (RFC 7636)
- Multi-provider support (Google, GitHub, Auth0, Keycloak)
- React frontend with Express.js backend
- Docker Compose deployment
- Token refresh support

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OAuth2 credentials from Google, GitHub, Auth0, or Keycloak

### 1. Get OAuth2 Credentials

**Google** (Recommended):
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add redirect URI: `http://localhost:5173/callback`
4. Copy Client ID

### 2. Configure Environment

```bash
VITE_OAUTH_PROVIDER=google
OAUTH2_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback
VITE_BACKEND_URL=http://localhost:3001
TRINO_ADMIN_USERNAME=your-email@gmail.com
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
