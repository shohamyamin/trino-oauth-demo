# ============================================
# SETUP INSTRUCTIONS
# ============================================

This file contains your OAuth2 configuration. Follow these steps:

1. Choose your OAuth2 provider (Google, GitHub, Auth0, etc.)
2. Get OAuth2 credentials from your provider
3. Fill in the values below
4. Run: docker compose up -d --build

# ============================================
# Your OAuth2 Configuration
# ============================================

OAUTH2_PROVIDER_NAME=Google
OAUTH2_CLIENT_ID=YOUR_CLIENT_ID_HERE
OAUTH2_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
OAUTH2_AUTHORIZATION_URL=https://accounts.google.com/o/oauth2/v2/auth
OAUTH2_TOKEN_URL=https://oauth2.googleapis.com/token
OAUTH2_USERINFO_URL=https://www.googleapis.com/oauth2/v3/userinfo
OAUTH2_ISSUER_URL=https://accounts.google.com
OAUTH2_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
OAUTH2_SCOPES=openid email profile
OAUTH2_REDIRECT_URI=http://localhost:5173/callback
BACKEND_URL=http://localhost:3001

# ============================================
# Once you've filled in your credentials above,
# start the application with:
#   docker compose up -d --build
# ============================================
