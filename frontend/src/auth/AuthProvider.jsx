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
    // Check if we're on the callback page
    if (window.location.pathname === '/callback') {
      handleCallback();
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
  };  const handleCallback = async () => {
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

        window.history.replaceState({}, document.title, '/');
      } else {
        throw new Error('No authorization code received');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error.message);
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
