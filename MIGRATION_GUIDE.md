# Migration Guide: Single Client → Two Client Setup

## Overview

This guide helps you migrate from the old single-client OAuth setup to the new two-client setup for better security.

## What Changed?

### Before (Single Client)
```bash
# One client for everything
OAUTH2_CLIENT_ID=same-id-everywhere
OAUTH2_CLIENT_SECRET=shared-secret
```

- ❌ Frontend and Trino used the same OAuth client
- ❌ Client secret exposed in multiple places
- ❌ Single point of failure

### After (Two Clients)
```bash
# Public client for frontend (no secret)
OAUTH2_PUBLIC_CLIENT_ID=public-client-id

# Confidential client for Trino (with secret)
OAUTH2_TRINO_CLIENT_ID=trino-client-id
OAUTH2_TRINO_CLIENT_SECRET=trino-client-secret
```

- ✅ Separate clients for frontend and Trino
- ✅ Client secret only used by Trino (server-side)
- ✅ Better security isolation

## Migration Steps

### Step 1: Create Second OAuth Client

Go to your OAuth provider and create a **second** client:

#### For Google:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Application Type: **Web Application**
4. Name: `Trino OAuth Demo - Trino Server`
5. Authorized redirect URIs:
   - `http://localhost:8080/oauth2/callback`
   - `http://localhost:8080/ui/oauth2/callback`
6. Click "Create"
7. Copy both the **Client ID** and **Client Secret**

#### For Auth0:
1. Go to Auth0 Dashboard → Applications
2. Click "Create Application"
3. Name: `Trino OAuth Demo - Trino`
4. Application Type: **Regular Web Application**
5. Settings → Application URIs:
   - Allowed Callback URLs: `http://localhost:8080/oauth2/callback,http://localhost:8080/ui/oauth2/callback`
6. Copy Client ID and Client Secret

#### For Keycloak:
1. Go to Keycloak Admin Console
2. Clients → Create
3. Client ID: `trino-server`
4. Client Protocol: `openid-connect`
5. Access Type: **Confidential**
6. Valid Redirect URIs: `http://localhost:8080/*`
7. Save
8. Go to "Credentials" tab and copy the Secret

### Step 2: Update Environment Variables

Update your `.env` file:

```bash
# OLD (remove these)
# OAUTH2_CLIENT_ID=old-shared-id
# OAUTH2_CLIENT_SECRET=old-shared-secret

# NEW - Public client for frontend
OAUTH2_PUBLIC_CLIENT_ID=your-existing-client-id  # Keep your existing client ID here

# NEW - Confidential client for Trino (from Step 1)
OAUTH2_TRINO_CLIENT_ID=your-new-trino-client-id
OAUTH2_TRINO_CLIENT_SECRET=your-new-trino-client-secret

# Also update the frontend variables to use the public client
VITE_GOOGLE_CLIENT_ID=your-existing-client-id  # Same as OAUTH2_PUBLIC_CLIENT_ID
# or for other providers:
# VITE_GITHUB_CLIENT_ID=your-existing-client-id
# VITE_AUTH0_CLIENT_ID=your-existing-client-id
# VITE_KEYCLOAK_CLIENT_ID=your-existing-client-id
```

**Pro Tip**: Your existing OAuth client can become the public client. You only need to create ONE new client (the confidential Trino client).

### Step 3: Update Configuration Files (Automatic)

The configuration files have already been updated in the `two-client-setup` branch:

- ✅ `trino/etc/config.properties` - Now uses `OAUTH2_TRINO_CLIENT_ID` and `OAUTH2_TRINO_CLIENT_SECRET`
- ✅ `backend/src/server.js` - Now uses `OAUTH2_PUBLIC_CLIENT_ID`
- ✅ `.env.example` - Updated with new variable names

### Step 4: Restart Services

```bash
# Stop current services
docker compose down

# Remove old containers to ensure clean start
docker compose rm -f

# Start with new configuration
docker compose up -d

# Watch the logs
docker compose logs -f
```

### Step 5: Test the Setup

1. **Access the frontend**: http://localhost:5173
2. **Click "Login"** - should redirect to OAuth provider
3. **Grant permissions** and login
4. **Run a test query**: `SELECT * FROM tpch.tiny.nation LIMIT 5`
5. **Check Trino logs**: Should see successful authentication
   ```bash
   docker compose logs trino | grep -i oauth
   ```

### Step 6: Verify Token Flow

Check that tokens are being accepted:

```bash
# Backend logs - should show successful token exchange
docker compose logs backend | grep -i token

# Trino logs - should show successful authentication
docker compose logs trino | grep -i authentication
```

## Troubleshooting Migration

### Issue: "Missing environment variable OAUTH2_PUBLIC_CLIENT_ID"

**Cause**: Didn't update variable names in `.env`

**Fix**:
```bash
# In your .env file, rename:
OAUTH2_CLIENT_ID → OAUTH2_PUBLIC_CLIENT_ID
```

### Issue: "Token audience validation failed"

**Cause**: Trino not configured to accept tokens from public client

**Fix**: Ensure your `.env` has:
```bash
OAUTH2_PUBLIC_CLIENT_ID=your-public-client-id
OAUTH2_TRINO_CLIENT_ID=your-trino-client-id  # Must be different
```

The Trino config automatically includes:
```properties
http-server.authentication.oauth2.additional-audiences=${ENV:OAUTH2_PUBLIC_CLIENT_ID}
```

### Issue: "invalid_client" error during login

**Cause**: Frontend using wrong client ID or redirect URI mismatch

**Fix**: 
1. Check that `VITE_GOOGLE_CLIENT_ID` (or other provider) matches `OAUTH2_PUBLIC_CLIENT_ID`
2. Verify redirect URI in OAuth provider matches `.env`:
   ```bash
   VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/callback
   ```

### Issue: "Authentication failed" when querying Trino

**Cause**: Trino client credentials not set correctly

**Fix**:
1. Verify you created a second OAuth client for Trino
2. Check that `OAUTH2_TRINO_CLIENT_SECRET` is set in `.env`
3. Restart Trino: `docker compose restart trino`

### Issue: Frontend works but Trino rejects tokens

**Cause**: Token issued to public client, but Trino not accepting it

**Fix**: The `additional-audiences` configuration should be automatic. Verify:
```bash
# Check Trino logs for audience error
docker compose logs trino | grep -i audience

# Ensure environment variables are loaded
docker compose exec trino env | grep OAUTH2
```

## Rollback (If Needed)

If you need to rollback to the single-client setup:

```bash
# Switch back to main branch
git checkout main

# Update .env to use old variable names
OAUTH2_CLIENT_ID=your-client-id
OAUTH2_CLIENT_SECRET=your-client-secret  # if you had one

# Restart
docker compose down
docker compose up -d
```

## Verification Checklist

After migration, verify:

- [ ] Two OAuth clients created in provider
- [ ] `.env` file updated with new variable names
- [ ] `OAUTH2_PUBLIC_CLIENT_ID` set (frontend client)
- [ ] `OAUTH2_TRINO_CLIENT_ID` set (Trino client)
- [ ] `OAUTH2_TRINO_CLIENT_SECRET` set
- [ ] All services start without errors: `docker compose ps`
- [ ] Can login through frontend
- [ ] Can execute Trino queries
- [ ] Token refresh works (wait for expiration)

## Benefits After Migration

✅ **Better Security**:
- Frontend compromise doesn't expose Trino's credentials
- Client secret only exists server-side

✅ **OAuth Best Practices**:
- Public clients use PKCE (no secrets)
- Confidential clients use secrets properly

✅ **Audit Trail**:
- Can track which client made which requests
- Different scopes/permissions per client

✅ **Scalability**:
- Can add more clients for different apps
- Each client has its own credentials

## Support

If you encounter issues:

1. Check the logs: `docker compose logs -f`
2. Review the [Two-Client Setup Guide](./TWO_CLIENT_SETUP.md)
3. Verify your OAuth provider configuration
4. Ensure both clients are properly created

## Summary

| Step | Action | Status |
|------|--------|--------|
| 1 | Create second OAuth client (Trino) | ⬜ |
| 2 | Update `.env` with new variables | ⬜ |
| 3 | Configuration files updated (automatic) | ✅ |
| 4 | Restart services | ⬜ |
| 5 | Test login and queries | ⬜ |
| 6 | Verify token flow | ⬜ |

Once all steps are complete, you'll have a more secure OAuth setup! 🎉
