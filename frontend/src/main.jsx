import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider';
import App from './App';
import './index.css';

console.log('🚀 Starting Trino OAuth Demo...');
console.log('Environment:', {
  provider: import.meta.env.VITE_OAUTH_PROVIDER || 'google',
  backendUrl: import.meta.env.VITE_BACKEND_URL,
});

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  console.log('✅ React app mounted successfully');
} catch (error) {
  console.error('❌ Failed to mount React app:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; color: red; font-family: monospace;">
      <h1>Application Error</h1>
      <pre>${error.message}\n\n${error.stack}</pre>
    </div>
  `;
}
