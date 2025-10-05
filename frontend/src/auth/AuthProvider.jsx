import { createContext, useContext, useState, useEffect } from 'react';
import {
  getOAuthConfig,
  buildAuthorizationUrl,
  parseHashFragment,
  parseQueryParams,
  exchangeCodeForTokens,
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
    // Check if we're on the callback page
    if (window.location.pathname === '/callback') {
      handleCallback();
    } else {
      // Check for existing token in sessionStorage
      checkExistingAuth();
    }
  }, []);

  const checkExistingAuth = () => {
    try {
      const storedAccessToken = sessionStorage.getItem('access_token');
      const storedIdToken = sessionStorage.getItem('id_token');
      const storedUser = sessionStorage.getItem('user');

      console.log('🔍 Checking existing auth:', {
        hasAccessToken: !!storedAccessToken,
        hasIdToken: !!storedIdToken,
        hasUser: !!storedUser,
        accessTokenPreview: storedAccessToken ? storedAccessToken.substring(0, 20) + '...' : null
      });

      if (storedAccessToken) {
        const expired = isTokenExpired(storedAccessToken);
        console.log('Token expired?', expired);
        
        if (!expired) {
          setAccessToken(storedAccessToken);
          setIdToken(storedIdToken);
          setUser(storedUser ? JSON.parse(storedUser) : null);
          setIsAuthenticated(true);
          console.log('✅ Auth restored from storage');
        } else {
          console.warn('⚠️ Stored token is expired');
          sessionStorage.clear();
        }
      } else {
        console.log('ℹ️ No stored token found');
      }
    } catch (error) {
      console.error('Error checking existing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallback = async () => {
    try {
      console.log('🔄 Processing OAuth callback...');
      
      // Parse query parameters (Authorization Code Flow)
      const queryResult = parseQueryParams();
      
      // Check for errors
      if (queryResult.error) {
        throw new Error(queryResult.errorDescription || queryResult.error);
      }

      // Verify state parameter to prevent CSRF attacks
      if (queryResult.state && !verifyState(queryResult.state)) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Handle Authorization Code Flow
      if (queryResult.code) {
        console.log('✅ Received authorization code, exchanging for tokens...');
        
        // Exchange authorization code for tokens via backend
        const tokenResult = await exchangeCodeForTokens(queryResult.code, config);
        
        if (!tokenResult.accessToken) {
          throw new Error('No access token received from token exchange');
        }

        console.log('✅ Received access token:', tokenResult.accessToken.substring(0, 20) + '...');
        
        // Store tokens
        sessionStorage.setItem('access_token', tokenResult.accessToken);
        if (tokenResult.idToken) {
          sessionStorage.setItem('id_token', tokenResult.idToken);
          console.log('✅ Stored ID token');
        }
        if (tokenResult.refreshToken) {
          sessionStorage.setItem('refresh_token', tokenResult.refreshToken);
          console.log('✅ Stored refresh token');
        }

        // Decode ID token or access token to get user info
        const tokenToDecode = tokenResult.idToken || tokenResult.accessToken;
        const decoded = decodeJWT(tokenToDecode);
        
        console.log('🔓 Decoded token:', decoded);
        
        if (decoded) {
          const userInfo = {
            sub: decoded.sub,
            email: decoded.email,
            name: decoded.name || decoded.preferred_username || decoded.email,
            picture: decoded.picture,
          };
          
          sessionStorage.setItem('user', JSON.stringify(userInfo));
          setUser(userInfo);
          console.log('✅ User info set:', userInfo);
        }

        setAccessToken(tokenResult.accessToken);
        setIdToken(tokenResult.idToken);
        setIsAuthenticated(true);
        
        console.log('✅ Auth state updated, redirecting to home...');

        // Clean up URL and redirect to home
        window.history.replaceState({}, document.title, '/');
      } else {
        throw new Error('No authorization code received');
      }
    } catch (error) {
      console.error('❌ Authentication error:', error);
      setError(error.message);
      sessionStorage.clear();
      // Redirect back to home on error
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

  const getToken = () => {
    console.log('🎫 getToken called:', {
      hasAccessToken: !!accessToken,
      isAuthenticated,
      tokenPreview: accessToken ? accessToken.substring(0, 20) + '...' : null
    });

    if (accessToken) {
      const expired = isTokenExpired(accessToken);
      console.log('Token expired?', expired);
      
      if (!expired) {
        return accessToken;
      }
    }
    
    // Token expired or missing - return null without logging out
    // The UI will handle showing error messages
    console.warn('⚠️ Access token is expired or missing');
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
