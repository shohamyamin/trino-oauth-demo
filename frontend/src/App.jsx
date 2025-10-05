import { useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import axios from 'axios';
import './App.css';

function App() {
  const { user, accessToken, isAuthenticated, isLoading, error: authError, login, logout, providerName, getToken } = useAuth();
  const [query, setQuery] = useState('SELECT * FROM tpch.sf1.nation LIMIT 10');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const MAX_QUERY_LENGTH = 10000;

  const executeQuery = async () => {
    const token = getToken();
    const idTokenFromStorage = sessionStorage.getItem('id_token');
    const tokenToUse = idTokenFromStorage || token;
    
    if (!tokenToUse) {
      setError('No authentication token available. Please log in again.');
      return;
    }

    if (!query.trim()) {
      setError('Query cannot be empty.');
      return;
    }

    if (query.length > MAX_QUERY_LENGTH) {
      setError(`Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/query`,
        { query },
        {
          headers: {
            'Authorization': `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setResults(response.data);
    } catch (err) {
      let errorMessage = 'An error occurred while executing the query';
      
      if (err.response) {
        errorMessage = err.response.data?.message || err.response.statusText || errorMessage;
      } else if (err.request) {
        errorMessage = 'Cannot connect to backend server. Is it running?';
      } else {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    'SELECT * FROM tpch.sf1.nation LIMIT 10',
    'SELECT * FROM tpch.sf1.region',
    'SELECT n.name, r.name as region FROM tpch.sf1.nation n JOIN tpch.sf1.region r ON n.regionkey = r.regionkey',
    'SELECT COUNT(*) as total_nations FROM tpch.sf1.nation'
  ];

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">Initializing authentication...</div>
      </div>
    );
  }

  // Show auth error if present
  if (authError && window.location.pathname === '/callback') {
    return (
      <div className="app">
        <div className="app-main">
          <div className="error-box" style={{ margin: '2rem' }}>
            <h3>❌ Authentication Error</h3>
            <p>{authError}</p>
            <p>Redirecting to home page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔐 Trino OAuth Demo</h1>
        <div className="auth-info">
          {isAuthenticated ? (
            <>
              <span className="user-info">
                👤 {user?.name || user?.email || 'User'}
              </span>
              <button onClick={logout} className="btn btn-secondary">
                Logout
              </button>
            </>
          ) : (
            <button onClick={login} className="btn btn-primary">
              Login with {providerName}
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {!isAuthenticated ? (
          <div className="welcome-message">
            <h2>Welcome to Trino OAuth Demo</h2>
            <p>Please log in with {providerName} to execute queries against Trino.</p>
            <div className="credentials-box">
              <h3>How to Configure:</h3>
              <p>1. Copy <code>frontend/.env.example</code> to <code>frontend/.env</code></p>
              <p>2. Set <code>VITE_OAUTH_PROVIDER</code> to: google, github, auth0, or keycloak</p>
              <p>3. Fill in your OAuth2 credentials from your provider</p>
              <p>4. Restart the frontend container</p>
              <br />
              <p><strong>Current Provider:</strong> {providerName}</p>
            </div>
          </div>
        ) : (
          <div className="query-section">
            <div className="token-info">
              <details>
                <summary>🔑 Token Information</summary>
                <div className="token-content">
                  <p><strong>Provider:</strong> {providerName}</p>
                  <p><strong>User:</strong> {user?.name || user?.email}</p>
                  <p><strong>Email:</strong> {user?.email}</p>
                  <p><strong>Subject:</strong> {user?.sub}</p>
                  <p><strong>Token:</strong> {accessToken ? `${accessToken.substring(0, 20)}...` : 'N/A'}</p>
                </div>
              </details>
            </div>

            <div className="sample-queries">
              <h3>Sample Queries:</h3>
              <div className="query-buttons">
                {sampleQueries.map((sq, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(sq)}
                    className="btn btn-small"
                  >
                    Query {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="query-input">
              <label htmlFor="query">SQL Query:</label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
                placeholder="Enter your SQL query here..."
              />
              <button
                onClick={executeQuery}
                disabled={loading || !query.trim()}
                className="btn btn-primary"
              >
                {loading ? 'Executing...' : 'Execute Query'}
              </button>
            </div>

            {error && (
              <div className="error-box">
                <h3>❌ Error</h3>
                <p>{error}</p>
              </div>
            )}

            {results && (
              <div className="results-section">
                <h3>✅ Query Results</h3>
                <p className="row-count">Rows returned: {results.rowCount}</p>
                
                {results.data && results.data.length > 0 ? (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          {Object.keys(results.data[0]).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.data.map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).map((value, vidx) => (
                              <td key={vidx}>{JSON.stringify(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No data returned.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Full-stack demo: Vite/React → Express.js → Trino with Keycloak OAuth2
        </p>
      </footer>
    </div>
  );
}

export default App;
