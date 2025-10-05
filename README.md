# 🔐 Trino OAuth Demo - Generic OAuth2 Setup

A complete, containerized full-stack application demonstrating secure authentication for Trino queries using **any OAuth2/OIDC provider** (Google, GitHub, Auth0, Okta, etc.).

## 🎯 Key Features

- ✅ **Generic OAuth2 Support** - Works with Google, GitHub, Auth0, Okta, or any OAuth2/OIDC provider
- ✅ **No Local Keycloak** - Uses external OAuth providers to avoid Docker networking issues
- ✅ **JWT Validation** - Trino validates JWT tokens from your chosen provider
- ✅ **PKCE Flow** - Secure authorization code flow with PKCE
- ✅ **Production-Ready** - Easy to configure and deploy

## 🚀 Quick Start

### 1. Configure OAuth2 Provider

Choose your OAuth2 provider and get credentials:

#### **Google OAuth2** (Recommended for testing)
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Create **OAuth 2.0 Client ID** → **Web application**
4. Add authorized redirect URI: `http://localhost:5173/callback`
5. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit .env with your OAuth2 credentials
nano .env
```

### 3. Start the Application

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps
```

### 4. Access the Application

Open your browser to: **http://localhost:5173**

## 📦 See .env.example for all configuration options

Check the `.env.example` file for detailed configuration templates for:
- Google OAuth2
- GitHub OAuth
- Auth0
- Okta
- And more...
