// OAuth2 configuration utilities
export const getOAuthConfig = () => {
  const provider = import.meta.env.VITE_OAUTH_PROVIDER || 'google';

  const configs = {
    google: {
      name: 'Google',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:5173/callback',
      scope: 'openid profile email',
      responseType: 'token id_token',
      usePKCE: false,
    },
    github: {
      name: 'GitHub',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      clientId: import.meta.env.VITE_GITHUB_CLIENT_ID,
      redirectUri: import.meta.env.VITE_GITHUB_REDIRECT_URI || 'http://localhost:5173/callback',
      scope: 'read:user user:email',
      responseType: 'code',
      usePKCE: false,
    },
    auth0: {
      name: 'Auth0',
      authorizationUrl: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/authorize`,
      tokenUrl: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/oauth/token`,
      userInfoUrl: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/userinfo`,
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
      redirectUri: import.meta.env.VITE_AUTH0_REDIRECT_URI || 'http://localhost:5173/callback',
      scope: 'openid profile email',
      responseType: 'token id_token',
      usePKCE: true,
    },
    keycloak: {
      name: 'Keycloak',
      authorizationUrl: `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/protocol/openid-connect/auth`,
      tokenUrl: `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/protocol/openid-connect/token`,
      userInfoUrl: `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
      redirectUri: 'http://localhost:5173/callback',
      scope: 'openid profile email',
      responseType: 'token id_token',
      usePKCE: true,
    },
    generic: {
      name: 'OAuth2 Provider',
      authorizationUrl: import.meta.env.VITE_OAUTH_AUTHORIZATION_URL,
      tokenUrl: import.meta.env.VITE_OAUTH_TOKEN_URL,
      userInfoUrl: import.meta.env.VITE_OAUTH_USERINFO_URL,
      clientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:5173/callback',
      scope: import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email',
      responseType: 'token id_token',
      usePKCE: true,
    },
  };

  return configs[provider] || configs.google;
};

// Generate random string for state parameter
export const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
};

// Generate code verifier for PKCE
export const generateCodeVerifier = () => {
  return generateRandomString(128);
};

// Generate code challenge from verifier
export const generateCodeChallenge = async (verifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
};

// Base64 URL encode
const base64UrlEncode = (arrayBuffer) => {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

// Build authorization URL
export const buildAuthorizationUrl = async (config) => {
  const state = generateRandomString();
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: config.responseType,
    scope: config.scope,
    state: state,
    nonce: generateRandomString(),
  });

  if (config.usePKCE) {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('code_verifier', verifier);
    params.append('code_challenge', challenge);
    params.append('code_challenge_method', 'S256');
  }

  return `${config.authorizationUrl}?${params.toString()}`;
};

// Parse hash fragment from redirect
export const parseHashFragment = () => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get('access_token'),
    idToken: params.get('id_token'),
    tokenType: params.get('token_type'),
    expiresIn: params.get('expires_in'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  };
};

// Parse query params from redirect (for authorization code flow)
export const parseQueryParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  };
};

// Verify state parameter
export const verifyState = (receivedState) => {
  const savedState = sessionStorage.getItem('oauth_state');
  return savedState === receivedState;
};

// Decode JWT token (without verification - server should verify)
export const decodeJWT = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

// Check if token is expired
export const isTokenExpired = (token) => {
  if (!token) {
    console.log('isTokenExpired: No token provided');
    return true;
  }

  // Check if it's a JWT (has 3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log('isTokenExpired: Not a JWT token (parts:', parts.length, ')');
    // Not a JWT - assume it's an opaque token that's valid
    // OAuth2 access tokens don't have to be JWTs
    return false;
  }

  const decoded = decodeJWT(token);
  if (!decoded) {
    console.warn('isTokenExpired: Failed to decode JWT');
    return true;
  }

  if (!decoded.exp) {
    console.log('isTokenExpired: No exp claim, assuming valid');
    // No expiration claim - assume valid
    return false;
  }

  const expired = Date.now() >= decoded.exp * 1000;
  console.log('isTokenExpired:', expired, '(exp:', new Date(decoded.exp * 1000).toISOString(), ')');
  return expired;
};
