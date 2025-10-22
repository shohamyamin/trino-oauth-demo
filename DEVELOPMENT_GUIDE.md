# Trino OAuth2 with PKCE - Development Guide

This guide demonstrates how to implement OAuth2 authentication with PKCE (Proof Key for Code Exchange) to connect to Trino. This implementation uses a React frontend and Express.js backend.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Implementation](#backend-implementation)
6. [Environment Configuration](#environment-configuration)
7. [Testing](#testing)

## Overview

This implementation uses OAuth2 Authorization Code Flow with PKCE, which is the recommended approach for public clients (like SPAs) connecting to Trino. PKCE adds an additional layer of security by preventing authorization code interception attacks.

### Key Components

- **Frontend (React)**: Handles OAuth2 flow, PKCE challenge generation, and token management
- **Backend (Express.js)**: Proxies token exchange requests and executes Trino queries with authenticated tokens
- **OAuth Provider**: Issues access tokens (e.g., Keycloak, Auth0, Okta)
- **Trino**: Data query engine that validates OAuth2 tokens

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌─────────┐
│   Browser   │─────▶│  OAuth IDP   │      │   Backend   │─────▶│  Trino  │
│  (React)    │◀─────│ (Keycloak)   │      │ (Express)   │◀─────│ Server  │
└─────────────┘      └──────────────┘      └─────────────┘      └─────────┘
      │                     │                      │
      │   1. Auth Request   │                      │
      │────────────────────▶│                      │
      │   2. Login & Consent│                      │
      │◀────────────────────│                      │
      │   3. Auth Code      │                      │
      │◀────────────────────│                      │
      │   4. Token Exchange Request                │
      │────────────────────────────────────────────▶│
      │                     │   5. Token Exchange   │
      │                     │◀─────────────────────│
      │                     │   6. Access Token     │
      │                     │──────────────────────▶│
      │   7. Tokens         │                      │
      │◀────────────────────────────────────────────│
      │   8. Query with Token                      │
      │────────────────────────────────────────────▶│
      │                                    9. Query Trino
      │                                             │────▶Trino
      │   10. Results                               │
      │◀────────────────────────────────────────────│
```

## Prerequisites

### Dependencies

**Frontend:**
```bash
npm install oauth-pkce jwt-decode axios
```

**Backend:**
```bash
npm install express cors dotenv morgan trino-client
```

## Frontend Implementation

### 1. PKCE Challenge Generation

Create a utility for generating PKCE challenge pairs (code verifier and code challenge).

**File: `frontend/src/auth/oauthService.js`**

```javascript
import generatePKCE from 'oauth-pkce';

const CODE_VERIFIER_LENGTH = 128;

/**
 * Generate PKCE challenge pair (promisified)
 */
const generatePKCEChallenge = (length = CODE_VERIFIER_LENGTH) => {
  return new Promise((resolve, reject) => {
    generatePKCE(length, (error, { verifier, challenge }) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          codeVerifier: verifier,
          codeChallenge: challenge,
        });
      }
    });
  });
};
```

### 2. OAuth Storage Manager

Manage OAuth state and tokens in session storage.

**File: `frontend/src/auth/oauthService.js`**

```javascript
/**
 * Storage manager for OAuth state and tokens
 */
class OAuthStorage {
  static KEYS = {
    STATE: 'oauth_state',
    CODE_VERIFIER: 'code_verifier',
    ACCESS_TOKEN: 'access_token',
    ID_TOKEN: 'id_token',
    REFRESH_TOKEN: 'refresh_token',
    USER: 'user',
    PROCESSING_CALLBACK: 'processing_callback',
  };

  static set(key, value) {
    sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  static get(key) {
    return sessionStorage.getItem(key);
  }

  static getJSON(key) {
    const value = this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  static remove(key) {
    sessionStorage.removeItem(key);
  }

  static clear() {
    sessionStorage.clear();
  }

  static saveTokens(tokens) {
    this.set(this.KEYS.ACCESS_TOKEN, tokens.accessToken);
    if (tokens.idToken) {
      this.set(this.KEYS.ID_TOKEN, tokens.idToken);
    }
    if (tokens.refreshToken) {
      this.set(this.KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }
  }

  static getTokens() {
    return {
      accessToken: this.get(this.KEYS.ACCESS_TOKEN),
      idToken: this.get(this.KEYS.ID_TOKEN),
      refreshToken: this.get(this.KEYS.REFRESH_TOKEN),
    };
  }

  static saveUser(user) {
    this.set(this.KEYS.USER, user);
  }

  static getUser() {
    return this.getJSON(this.KEYS.USER);
  }
}
```

### 3. OAuth Configuration

Configure OAuth2 parameters.

**File: `frontend/src/auth/oauthService.js`**

```javascript
const DEFAULT_REDIRECT_URI = 'http://localhost:5173/callback';
const STATE_LENGTH = 32;
const NONCE_LENGTH = 32;

/**
 * OAuth Configuration
 */
class OAuthConfig {
  constructor() {
    this.authorizationUrl = import.meta.env.VITE_OAUTH_AUTHORIZATION_URL;
    this.clientId = import.meta.env.VITE_OAUTH_CLIENT_ID || 'query-app';
    this.redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;
    this.scope = import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email';
    this.responseType = 'code';
    this.usePKCE = true;
  }
}

/**
 * Generate cryptographically secure random string
 */
const generateRandomString = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (byte) => chars[byte % chars.length]).join('');
};
```

### 4. OAuth Service

Main service to handle OAuth2 flow.

**File: `frontend/src/auth/oauthService.js`**

```javascript
/**
 * Main OAuth Service
 */
class OAuthService {
  constructor() {
    this.config = new OAuthConfig();
  }

  /**
   * Build authorization URL with PKCE
   */
  async buildAuthorizationUrl() {
    const state = generateRandomString(STATE_LENGTH);
    const nonce = generateRandomString(NONCE_LENGTH);
    
    OAuthStorage.set(OAuthStorage.KEYS.STATE, state);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: this.config.responseType,
      scope: this.config.scope,
      state,
      nonce,
    });

    // Add PKCE challenge
    if (this.config.usePKCE) {
      const { codeVerifier, codeChallenge } = await generatePKCEChallenge();
      OAuthStorage.set(OAuthStorage.KEYS.CODE_VERIFIER, codeVerifier);
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Parse OAuth callback parameters
   */
  parseCallbackParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
    };
  }

  /**
   * Verify state parameter to prevent CSRF
   */
  verifyState(receivedState) {
    const savedState = OAuthStorage.get(OAuthStorage.KEYS.STATE);
    return savedState === receivedState;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code) {
    const codeVerifier = OAuthStorage.get(OAuthStorage.KEYS.CODE_VERIFIER);
    
    const tokens = await apiClient.exchangeCodeForTokens(
      code,
      codeVerifier,
      this.config.redirectUri
    );

    // Save tokens
    OAuthStorage.saveTokens(tokens);
    
    // Extract and save user info
    const userInfo = extractUserInfo(tokens.idToken, tokens.accessToken);
    if (userInfo) {
      OAuthStorage.saveUser(userInfo);
    }

    // Cleanup PKCE state
    OAuthStorage.remove(OAuthStorage.KEYS.CODE_VERIFIER);
    OAuthStorage.remove(OAuthStorage.KEYS.STATE);

    return { tokens, user: userInfo };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    const { refreshToken } = OAuthStorage.getTokens();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokens = await apiClient.refreshAccessToken(refreshToken);
    OAuthStorage.saveTokens(tokens);

    return tokens;
  }

  /**
   * Logout and clear all stored data
   */
  logout() {
    OAuthStorage.clear();
  }

  /**
   * Get current config
   */
  getConfig() {
    return this.config;
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
export { OAuthStorage };
```

### 5. API Client

Handle HTTP requests to backend for token exchange and refresh.

**File: `frontend/src/auth/apiClient.js`**

```javascript
import axios from 'axios';

const DEFAULT_BACKEND_URL = 'http://localhost:3001';

/**
 * Create an axios instance for OAuth API calls
 */
const createApiClient = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;
  
  return axios.create({
    baseURL: `${backendUrl}/api/oauth`,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
};

const apiClient = createApiClient();

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (code, codeVerifier, redirectUri) => {
  try {
    const { data } = await apiClient.post('/token', {
      code,
      codeVerifier,
      redirectUri,
    });

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw new Error(`Token exchange failed: ${message}`);
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (refreshToken) => {
  try {
    const { data } = await apiClient.post('/refresh', {
      refreshToken,
    });

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token || refreshToken,
    };
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw new Error(`Token refresh failed: ${message}`);
  }
};
```

### 6. Token Utilities

Decode and validate JWT tokens.

**File: `frontend/src/auth/tokenUtils.js`**

```javascript
import { jwtDecode } from 'jwt-decode';

/**
 * Decode a JWT token safely
 */
export const decodeJWT = (token) => {
  try {
    return jwtDecode(token);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

/**
 * Check if a token is expired
 */
export const isTokenExpired = (token) => {
  if (!token) return true;

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    return false;
  }

  // Add 5 second buffer to prevent edge cases
  return Date.now() >= (decoded.exp * 1000) - 5000;
};

/**
 * Extract user information from ID token or access token
 */
export const extractUserInfo = (idToken, accessToken) => {
  const token = idToken || accessToken;
  if (!token) return null;

  const decoded = decodeJWT(token);
  if (!decoded) return null;

  return {
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name || decoded.preferred_username || decoded.email,
    picture: decoded.picture,
    ...decoded, // Include all other claims
  };
};
```

### 7. Auth Provider (React Context)

Create a React context to manage authentication state across the application.

**File: `frontend/src/auth/AuthProvider.jsx`**

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import {
  getOAuthConfig,
  buildAuthorizationUrl,
  parseQueryParams,
  exchangeCodeForTokens,
  refreshAccessToken,
  verifyState,
  decodeJWT,
  isTokenExpired,
} from './oauth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const config = getOAuthConfig();

  useEffect(() => {
    // Prevent duplicate callback execution (important for React StrictMode)
    const isProcessingCallback = sessionStorage.getItem('processing_callback');
    
    // Check if we're on the callback page
    if (window.location.pathname === '/callback') {
      if (!isProcessingCallback) {
        sessionStorage.setItem('processing_callback', 'true');
        handleCallback();
      } else {
        // Already processing, just wait
        setIsLoading(false);
      }
    } else {
      // Check for existing token in sessionStorage
      checkExistingAuth();
    }
  }, []);

  const checkExistingAuth = async () => {
    try {
      const storedAccessToken = sessionStorage.getItem('access_token');
      const storedIdToken = sessionStorage.getItem('id_token');
      const storedRefreshToken = sessionStorage.getItem('refresh_token');
      const storedUser = sessionStorage.getItem('user');

      if (storedAccessToken) {
        const expired = isTokenExpired(storedAccessToken);
        
        if (!expired) {
          setAccessToken(storedAccessToken);
          setIdToken(storedIdToken);
          setUser(storedUser ? JSON.parse(storedUser) : null);
          setIsAuthenticated(true);
        } else if (storedRefreshToken) {
          try {
            const refreshedTokens = await refreshAccessToken(storedRefreshToken);
            
            sessionStorage.setItem('access_token', refreshedTokens.accessToken);
            if (refreshedTokens.idToken) {
              sessionStorage.setItem('id_token', refreshedTokens.idToken);
            }
            if (refreshedTokens.refreshToken) {
              sessionStorage.setItem('refresh_token', refreshedTokens.refreshToken);
            }
            
            setAccessToken(refreshedTokens.accessToken);
            setIdToken(refreshedTokens.idToken);
            setUser(storedUser ? JSON.parse(storedUser) : null);
            setIsAuthenticated(true);
          } catch (error) {
            console.error('Failed to refresh token on startup:', error);
            sessionStorage.clear();
          }
        } else {
          sessionStorage.clear();
        }
      }
    } catch (error) {
      console.error('Error checking existing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallback = async () => {
    try {
      const queryResult = parseQueryParams();
      
      if (queryResult.error) {
        throw new Error(queryResult.errorDescription || queryResult.error);
      }

      if (queryResult.state && !verifyState(queryResult.state)) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      if (queryResult.code) {
        const tokenResult = await exchangeCodeForTokens(queryResult.code, config);
        
        if (!tokenResult.accessToken) {
          throw new Error('No access token received from token exchange');
        }
        
        sessionStorage.setItem('access_token', tokenResult.accessToken);
        if (tokenResult.idToken) {
          sessionStorage.setItem('id_token', tokenResult.idToken);
        }
        if (tokenResult.refreshToken) {
          sessionStorage.setItem('refresh_token', tokenResult.refreshToken);
        }

        const tokenToDecode = tokenResult.idToken || tokenResult.accessToken;
        const decoded = decodeJWT(tokenToDecode);
        
        if (decoded) {
          const userInfo = {
            sub: decoded.sub,
            email: decoded.email,
            name: decoded.name || decoded.preferred_username || decoded.email,
            picture: decoded.picture,
          };
          
          sessionStorage.setItem('user', JSON.stringify(userInfo));
          setUser(userInfo);
        }

        setAccessToken(tokenResult.accessToken);
        setIdToken(tokenResult.idToken);
        setIsAuthenticated(true);

        // Clean up the processing flag and redirect
        sessionStorage.removeItem('processing_callback');
        window.history.replaceState({}, document.title, '/');
      } else {
        throw new Error('No authorization code received');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error.message);
      sessionStorage.removeItem('processing_callback');
      sessionStorage.clear();
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      setError(null);
      const authUrl = await buildAuthorizationUrl(config);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
    }
  };

  const logout = () => {
    sessionStorage.clear();
    setUser(null);
    setAccessToken(null);
    setIdToken(null);
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const getToken = async () => {
    if (accessToken) {
      const expired = isTokenExpired(accessToken);
      
      if (!expired) {
        return accessToken;
      }
      
      const storedRefreshToken = sessionStorage.getItem('refresh_token');
      if (storedRefreshToken) {
        try {
          const refreshedTokens = await refreshAccessToken(storedRefreshToken);
          
          sessionStorage.setItem('access_token', refreshedTokens.accessToken);
          if (refreshedTokens.idToken) {
            sessionStorage.setItem('id_token', refreshedTokens.idToken);
          }
          if (refreshedTokens.refreshToken) {
            sessionStorage.setItem('refresh_token', refreshedTokens.refreshToken);
          }
          
          setAccessToken(refreshedTokens.accessToken);
          setIdToken(refreshedTokens.idToken);
          
          return refreshedTokens.accessToken;
        } catch (error) {
          console.error('Failed to refresh token:', error);
          sessionStorage.clear();
          setAccessToken(null);
          setIdToken(null);
          setIsAuthenticated(false);
          setError('Session expired. Please log in again.');
          return null;
        }
      }
    }
    
    return null;
  };

  const value = {
    user,
    accessToken,
    idToken,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    getToken,
    providerName: config.name,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### 8. Main App Component

Use the auth provider in your main application.

**File: `frontend/src/App.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import axios from 'axios';
import './App.css';

function App() {
  const { 
    user, 
    accessToken, 
    isAuthenticated, 
    isLoading, 
    error: authError, 
    login, 
    logout, 
    getToken 
  } = useAuth();
  
  const [query, setQuery] = useState('SELECT * FROM tpch.sf1.nation LIMIT 10');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeQuery = async () => {
    const token = await getToken();
    const idTokenFromStorage = sessionStorage.getItem('id_token');
    const tokenToUse = idTokenFromStorage || token;
    
    if (!tokenToUse) {
      setError('No authentication token available. Please log in again.');
      return;
    }

    if (!query.trim()) {
      setError('Query cannot be empty.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/query`,
        { query },
        {
          headers: {
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setResults(response.data);
    } catch (err) {
      let errorMessage = 'An error occurred while executing the query';
      
      if (err.response) {
        errorMessage = err.response.data?.message || err.response.statusText || errorMessage;
      } else if (err.request) {
        errorMessage = 'Cannot connect to backend server. Is it running?';
      } else {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">Initializing authentication...</div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="login-container">
          <h1>Trino Query Application</h1>
          <p>Please log in to execute queries</p>
          <button onClick={login}>Log In</button>
        </div>
      </div>
    );
  }

  // Main application UI
  return (
    <div className="app">
      <header>
        <h1>Trino Query Interface</h1>
        <div className="user-info">
          <span>Welcome, {user?.name || user?.email}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      
      <main>
        <div className="query-editor">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your SQL query here"
            rows={10}
          />
          <button onClick={executeQuery} disabled={loading}>
            {loading ? 'Executing...' : 'Execute Query'}
          </button>
        </div>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {results && (
          <div className="results">
            <h3>Query Results ({results.rowCount} rows)</h3>
            <pre>{JSON.stringify(results.data, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
```

### 9. Main Entry Point

Wrap your app with the AuthProvider.

**File: `frontend/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
```

### 10. Environment Variables

**File: `frontend/.env`**

```env
VITE_OAUTH_AUTHORIZATION_URL=http://localhost:8088/realms/trino/protocol/openid-connect/auth
VITE_OAUTH_CLIENT_ID=query-app
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
VITE_OAUTH_SCOPE=openid profile email
VITE_BACKEND_URL=http://localhost:3001
```

## Backend Implementation

### 1. OAuth Configuration

**File: `backend/src/server.js`**

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { Trino } from 'trino-client';

dotenv.config();

// Validate required environment variables
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

// Middleware
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
```

### 2. Token Exchange Endpoint

**File: `backend/src/server.js`**

```javascript
/**
 * Exchange authorization code for access token
 * This endpoint proxies the token exchange request to the OAuth provider
 */
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

    // Exchange code for tokens
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
```

### 3. Token Refresh Endpoint

**File: `backend/src/server.js`**

```javascript
/**
 * Refresh access token using refresh token
 */
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
```

### 4. JWT Decoder

**File: `backend/src/server.js`**

```javascript
/**
 * Decode JWT token without verification
 * Used to extract claims from the token
 */
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
```

### 5. Query Execution Endpoint

**File: `backend/src/server.js`**

```javascript
/**
 * Execute Trino query with OAuth token
 */
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

    // Decode token to extract user information
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
    // Trino uses: http-server.authentication.oauth2.principal-field
    const principalField = process.env.OAUTH2_PRINCIPAL_FIELD || 'preferred_username';
    const user = decoded?.[principalField] || decoded?.email || decoded?.sub || 'oauth-user';
    
    console.log(`👤 Principal field: ${principalField}`);
    console.log(`👤 Extracted username: ${user}`);
    console.log(`🔐 Token audience (aud): ${JSON.stringify(decoded?.aud)}`);
    
    // Create Trino client with OAuth token
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

    // Execute query
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://0.0.0.0:${PORT}`);
  console.log(`Trino connection: http://${TRINO_HOST}:${TRINO_PORT}`);
});
```

### 6. Environment Variables

**File: `backend/.env`**

```env
# OAuth Configuration
OAUTH2_PUBLIC_CLIENT_ID=query-app
OAUTH2_TOKEN_URL=http://keycloak:8080/realms/trino/protocol/openid-connect/token
OAUTH2_PRINCIPAL_FIELD=preferred_username

# Trino Configuration
TRINO_HOST=trino
TRINO_PORT=8080
TRINO_CATALOG=tpch
TRINO_SCHEMA=sf1

# Server Configuration
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development
```

## Environment Configuration

### Frontend Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_OAUTH_AUTHORIZATION_URL=http://localhost:8088/realms/trino/protocol/openid-connect/auth
VITE_OAUTH_CLIENT_ID=query-app
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
VITE_OAUTH_SCOPE=openid profile email
VITE_BACKEND_URL=http://localhost:3001
```

### Backend Environment Variables

Create a `.env` file in the backend directory:

```env
# OAuth Configuration
OAUTH2_PUBLIC_CLIENT_ID=query-app
OAUTH2_TOKEN_URL=http://keycloak:8080/realms/trino/protocol/openid-connect/token
OAUTH2_PRINCIPAL_FIELD=preferred_username

# Trino Configuration
TRINO_HOST=trino
TRINO_PORT=8080
TRINO_CATALOG=tpch
TRINO_SCHEMA=sf1

# Server Configuration
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### OAuth Provider Configuration (Keycloak Example)

Configure your OAuth provider (Keycloak) with a public client:

1. **Client ID**: `query-app`
2. **Client Type**: Public
3. **Valid Redirect URIs**: `http://localhost:5173/callback`
4. **Valid Post Logout Redirect URIs**: `http://localhost:5173`
5. **Web Origins**: `http://localhost:5173`
6. **PKCE**: Enabled (S256)
7. **Standard Flow**: Enabled
8. **Direct Access Grants**: Disabled (for security)

### Trino Configuration

Configure Trino to accept OAuth2 tokens:

**File: `trino/etc/config.properties`**

```properties
coordinator=true
node-scheduler.include-coordinator=true
http-server.http.port=8080
discovery.uri=http://localhost:8080

# OAuth2 Authentication
http-server.authentication.type=oauth2
http-server.authentication.oauth2.issuer=http://keycloak:8080/realms/trino
http-server.authentication.oauth2.auth-url=http://localhost:8088/realms/trino/protocol/openid-connect/auth
http-server.authentication.oauth2.token-url=http://keycloak:8080/realms/trino/protocol/openid-connect/token
http-server.authentication.oauth2.jwks-url=http://keycloak:8080/realms/trino/protocol/openid-connect/certs
http-server.authentication.oauth2.client-id=trino-coordinator
http-server.authentication.oauth2.audience=trino-coordinator
http-server.authentication.oauth2.principal-field=preferred_username
```

## Testing

### 1. Start the OAuth Provider

```bash
# Using Docker Compose
docker-compose up keycloak -d
```

### 2. Start Trino

```bash
docker-compose up trino -d
```

### 3. Start the Backend

```bash
cd backend
npm install
npm start
```

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Test the OAuth Flow

1. Navigate to `http://localhost:5173`
2. Click "Log In" button
3. You will be redirected to the OAuth provider
4. Enter your credentials
5. After successful authentication, you'll be redirected back to the app
6. Try executing a query: `SELECT * FROM tpch.sf1.nation LIMIT 10`

### 6. Verify Token Exchange

Check the browser console and backend logs to verify:

- PKCE challenge and verifier generation
- Authorization URL contains `code_challenge` and `code_challenge_method=S256`
- Token exchange includes `code_verifier`
- Access token and refresh token are received
- Tokens are properly stored in sessionStorage

### 7. Test Token Refresh

Wait for the token to expire (or manually delete the access token from sessionStorage while keeping the refresh token), then try to execute another query. The app should automatically refresh the token.

## Security Considerations

1. **PKCE is Required**: Always use PKCE for public clients to prevent authorization code interception attacks
2. **State Parameter**: Verify the state parameter to prevent CSRF attacks
3. **Token Storage**: Store tokens in sessionStorage (not localStorage) to limit exposure
4. **HTTPS in Production**: Always use HTTPS in production environments
5. **Token Expiration**: Implement proper token expiration handling and refresh logic
6. **Audience Claim**: Ensure tokens have the correct audience claim for Trino
7. **Principal Field**: Make sure the principal field matches between frontend, backend, and Trino configuration

## Common Issues and Troubleshooting

### Issue 1: PKCE Challenge Mismatch

**Error**: "code_verifier does not match code_challenge"

**Solution**: Ensure the code verifier is stored before redirect and retrieved correctly during token exchange.

### Issue 2: Invalid State Parameter

**Error**: "Invalid state parameter"

**Solution**: Make sure state is stored before redirect and verified during callback.

### Issue 3: Token Not Accepted by Trino

**Error**: "Authentication failed" or "Invalid audience"

**Solution**: 
- Verify the token has the correct audience claim (`aud`)
- Check that Trino's `oauth2.audience` configuration matches
- Ensure the principal field is correctly configured

### Issue 4: CORS Errors

**Error**: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solution**: Configure CORS properly in the backend and ensure frontend origin is whitelisted.

### Issue 5: Token Refresh Fails

**Error**: "No refresh token available" or "Refresh token expired"

**Solution**: 
- Ensure refresh tokens are being returned by the OAuth provider
- Check that refresh tokens are stored properly
- Verify the OAuth provider issues refresh tokens for your client

## Conclusion

This guide demonstrates a complete implementation of OAuth2 with PKCE for connecting to Trino. The frontend handles the OAuth flow, PKCE challenge generation, and token management, while the backend proxies token requests and executes Trino queries with the authenticated tokens.

Key takeaways:

1. **PKCE is essential** for public clients to ensure security
2. **Token management** requires careful handling of expiration and refresh
3. **State verification** prevents CSRF attacks
4. **Proper principal field configuration** ensures seamless integration with Trino
5. **Audience claims** must match Trino's expectations for successful authentication

This implementation provides a secure, production-ready foundation for building applications that query Trino using OAuth2 authentication.
