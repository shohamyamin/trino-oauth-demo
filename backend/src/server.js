import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { Trino } from 'trino-client';

dotenv.config();

const requiredEnvVars = ['OAUTH2_PUBLIC_CLIENT_ID', 'OAUTH2_TOKEN_URL', 'TRINO_HOST'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const TRINO_HOST = process.env.TRINO_HOST || 'trino';
const TRINO_PORT = process.env.TRINO_PORT || '8080';

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// OAuth configuration
const getOAuthConfig = () => {
  return {
    tokenUrl: process.env.OAUTH2_TOKEN_URL,
    clientId: process.env.OAUTH2_PUBLIC_CLIENT_ID || 'query-app',
  };
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.post('/api/oauth/token', async (req, res) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Authorization code is required',
      });
    }

    const oauthConfig = getOAuthConfig();

    // Prepare token exchange request
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: oauthConfig.clientId,
    });

    // Add PKCE code verifier (required for public clients)
    if (codeVerifier) {
      tokenParams.append('code_verifier', codeVerifier);
    }

    const tokenResponse = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.status(tokenResponse.status).json({
        error: 'Token Exchange Failed',
        message: 'Failed to exchange authorization code for tokens',
        details: errorText,
      });
    }

    const tokens = await tokenResponse.json();
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

app.post('/api/oauth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    const oauthConfig = getOAuthConfig();

    // Prepare token refresh request
    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: oauthConfig.clientId,
    });

    const tokenResponse = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', errorText);
      return res.status(tokenResponse.status).json({
        error: 'Token Refresh Failed',
        message: 'Failed to refresh access token',
        details: errorText,
      });
    }

    const tokens = await tokenResponse.json();
    res.json({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      token_type: tokens.token_type || 'Bearer',
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token, // Some providers return new refresh token
    });
  } catch (error) {
    console.error('❌ Error during token refresh:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An error occurred during token refresh',
    });
  }
});

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

app.post('/api/query', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing or invalid Authorization header' 
      });
    }

    const token = authHeader.substring(7);
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Query string is required' 
      });
    }

    if (query.length > 10000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query exceeds maximum length of 10000 characters'
      });
    }

    const decoded = decodeJWT(token);
    console.log('📋 Decoded token claims:', JSON.stringify({
      sub: decoded?.sub,
      email: decoded?.email,
      preferred_username: decoded?.preferred_username,
      name: decoded?.name,
      aud: decoded?.aud,
      azp: decoded?.azp,
      client_id: decoded?.client_id,
      iss: decoded?.iss,
    }, null, 2));
    
    // IMPORTANT: Use the same principal field as Trino's config
    // Trino uses: http-server.authentication.oauth2.principal-field=${ENV:OAUTH2_PRINCIPAL_FIELD}
    const principalField = process.env.OAUTH2_PRINCIPAL_FIELD || 'preferred_username';
    const user = decoded?.[principalField] || decoded?.email || decoded?.sub || 'oauth-user';
    
    console.log(`👤 Principal field: ${principalField}`);
    console.log(`👤 Extracted username: ${user}`);
    console.log(`🔐 Token audience (aud): ${JSON.stringify(decoded?.aud)}`);
    
    const client = Trino.create({
      server: `https://${TRINO_HOST}:${TRINO_PORT}`,
      catalog: process.env.TRINO_CATALOG || 'tpch',
      schema: process.env.TRINO_SCHEMA || 'sf1',
      source: 'trino-oauth-demo',
      user: user,
      extraHeaders: {
        'Authorization': `Bearer ${token}`,
        'X-Trino-User': user
      }
    });

    const results = [];
    const iterator = await client.query(query);
    
    for await (const queryResult of iterator) {
      if (queryResult.data) {
        results.push(...queryResult.data);
      }
    }

    res.json({
      success: true,
      data: results,
      rowCount: results.length
    });

  } catch (error) {
    console.error('Error executing query:', error);
    
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
  console.log(`Trino connection: http://${TRINO_HOST}:${TRINO_PORT}`);
});