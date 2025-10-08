# 🔐 Trino OAuth Demo

## 🎯 Goal

This demo showcases how to integrate **OAuth 2.0 authentication** with **Trino** (a distributed SQL query engine) using modern security best practices. The application demonstrates:

- **Secure OAuth 2.0 Flow**: Authorization Code Flow with PKCE (Proof Key for Code Exchange)
- **Two-Client Architecture**: Separate public (frontend) and confidential (backend/Trino) OAuth clients
- **End-to-End Integration**: From user login through OAuth to executing authenticated Trino queries
- **Multiple Connection Methods**: Web app, Trino UI, and JDBC clients (DBeaver) with SSO
- **Generic OAuth Support**: Works with any OAuth 2.0 provider (Keycloak, Auth0, Okta, Google, etc.)

This is a complete reference implementation for anyone looking to secure their Trino deployment with OAuth 2.0 authentication.

### OAuth Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OAuth 2.0 Flow with PKCE                           │
└─────────────────────────────────────────────────────────────────────────────┘

    Browser/User          Frontend          Keycloak         Backend          Trino
        │                  (React)         (OAuth IdP)      (Express)      (SQL Engine)
        │                    │                  │               │               │
        │  1. Visit App      │                  │               │               │
        ├───────────────────>│                  │               │               │
        │                    │                  │               │               │
        │  2. Click Login    │                  │               │               │
        ├───────────────────>│                  │               │               │
        │                    │                  │               │               │
        │                    │ 3. Redirect to   │               │               │
        │                    │    /authorize    │               │               │
        │                    │   (with PKCE)    │               │               │
        │<───────────────────┼─────────────────>│               │               │
        │                    │                  │               │               │
        │  4. Show Login     │                  │               │               │
        │     Form           │                  │               │               │
        │<────────────────────────────────────  │               │               │
        │                    │                  │               │               │
        │  5. Enter          │                  │               │               │
        │     Credentials    │                  │               │               │
        ├─────────────────────────────────────>│               │               │
        │                    │                  │               │               │
        │  6. Redirect with  │                  │               │               │
        │     Auth Code      │                  │               │               │
        │<───────────────────┼──────────────────┤               │               │
        │                    │                  │               │               │
        │  7. Send Auth Code │                  │               │               │
        │    + PKCE Verifier │                  │               │               │
        ├───────────────────>│                  │               │               │
        │                    │                  │               │               │
        │                    │ 8. Forward Code  │               │               │
        │                    │   to Backend     │               │               │
        │                    ├─────────────────────────────────>│               │
        │                    │                  │               │               │
        │                    │                  │ 9. Exchange   │               │
        │                    │                  │    Code for   │               │
        │                    │                  │    Tokens     │               │
        │                    │                  │   (+ PKCE)    │               │
        │                    │                  │<──────────────┤               │
        │                    │                  │               │               │
        │                    │                  │ 10. Tokens    │               │
        │                    │                  │    (Access +  │               │
        │                    │                  │     ID Token) │               │
        │                    │                  ├──────────────>│               │
        │                    │                  │               │               │
        │                    │ 11. Return Tokens│               │               │
        │                    │<─────────────────────────────────┤               │
        │                    │                  │               │               │
        │ 12. Logged In      │                  │               │               │
        │    (Store Tokens)  │                  │               │               │
        │<───────────────────┤                  │               │               │
        │                    │                  │               │               │
        │ 13. Run SQL Query  │                  │               │               │
        ├───────────────────>│                  │               │               │
        │                    │                  │               │               │
        │                    │ 14. Proxy Query  │               │               │
        │                    │    with Token    │               │               │
        │                    ├─────────────────────────────────>│               │
        │                    │                  │               │               │
        │                    │                  │               │ 15. Execute   │
        │                    │                  │               │     Query     │
        │                    │                  │               │  (with OAuth) │
        │                    │                  │               ├──────────────>│
        │                    │                  │               │               │
        │                    │                  │               │ 16. Results   │
        │                    │                  │               │<──────────────┤
        │                    │                  │               │               │
        │                    │ 17. Results      │               │               │
        │                    │<─────────────────────────────────┤               │
        │                    │                  │               │               │
        │ 18. Display Data   │                  │               │               │
        │<───────────────────┤                  │               │               │
        │                    │                  │               │               │

Key Components:
  • Frontend (React): Initiates OAuth flow with PKCE, handles user interaction
  • Backend (Express): Exchanges auth codes for tokens, proxies queries to Trino
  • Keycloak: OAuth 2.0 Identity Provider, manages authentication and issues tokens
  • Trino: Confidential OAuth client, validates tokens and executes SQL queries
```

## 🚀 Quick Start (3 Steps)

### Step 1: Create Environment File
```bash
cp .env.example .env
```
No changes needed - the example file is pre-configured for Keycloak!

### Step 2: Start All Services
```bash
docker compose up -d
```
Wait ~1 minute for services to initialize.

### Step 3: Open and Test
1. Open http://localhost:5173
2. Click **Login** → Use credentials: `shomo` / `password`
3. Click **Run Query** to test Trino integration
4. See results! 🎉

**Requirements:** Linux with Docker Engine (not Docker Desktop - see details below)

---

## 🔌 Connecting to Trino

This demo configures Trino with OAuth 2.0 authentication and provides **multiple ways to connect**:

### 1. **Demo Application** (React + Backend)
Access authenticated Trino queries through the web UI:
- **URL**: http://localhost:5173
- Login with OAuth, run queries directly from the browser
- Backend handles token management and proxies requests to Trino

### 2. **Trino Web UI** (with OAuth)
Access Trino's native web interface with OAuth authentication:
- **URL**: https://localhost:8443
- Accept the self-signed certificate
- Authenticate with OAuth (redirects to Keycloak)
- View query history, cluster status, and execute queries

### 3. **DBeaver / JDBC** (with SSO)
Connect using external authentication (OAuth SSO):
- **Connection String**: `jdbc:trino://localhost:8443`
- **Authentication**: Select "External Authentication" in DBeaver trino driver settings"
- **SSL**: Required (uses self-signed certificate), set SSLVerification to NONE(not for production)
- Opens browser for OAuth login, then connects to Trino

All three methods authenticate through the same Keycloak OAuth server, providing a unified security model across all access points.

---

## Features

- **Two-Client OAuth Setup** for enhanced security (Public + Confidential clients)
- Authorization Code Flow with PKCE (RFC 7636)
- Generic OAuth 2.0 support (works with any OAuth provider)
- React frontend with Express.js backend
- Docker Compose deployment with pre-configured Keycloak
- Token refresh support

## Architecture

This application uses **two separate OAuth clients**:

1. **Public Client (query-app)** - Frontend React app (no secret, uses PKCE)
2. **Confidential Client (trino)** - Trino server (has secret for token validation)

### Why Two Clients?

- ✅ Better security isolation
- ✅ Follows OAuth 2.0 best practices
- ✅ Frontend compromise doesn't expose backend secrets
- ✅ Proper separation of concerns

## Detailed Setup & Configuration

### Docker Requirements

- **Linux Docker Engine** (native) - Required for this demo
  - ⚠️ **Docker Desktop is NOT recommended** - It has networking limitations that cause issues with Keycloak OAuth redirects when using `network_mode: host`
  - The demo uses `network_mode: host` for Keycloak to avoid redirect URL mismatches between containers and the host
  - Native Docker Engine on Linux properly supports host networking
  - If you're on macOS/Windows, you may need to modify the networking setup or use a Linux VM

### Environment Configuration Details

The `.env.example` file contains all necessary configuration for the included Keycloak setup.

**Using the included Keycloak (Default):**

The `.env.example` file is pre-configured and ready to use. No changes needed!

**Using your own OAuth provider (Advanced):**

If you want to use Auth0, Okta, Google, or another OAuth provider, edit the `.env` file and update the OAuth endpoints and credentials.

### Keycloak Details

This demo includes a **pre-configured Keycloak instance** with everything set up out of the box. The Keycloak service will start automatically with `docker compose up`.

**Keycloak Access:**
- URL: http://localhost:8080
- Admin Console: http://localhost:8080/admin
- Admin credentials: `admin` / `admin`
- Realm: `trino-demo-oauth`
- Pre-configured test user: `shomo` / `password`

The included realm has:
- ✅ Two OAuth clients (`query-app` and `trino`) already configured
- ✅ Proper audience mappers for token validation
- ✅ Correct redirect URIs set up
- ✅ Test user ready to use

**Using a different OAuth provider:**

If you want to use Auth0, Okta, Google, or another provider instead of Keycloak, you'll need to:
1. Create two OAuth clients (public and confidential) in your provider
2. Configure proper audience/scope settings
3. Update all OAuth URLs in your `.env` file

### What Happens on Startup

When you run `docker compose up -d`, the following happens:

1. Build the frontend and backend Docker images
2. Start Keycloak with the pre-configured realm
3. Start Trino with OAuth authentication enabled
4. Start the backend API and frontend development server

Wait a minute for all services to initialize, then access:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Trino Web UI**: https://localhost:8443 (accept self-signed certificate)
- **Keycloak Admin**: http://localhost:8080/admin (credentials: `admin`/`admin`)

## Usage & Testing

### Running Your First Query

1. Open http://localhost:5173 in your browser
2. Click "Login" - you'll be redirected to Keycloak
3. Login with default user: `shomo` / `password`
4. After successful authentication, you'll be redirected back to the app
5. Click "Run Query" to execute a sample Trino query
6. View the query results displayed in the UI

## Security

- Uses Authorization Code Flow with PKCE (RFC 7636)
- PKCE prevents code interception without client secrets
- State parameter for CSRF protection
- Automatic token refresh

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

## License

MIT License
