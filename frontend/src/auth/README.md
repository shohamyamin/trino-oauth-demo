# OAuth Module Refactoring

This directory contains a clean, maintainable OAuth 2.0 implementation with PKCE support.

## Architecture

The OAuth implementation has been refactored into four focused modules:

### 1. **oauthService.js** - Main OAuth Service
The core OAuth service handling the complete authentication flow.

**Key Features:**
- PKCE (Proof Key for Code Exchange) support using `oauth-pkce` library
- Clean OAuthConfig class for configuration management
- OAuthStorage class for secure session storage management
- Singleton pattern for easy consumption

**Main Methods:**
- `buildAuthorizationUrl()` - Creates authorization URL with PKCE challenge
- `parseCallbackParams()` - Parses OAuth callback parameters
- `verifyState()` - CSRF protection via state parameter verification
- `exchangeCodeForTokens()` - Exchanges authorization code for tokens
- `refreshAccessToken()` - Refreshes expired access tokens
- `checkExistingAuth()` - Validates and restores existing sessions
- `logout()` - Clears all authentication state

### 2. **apiClient.js** - HTTP Client
Dedicated axios-based API client for backend communication.

**Features:**
- Centralized axios instance with proper configuration
- Clean error handling and response transformation
- Timeout and retry logic
- Type-safe response objects

**Functions:**
- `exchangeCodeForTokens(code, codeVerifier, redirectUri)` - POST to `/api/oauth/token`
- `refreshAccessToken(refreshToken)` - POST to `/api/oauth/refresh`

### 3. **tokenUtils.js** - JWT Utilities
Token validation and user info extraction using `jwt-decode` library.

**Features:**
- Safe JWT decoding with error handling
- Token expiration checking with 5-second buffer
- User information extraction from tokens

**Functions:**
- `decodeJWT(token)` - Safely decode JWT tokens
- `isTokenExpired(token)` - Check if token is expired
- `extractUserInfo(idToken, accessToken)` - Extract user claims from tokens

### 4. **oauth.js** - Backward Compatibility Layer
Barrel export maintaining API compatibility with existing code.

**Purpose:**
- Re-exports functions from the new modules
- Maintains existing function signatures
- Allows gradual migration to new architecture

## Usage Examples

### Basic Authentication Flow

```javascript
import { oauthService } from './auth/oauthService';

// Start login
const startLogin = async () => {
  const authUrl = await oauthService.buildAuthorizationUrl();
  window.location.href = authUrl;
};

// Handle callback
const handleCallback = async () => {
  const params = oauthService.parseCallbackParams();
  
  if (params.error) {
    throw new Error(params.errorDescription || params.error);
  }
  
  if (!oauthService.verifyState(params.state)) {
    throw new Error('Invalid state - CSRF protection failed');
  }
  
  const { tokens, user } = await oauthService.exchangeCodeForTokens(params.code);
  console.log('Authenticated user:', user);
};

// Check existing session
const checkSession = async () => {
  const { isAuthenticated, user, accessToken } = await oauthService.checkExistingAuth();
  return { isAuthenticated, user, accessToken };
};

// Logout
const logout = () => {
  oauthService.logout();
  window.location.href = '/';
};
```

### Direct Token Management

```javascript
import { OAuthStorage } from './auth/oauthService';
import { isTokenExpired } from './auth/tokenUtils';

// Get current tokens
const tokens = OAuthStorage.getTokens();

// Check if token is expired
if (isTokenExpired(tokens.accessToken)) {
  console.log('Token expired, need to refresh');
}

// Get user info
const user = OAuthStorage.getUser();
```

### Using with React (AuthProvider)

The existing `AuthProvider.jsx` works seamlessly with the refactored code thanks to the backward compatibility layer in `oauth.js`.

## Benefits of This Architecture

### ✅ Separation of Concerns
- Each module has a single, well-defined responsibility
- Easy to test and maintain independently
- Clear boundaries between concerns

### ✅ Industry-Standard Libraries
- **oauth-pkce**: Battle-tested PKCE implementation
- **jwt-decode**: Robust JWT parsing
- **axios**: Professional HTTP client with interceptors and error handling

### ✅ Type Safety & Error Handling
- Comprehensive error handling at each layer
- Clear error messages for debugging
- Proper async/await usage

### ✅ Security Best Practices
- PKCE for public clients (prevents code interception)
- State parameter for CSRF protection
- Secure random string generation using Web Crypto API
- Token expiration checking with buffer

### ✅ Clean Code Principles
- DRY (Don't Repeat Yourself)
- Single Responsibility Principle
- Dependency Injection ready
- Easy to mock for testing

### ✅ Developer Experience
- Clear, self-documenting code
- Comprehensive JSDoc comments
- Logical organization
- Easy to extend and modify

## Migration Guide

The old `oauth.js` now acts as a compatibility layer, so existing code continues to work without changes:

```javascript
// Old way (still works)
import { buildAuthorizationUrl, exchangeCodeForTokens } from './auth/oauth';

// New way (recommended)
import { oauthService } from './auth/oauthService';
```

## Configuration

Environment variables (in `.env`):

```bash
VITE_OAUTH_AUTHORIZATION_URL=https://your-idp.com/auth
VITE_OAUTH_CLIENT_ID=your-client-id
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
VITE_OAUTH_SCOPE=openid profile email
VITE_BACKEND_URL=http://localhost:3001
```

## Testing

Each module can be tested independently:

```javascript
// Example: Testing tokenUtils
import { isTokenExpired, decodeJWT } from './tokenUtils';

describe('Token Utils', () => {
  it('should detect expired tokens', () => {
    const expiredToken = 'eyJ...'; // Token with exp in the past
    expect(isTokenExpired(expiredToken)).toBe(true);
  });
});
```

## Dependencies

- `oauth-pkce` - PKCE challenge generation
- `jwt-decode` - JWT token decoding
- `axios` - HTTP client

Install with:
```bash
npm install oauth-pkce jwt-decode axios
```

## File Structure

```
src/auth/
├── oauth.js              # Backward compatibility barrel export
├── oauthService.js       # Main OAuth service (singleton)
├── apiClient.js          # Axios-based HTTP client
├── tokenUtils.js         # JWT utilities
├── AuthProvider.jsx      # React context provider (unchanged)
└── README.md            # This file
```

## Future Enhancements

Possible improvements for the future:

1. **Token Auto-Refresh**: Implement automatic token refresh before expiration
2. **Logout Endpoint**: Add support for OAuth logout endpoint
3. **Silent Authentication**: Implement iframe-based silent token refresh
4. **Token Storage**: Consider more secure storage options (e.g., memory + refresh token in httpOnly cookie)
5. **Multi-tab Sync**: Synchronize auth state across browser tabs using BroadcastChannel API
6. **TypeScript**: Migrate to TypeScript for better type safety

## Security Considerations

- ✅ PKCE prevents authorization code interception
- ✅ State parameter prevents CSRF attacks
- ✅ Nonce prevents replay attacks
- ✅ Cryptographically secure random generation
- ✅ Token expiration checking
- ⚠️ Consider using httpOnly cookies for refresh tokens in production
- ⚠️ Implement Content Security Policy (CSP) headers
