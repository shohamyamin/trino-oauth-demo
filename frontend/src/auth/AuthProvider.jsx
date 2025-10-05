import { createContext, useContext, useState, useEffect } from 'react';
import {
  getOAuthConfig,
  buildAuthorizationUrl,
  parseHashFragment,
  parseQueryParams,
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
      // Try implicit flow (hash fragment)
      let result = parseHashFragment();
      
      // If no hash fragment, try authorization code flow (query params)
      if (!result.accessToken && !result.error) {
        result = parseQueryParams();
        if (result.code) {
          // For authorization code flow, we'd need to exchange the code
          // This requires a backend endpoint
          console.warn('Authorization code flow requires backend token exchange');
          setError('Authorization code flow not yet implemented. Please use implicit flow.');
          setIsLoading(false);
          return;
        }
      }

      // Check for errors
      if (result.error) {
        throw new Error(result.errorDescription || result.error);
      }

      // Verify state
      if (result.state && !verifyState(result.state)) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      if (result.accessToken) {
        console.log('✅ Received access token:', result.accessToken.substring(0, 20) + '...');
        
        // Store tokens
        sessionStorage.setItem('access_token', result.accessToken);
        if (result.idToken) {
          sessionStorage.setItem('id_token', result.idToken);
          console.log('✅ Stored ID token');
        }

        // Decode ID token or access token to get user info
        const tokenToDecode = result.idToken || result.accessToken;
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

        setAccessToken(result.accessToken);
        setIdToken(result.idToken);
        setIsAuthenticated(true);
        
        console.log('✅ Auth state updated, redirecting to home...');

        // Clean up URL and redirect to home
        window.history.replaceState({}, document.title, '/');
      } else {
        throw new Error('No access token received');
      }
    } catch (error) {
      console.error('Authentication error:', error);
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
