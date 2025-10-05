import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { Trino } from 'trino-client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// OAuth2 provider configurations
const getOAuthProviderConfig = (provider) => {
  const configs = {
    google: {
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: process.env.OAUTH2_CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    },
    github: {
      tokenUrl: 'https://github.com/login/oauth/access_token',
      clientId: process.env.OAUTH2_CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    },
    auth0: {
      tokenUrl: `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      clientId: process.env.OAUTH2_CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    },
    keycloak: {
      tokenUrl: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
      clientId: process.env.OAUTH2_CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    },
  };

  return configs[provider] || configs.google;
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// OAuth2 token exchange endpoint (Authorization Code Flow with PKCE)
app.post('/api/oauth/token', async (req, res) => {
  try {
    const { code, codeVerifier, redirectUri, provider = 'google' } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Authorization code is required',
      });
    }

    console.log('🔄 Exchanging authorization code for tokens...');
    console.log('Provider:', provider);

    const providerConfig = getOAuthProviderConfig(provider);

    // Prepare token exchange request
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: providerConfig.clientId,
    });

    // Add PKCE code verifier if provided
    if (codeVerifier) {
      tokenParams.append('code_verifier', codeVerifier);
      console.log('✅ Using PKCE code verifier');
    }

    // For confidential clients (when client secret is available and explicitly set)
    // Note: With PKCE, client secret is NOT required for public clients (SPAs)
    // Only include client_secret if it's explicitly configured and not a placeholder
    if (providerConfig.clientSecret && 
        providerConfig.clientSecret !== 'not-needed-for-pkce' &&
        providerConfig.clientSecret.trim() !== '') {
      tokenParams.append('client_secret', providerConfig.clientSecret);
      console.log('✅ Using client secret for confidential client');
    } else {
      console.log('ℹ️ Using PKCE without client secret (public client mode)');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorText);
      return res.status(tokenResponse.status).json({
        error: 'Token Exchange Failed',
        message: 'Failed to exchange authorization code for tokens',
        details: errorText,
      });
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Token exchange successful');

    // Return tokens to frontend
    res.json({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      token_type: tokens.token_type || 'Bearer',
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    console.error('❌ Error during token exchange:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An error occurred during token exchange',
    });
  }
});

// Helper function to decode JWT (without verification - just for user extraction)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Not a JWT, return null
      return null;
    }
    // Decode base64url (handle both standard base64 and base64url encoding)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (error) {
    console.error('Failed to decode JWT:', error.message);
    return null;
  }
}

// Query endpoint - acts as a secure proxy to Trino
app.post('/api/query', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing or invalid Authorization header' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Query string is required' 
      });
    }

    console.log(`Executing query: ${query.substring(0, 50)}...`);
    console.log(`Token length: ${token.length}`);
    console.log(`Token starts with: ${token.substring(0, 100)}`);

    // Extract user from token (if JWT) or use default
    const decoded = decodeJWT(token);
    const user = decoded?.email || decoded?.sub || decoded?.preferred_username || 'oauth-user';
    
    console.log(`User from token: ${user}`);
    console.log(`Decoded token:`, decoded);

    // Configure Trino client with Bearer token authentication
    // We need to send both the Bearer token (for OAuth2) and X-Trino-User header
    const client = Trino.create({
      server: `http://${process.env.TRINO_HOST}:${process.env.TRINO_PORT}`,
      catalog: process.env.TRINO_CATALOG || 'tpch',
      schema: process.env.TRINO_SCHEMA || 'sf1',
      source: 'trino-oauth-demo',
      user: user,  // This should set X-Trino-User header
      extraHeaders: {
        'Authorization': `Bearer ${token}`,  // OAuth2 Bearer token
        'X-Trino-User': user  // Explicitly set the user header
      }
    });

    // Execute query using async iterator
    const results = [];
    const iterator = await client.query(query);
    
    for await (const queryResult of iterator) {
      if (queryResult.data) {
        results.push(...queryResult.data);
      }
    }

    console.log(`Query executed successfully. Rows returned: ${results.length}`);

    res.json({
      success: true,
      data: results,
      rowCount: results.length
    });

  } catch (error) {
    console.error('Error executing query:', error);
    
    // Handle specific error types
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid or expired token. Please log in again.',
        details: error.message
      });
    }

    if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      return res.status(403).json({
        error: 'Authorization Failed',
        message: 'Token does not have required audience claim or permissions.',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Query Execution Failed',
      message: error.message || 'An error occurred while executing the query',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://0.0.0.0:${PORT}`);
  console.log(`Trino connection: http://${process.env.TRINO_HOST}:${process.env.TRINO_PORT}`);
});