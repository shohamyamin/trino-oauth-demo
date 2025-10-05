# 🔐 Trino OAuth Demo

A production-ready, containerized full-stack application demonstrating **secure OAuth 2.0 authentication** for Trino queries using modern security best practices.

## 🎯 What This Project Demonstrates

This project showcases:

- ✅ **Authorization Code Flow with PKCE** - Industry-standard OAuth 2.0 security (RFC 7636)
- ✅ **Multi-Provider Support** - Google, GitHub, Auth0, Keycloak, or any OAuth2/OIDC provider
- ✅ **Public Client Architecture** - No client secrets needed (PKCE provides cryptographic security)
- ✅ **Secure Token Exchange** - Backend proxy for authorization code-to-token exchange
- ✅ **Trino Integration** - Execute SQL queries with OAuth-authenticated access tokens
- ✅ **Production-Ready** - Docker Compose setup with proper security practices

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌──────────┐
│   Browser   │◄───────►│  OAuth Provider  │         │  Trino   │
│  React SPA  │         │  (Google, etc.)  │         │  Server  │
└──────┬──────┘         └──────────────────┘         └─────┬────┘
       │                                                     │
       │  ┌──────────────────────────────────────────┐     │
       └─►│         Backend (Express.js)             │◄────┘
          │  - Token Exchange (OAuth endpoint)       │
          │  - Query Proxy (Trino endpoint)          │
          └──────────────────────────────────────────┘
```

### OAuth Flow (Authorization Code with PKCE)

1. **User clicks "Login"** → Frontend generates PKCE code verifier & challenge
2. **Redirect to OAuth Provider** → User authenticates (e.g., with Google)
3. **Authorization Code Returned** → Provider redirects back with code
4. **Backend Token Exchange** → Code + verifier exchanged for access token
5. **Token to Frontend** → User can now make authenticated requests
6. **Query Trino** → Frontend sends SQL query with access token to backend
7. **Backend Proxy** → Validates token and forwards query to Trino
8. **Results Returned** → Query results sent back to frontend

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- OAuth2 provider credentials (Google recommended for testing)

### 1. Get OAuth2 Credentials

#### **Google OAuth2** (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized redirect URI: `http://localhost:5173/callback`
7. Copy your **Client ID** (Client Secret is optional with PKCE)

#### **Other Providers**

<details>
<summary>GitHub OAuth</summary>

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:5173/callback`
4. Copy Client ID and Client Secret
</details>

<details>
<summary>Auth0</summary>

1. Create an Auth0 account and application
2. Set Application Type: Single Page Application
3. Add Allowed Callback URLs: `http://localhost:5173/callback`
4. Copy Domain and Client ID
5. Enable PKCE in application settings
</details>

<details>
<summary>Keycloak (External)</summary>

1. Use your existing Keycloak instance
2. Create a new client in your realm
3. Set Client Type: Public
4. Enable Standard Flow, disable Implicit Flow
5. Add Valid Redirect URIs: `http://localhost:5173/callback`
6. Enable PKCE (required)
7. Copy your Keycloak URL, Realm name, and Client ID
</details>

### 2. Configure Environment

```bash
# Edit .env file with your OAuth2 credentials
nano .env
```

**Minimal configuration for Google:**

```bash
# Provider Selection
VITE_OAUTH_PROVIDER=google

# OAuth2 Credentials
OAUTH2_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
# OAUTH2_CLIENT_SECRET is OPTIONAL with PKCE (leave empty or set if required)

# Frontend
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback
VITE_BACKEND_URL=http://localhost:3001

# Admin user (your Google email)
TRINO_ADMIN_USERNAME=your-email@gmail.com
```

### 3. Start the Application

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

**Services started:**
- Frontend (React + Vite): http://localhost:5173
- Backend (Express.js): http://localhost:3001
- Trino: http://localhost:8080

### 4. Use the Application

1. **Open browser**: http://localhost:5173
2. **Click "Login"** → Redirects to your OAuth provider
3. **Authenticate** → Sign in with your credentials
4. **Execute queries** → Try sample queries against Trino's TPCH dataset

**Sample SQL Queries:**

```sql
-- List all customers
SELECT * FROM tpch.sf1.customer LIMIT 10

-- Top 5 nations by customer count
SELECT n.name, COUNT(*) as customer_count
FROM tpch.sf1.customer c
JOIN tpch.sf1.nation n ON c.nationkey = n.nationkey
GROUP BY n.name
ORDER BY customer_count DESC
LIMIT 5

-- Show available catalogs
SHOW CATALOGS

-- Show schemas
SHOW SCHEMAS FROM tpch
```

## 🔒 Security Features

### Why Authorization Code Flow with PKCE?

This implementation uses **OAuth 2.0 Security Best Current Practice**:

**❌ Implicit Flow (Deprecated):**
- Tokens exposed in URL hash fragments
- Tokens visible in browser history
- No refresh token support
- Being phased out by providers

**✅ Authorization Code Flow with PKCE (Modern):**
- Tokens never in URLs (only authorization code)
- PKCE prevents code interception attacks
- No client secret needed for public clients (SPAs)
- Refresh token support
- Industry standard (RFC 7636)

### PKCE (Proof Key for Code Exchange)

**How it works:**
1. Frontend generates random `code_verifier` (128 characters)
2. Frontend computes `code_challenge` = SHA256(code_verifier)
3. Authorization request includes `code_challenge`
4. Authorization code returned to frontend
5. Frontend sends code + `code_verifier` to backend
6. Backend exchanges with provider (validates verifier matches challenge)
7. Only the original client can complete the exchange

**Benefits:**
- ✅ Prevents authorization code interception
- ✅ Works without client secrets
- ✅ Cryptographically secure
- ✅ Required by many providers for SPAs

### Why No Client Secret?

For **public clients** (browsers, mobile apps), client secrets provide no real security:

- Any "secret" in browser code can be extracted
- PKCE provides cryptographic security without secrets
- Simpler configuration and deployment
- Any application can connect (users authenticate with their own credentials)

**Client secrets ARE required for:**
- Confidential clients (backend-to-backend)
- Legacy OAuth providers without PKCE support
- Additional security layer if organization policy requires

## 📁 Project Structure

```
trino-oauth-demo/
├── frontend/              # React + Vite SPA
│   ├── src/
│   │   ├── auth/
│   │   │   ├── AuthProvider.jsx    # Auth context & state management
│   │   │   └── oauth.js            # OAuth config & PKCE implementation
│   │   ├── App.jsx                 # Main application component
│   │   └── main.jsx
│   ├── Dockerfile
│   └── package.json
├── backend/               # Express.js API server
│   ├── src/
│   │   └── server.js               # OAuth token exchange + Trino proxy
│   ├── Dockerfile
│   └── package.json
├── trino/                 # Trino configuration
│   ├── etc/
│   │   ├── config.properties       # Trino server config
│   │   ├── access-control.properties  # Authorization rules
│   │   └── catalog/
│   │       └── tpch.properties     # Sample data catalog
│   └── docker-entrypoint.sh
├── docker-compose.yml     # Docker services orchestration
└── .env                   # Environment configuration
```

## ⚙️ Configuration

### Environment Variables

The `.env` file contains all configuration. Key sections:

#### OAuth Provider Selection
```bash
VITE_OAUTH_PROVIDER=google  # google | github | auth0 | keycloak
```

#### OAuth Credentials (same for all providers)
```bash
OAUTH2_CLIENT_ID=your-client-id
OAUTH2_CLIENT_SECRET=optional-with-pkce  # Can be empty
```

#### Frontend Configuration
```bash
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback
VITE_BACKEND_URL=http://localhost:3001
```

#### Trino Authorization
```bash
TRINO_ADMIN_USERNAME=your-email@gmail.com  # Must match token email
```

### Switching Providers

To switch from Google to another provider:

1. Update `VITE_OAUTH_PROVIDER` in `.env`
2. Configure provider-specific variables (e.g., `VITE_GITHUB_CLIENT_ID`)
3. Restart services: `docker-compose restart`

## 🎓 What You Can Learn

This project demonstrates:

### OAuth 2.0 Best Practices
- ✅ Authorization Code Flow with PKCE (RFC 7636)
- ✅ State parameter for CSRF protection
- ✅ Secure token storage (sessionStorage)
- ✅ Token expiration handling
- ✅ Public client architecture

### Modern Web Development
- ✅ React with Context API for state management
- ✅ Vite for fast development and building
- ✅ Express.js RESTful API design
- ✅ Docker Compose multi-container setup
- ✅ Environment-based configuration

### Security Concepts
- ✅ Why client secrets aren't needed for SPAs
- ✅ How PKCE prevents code interception
- ✅ JWT token structure and validation
- ✅ Backend as authentication proxy
- ✅ Secure token exchange patterns

### Trino Integration
- ✅ OAuth 2.0 authentication with Trino
- ✅ JWT token validation
- ✅ Access control and authorization
- ✅ Query execution with bearer tokens
- ✅ Catalog and schema management

## 🧪 Testing & Debugging

### Check Service Health

```bash
# All services
docker-compose ps

# Backend health
curl http://localhost:3001/health

# Trino
curl http://localhost:8080/v1/info
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f trino
```

### Debug OAuth Flow

1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Login"
4. Watch for:
   - Authorization redirect (with `code_challenge` parameter)
   - Callback redirect (with `code` parameter)
   - POST to `/api/oauth/token` (code exchange)
   - Token response

### Common Issues

**"Token exchange failed"**
- Check `OAUTH2_CLIENT_ID` matches your provider
- Verify redirect URI is exactly: `http://localhost:5173/callback`
- Check backend can reach OAuth provider (network/firewall)

**"Invalid token" when querying Trino**
- Ensure `TRINO_ADMIN_USERNAME` matches email in your OAuth token
- Check Trino logs: `docker-compose logs trino`
- Verify token has correct audience claim

**"Access denied" errors**
- Check `TRINO_ADMIN_USERNAME` in `.env`
- Review `trino/etc/rules.json` authorization rules
- Ensure user email matches OAuth token

## 🛠️ Development

### Local Development (without Docker)

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Trino:**
Run via Docker:
```bash
docker-compose up trino
```

### Making Changes

1. Edit source files
2. Rebuild services: `docker-compose up -d --build`
3. Check logs: `docker-compose logs -f`

## 📚 References

### OAuth 2.0 Standards
- [RFC 7636 - Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 8252 - OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)

### Provider Documentation
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [Auth0 PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce)
- [Keycloak Securing Apps](https://www.keycloak.org/docs/latest/securing_apps/)

### Trino Documentation
- [Trino OAuth 2.0 Authentication](https://trino.io/docs/current/security/oauth2.html)
- [Trino Access Control](https://trino.io/docs/current/security/built-in-system-access-control.html)

## 🤝 Contributing

This is a demonstration project. Feel free to:
- Fork and modify for your use case
- Submit issues for bugs or questions
- Share improvements or suggestions

## 📄 License

MIT License - feel free to use this project for learning or as a starting point for your own applications.

## 🎯 Use Cases

This project can be adapted for:

- **Internal tools** - Secure SQL query interfaces for teams
- **Data exploration** - Self-service analytics with OAuth authentication
- **Multi-tenant applications** - User-based query authorization
- **BI integrations** - OAuth-protected data access layers
- **Learning OAuth 2.0** - Understanding modern authentication flows
- **Trino evaluation** - Testing Trino with OAuth authentication

## ⚡ Next Steps

To extend this project:

- [ ] Add refresh token handling
- [ ] Implement token refresh on expiration
- [ ] Add query history and favorites
- [ ] Implement role-based access control
- [ ] Add query result visualization
- [ ] Support multiple Trino catalogs
- [ ] Add query scheduling
- [ ] Implement audit logging
- [ ] Deploy to production (Kubernetes, cloud platforms)

---

**Built with ❤️ to demonstrate OAuth 2.0 best practices for Trino authentication**
