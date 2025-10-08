const CODE_VERIFIER_LENGTH = 128;
const DEFAULT_RANDOM_STRING_LENGTH = 32;
const DEFAULT_BACKEND_URL = 'http://localhost:3001';
const DEFAULT_REDIRECT_URI = 'http://localhost:5173/callback';

export const getOAuthConfig = () => {
  return {
    name: 'OAuth2 Provider',
    authorizationUrl: import.meta.env.VITE_OAUTH_AUTHORIZATION_URL,
    clientId: import.meta.env.VITE_OAUTH_CLIENT_ID || 'query-app',
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    scope: import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email',
    responseType: 'code', // Authorization Code Flow
    usePKCE: true, // Enable PKCE for public clients
  };
};

export const generateRandomString = (length = DEFAULT_RANDOM_STRING_LENGTH) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
};

export const generateCodeVerifier = () => {
  return generateRandomString(CODE_VERIFIER_LENGTH);
};

export const generateCodeChallenge = async (verifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
};

const base64UrlEncode = (arrayBuffer) => {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

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

  if (config.usePKCE && config.responseType === 'code') {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('code_verifier', verifier);
    params.append('code_challenge', challenge);
    params.append('code_challenge_method', 'S256');
  }

  return `${config.authorizationUrl}?${params.toString()}`;
};

export const exchangeCodeForTokens = async (code, config) => {
  const codeVerifier = sessionStorage.getItem('code_verifier');
  const backendUrl = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;
  
  const response = await fetch(`${backendUrl}/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  
  sessionStorage.removeItem('code_verifier');
  
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
  };
};

export const refreshAccessToken = async (refreshToken) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;
  
  const response = await fetch(`${backendUrl}/api/oauth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token || refreshToken,
  };
};

export const parseQueryParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  };
};

export const verifyState = (receivedState) => {
  const savedState = sessionStorage.getItem('oauth_state');
  return savedState === receivedState;
};

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

export const isTokenExpired = (token) => {
  if (!token) return true;

  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    return false;
  }

  return Date.now() >= decoded.exp * 1000;
};
