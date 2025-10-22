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
