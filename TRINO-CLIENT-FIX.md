# 🔧 Trino Client API Fix

## The Error

```
Trino is not a constructor
```

## Root Cause

The `trino-client@0.2.8` package API was incorrectly used in the backend. Multiple issues were present:

### 1. **Wrong Import Syntax**
```javascript
// ❌ WRONG
import Trino from 'trino-client';
const client = new Trino({ ... });
```

### 2. **Wrong Factory Method**
```javascript
// ❌ WRONG
import trinoClient from 'trino-client';
const client = trinoClient.create({ ... });
```

### 3. **Wrong Authentication Method**
```javascript
// ❌ WRONG
auth: {
  type: 'bearer',
  token: token
}
// Also tried: auth: new BasicAuth(token)
```

### 4. **Missing User Header**
Trino requires user identification even with OAuth2 Bearer tokens.

## The Solution

### ✅ Correct Implementation

```javascript
import { Trino } from 'trino-client';

// Extract user from JWT token (or use default)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null; // Not a JWT
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

// Create Trino client
const decoded = decodeJWT(token);
const user = decoded?.email || decoded?.sub || 'oauth-user';

const client = Trino.create({
  server: 'http://trino:8080',
  catalog: 'tpch',
  schema: 'sf1',
  source: 'trino-oauth-demo',
  extraHeaders: {
    'Authorization': `Bearer ${token}`,
    'X-Trino-User': user  // Required!
  }
});

// Execute query using async iterator
const results = [];
const iterator = await client.query('SELECT * FROM nation LIMIT 10');

for await (const queryResult of iterator) {
  if (queryResult.data) {
    results.push(...queryResult.data);
  }
}
```

## Key Learnings

### 1. **Named Export**
The `trino-client` package exports `Trino` as a named export, not default:
```javascript
import { Trino } from 'trino-client';  // ✅ Correct
```

### 2. **Static Factory Method**
The `Trino` class uses a static `.create()` method:
```javascript
const client = Trino.create({ ... });  // ✅ Correct
```

### 3. **extraHeaders for OAuth2**
Bearer tokens are passed via `extraHeaders`, not `auth`:
```javascript
extraHeaders: {
  'Authorization': `Bearer ${token}`
}
```

### 4. **X-Trino-User Header Required**
Trino needs to know which user is executing the query:
```javascript
extraHeaders: {
  'Authorization': `Bearer ${token}`,
  'X-Trino-User': user  // Extract from token or use default
}
```

### 5. **Async Iterator API**
The modern API returns an async iterator:
```javascript
const iterator = await client.query(query);
for await (const queryResult of iterator) {
  // Process results
}
```

## Trino Client API Reference

### Connection Options
```typescript
type ConnectionOptions = {
  readonly server?: string;           // Trino server URL
  readonly source?: string;           // Application identifier
  readonly catalog?: string;          // Default catalog
  readonly schema?: string;           // Default schema
  readonly auth?: Auth;               // For BasicAuth only
  readonly session?: Session;         // Session properties
  readonly extraCredential?: object;  // Extra credentials
  readonly ssl?: SecureContextOptions;
  readonly extraHeaders?: object;     // Custom HTTP headers (for OAuth2!)
};
```

### Query Execution
```javascript
// Returns an Iterator<QueryResult>
const iterator = await client.query(query);

// Iterate through results
for await (const queryResult of iterator) {
  console.log(queryResult.data);      // Array of row data
  console.log(queryResult.columns);   // Column definitions
  console.log(queryResult.stats);     // Query statistics
}
```

### Helper Methods
```javascript
// Map results
const mapped = await iterator.map(r => r.data ?? []);

// Reduce results
const allData = await iterator.fold([], (row, acc) => [...acc, ...row]);

// ForEach
await iterator.forEach(result => console.log(result.data));
```

## Testing

After fixing, test with:

1. **Login to the app** (OAuth2 flow)
2. **Execute query**: `SELECT * FROM tpch.sf1.nation LIMIT 10`
3. **Check backend logs**:
   ```bash
   docker compose logs backend --tail 30
   ```

Expected output:
```
Executing query: SELECT * FROM tpch.sf1.nation LIMIT 10...
User from token: your-email@example.com
Query executed successfully. Rows returned: 10
```

## References

- Package: https://www.npmjs.com/package/trino-client
- GitHub: https://github.com/trinodb/trino-js-client
- API Docs: https://trinodb.github.io/trino-js-client/
- Integration Tests: https://github.com/trinodb/trino-js-client/blob/main/tests/it/client.spec.ts

---

**Status: FIXED ✅**

The backend now correctly uses the `trino-client@0.2.8` API with Bearer authentication!
