/**
 * OAuth Module - Barrel export for backward compatibility
 * 
 * This module has been refactored into smaller, more maintainable pieces:
 * - oauthService.js: Main OAuth service with PKCE support
 * - apiClient.js: HTTP client for token exchange/refresh
 * - tokenUtils.js: JWT decoding and validation utilities
 */

import { oauthService, OAuthStorage } from './oauthService';
import { decodeJWT, isTokenExpired } from './tokenUtils';

// Re-export for backward compatibility with existing code
export const getOAuthConfig = () => oauthService.getConfig();

export const buildAuthorizationUrl = async () => 
  oauthService.buildAuthorizationUrl();

export const parseQueryParams = () => 
  oauthService.parseCallbackParams();

export const verifyState = (receivedState) => 
  oauthService.verifyState(receivedState);

export const exchangeCodeForTokens = async (code, config) => {
  const result = await oauthService.exchangeCodeForTokens(code);
  return result.tokens;
};

export const refreshAccessToken = async (refreshToken) => {
  // Store the refresh token temporarily if needed
  if (refreshToken) {
    OAuthStorage.set(OAuthStorage.KEYS.REFRESH_TOKEN, refreshToken);
  }
  return oauthService.refreshAccessToken();
};

export { decodeJWT, isTokenExpired };

// Export the service itself for advanced usage
export { oauthService };
