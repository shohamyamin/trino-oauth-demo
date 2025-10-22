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
