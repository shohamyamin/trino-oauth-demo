import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { Trino } from 'trino-client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Helper function to decode JWT (without verification - just for user extraction)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Not a JWT, return null
      return null;
    }
    // Decode base64url (handle both standard base64 and base64url encoding)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (error) {
    console.error('Failed to decode JWT:', error.message);
    return null;
  }
}

// Query endpoint - acts as a secure proxy to Trino
app.post('/api/query', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing or invalid Authorization header' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Query string is required' 
      });
    }

    console.log(`Executing query: ${query.substring(0, 50)}...`);
    console.log(`Token length: ${token.length}`);
    console.log(`Token starts with: ${token.substring(0, 100)}`);

    // Extract user from token (if JWT) or use default
    const decoded = decodeJWT(token);
    const user = decoded?.email || decoded?.sub || decoded?.preferred_username || 'oauth-user';
    
    console.log(`User from token: ${user}`);
    console.log(`Decoded token:`, decoded);

    // Configure Trino client with Bearer token authentication
    // We need to send both the Bearer token (for OAuth2) and X-Trino-User header
    const client = Trino.create({
      server: `http://${process.env.TRINO_HOST}:${process.env.TRINO_PORT}`,
      catalog: process.env.TRINO_CATALOG || 'tpch',
      schema: process.env.TRINO_SCHEMA || 'sf1',
      source: 'trino-oauth-demo',
      user: user,  // This should set X-Trino-User header
      extraHeaders: {
        'Authorization': `Bearer ${token}`,  // OAuth2 Bearer token
        'X-Trino-User': user  // Explicitly set the user header
      }
    });

    // Execute query using async iterator
    const results = [];
    const iterator = await client.query(query);
    
    for await (const queryResult of iterator) {
      if (queryResult.data) {
        results.push(...queryResult.data);
      }
    }

    console.log(`Query executed successfully. Rows returned: ${results.length}`);

    res.json({
      success: true,
      data: results,
      rowCount: results.length
    });

  } catch (error) {
    console.error('Error executing query:', error);
    
    // Handle specific error types
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid or expired token. Please log in again.',
        details: error.message
      });
    }

    if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      return res.status(403).json({
        error: 'Authorization Failed',
        message: 'Token does not have required audience claim or permissions.',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Query Execution Failed',
      message: error.message || 'An error occurred while executing the query',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://0.0.0.0:${PORT}`);
  console.log(`Trino connection: http://${process.env.TRINO_HOST}:${process.env.TRINO_PORT}`);
});
