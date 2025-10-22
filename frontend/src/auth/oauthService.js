import generatePKCE from 'oauth-pkce';
import * as apiClient from './apiClient';
import { isTokenExpired, extractUserInfo } from './tokenUtils';

const DEFAULT_REDIRECT_URI = 'http://localhost:5173/callback';
const STATE_LENGTH = 32;
const NONCE_LENGTH = 32;
const CODE_VERIFIER_LENGTH = 128;

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

/**
 * Generate cryptographically secure random string
 */
const generateRandomString = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (byte) => chars[byte % chars.length]).join('');
};

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
   * Check existing authentication
   */
  async checkExistingAuth() {
    const { accessToken, refreshToken } = OAuthStorage.getTokens();
    const user = OAuthStorage.getUser();

    if (!accessToken) {
      return { isAuthenticated: false, user: null, accessToken: null };
    }

    // Check if token is expired
    if (isTokenExpired(accessToken)) {
      if (refreshToken) {
        try {
          const tokens = await this.refreshAccessToken();
          return {
            isAuthenticated: true,
            user,
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
          };
        } catch (error) {
          console.error('Failed to refresh token:', error);
          OAuthStorage.clear();
          return { isAuthenticated: false, user: null, accessToken: null };
        }
      }
      
      OAuthStorage.clear();
      return { isAuthenticated: false, user: null, accessToken: null };
    }

    return {
      isAuthenticated: true,
      user,
      accessToken,
      idToken: OAuthStorage.get(OAuthStorage.KEYS.ID_TOKEN),
    };
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

// Export storage for direct access if needed
export { OAuthStorage };
