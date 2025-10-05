# Trino Authorization Configuration

## Overview
This document describes the authorization system implemented in Trino to restrict query execution to specific admin users.

## Configuration

### Environment Variables
Add the following to your `.env` file:

```env
TRINO_ADMIN_USERNAME=shoham39@gmail.com
```

This username (which could be an email, user ID, or any other identifier depending on your `OAUTH2_PRINCIPAL_FIELD` setting) will be the only user authorized to execute queries in Trino.

**Note:** The value should match whatever is extracted from the OAuth token based on the `OAUTH2_PRINCIPAL_FIELD` setting:
- If `OAUTH2_PRINCIPAL_FIELD=email`, use the user's email address
- If `OAUTH2_PRINCIPAL_FIELD=sub`, use the user's subject identifier
- If `OAUTH2_PRINCIPAL_FIELD=preferred_username`, use the username

### Files Modified

1. **`.env`** - Added `TRINO_ADMIN_USERNAME` variable
2. **`trino/etc/config.properties`** - Added access control configuration
3. **`trino/etc/access-control.properties`** - New file defining access control settings
4. **`trino/etc/rules.json`** - New file with authorization rules
5. **`trino/docker-entrypoint.sh`** - Updated to substitute environment variables in rules

### Authorization Rules

The access control system implements the following rules:

#### Catalogs
- **Admin user** (`${TRINO_ADMIN_USERNAME}`): Full access to all catalogs
- **All other users**: No access to any catalog

#### Schemas
- **Admin user**: Owner permissions on all schemas
- **All other users**: No access

#### Tables
- **Admin user**: Full privileges (SELECT, INSERT, DELETE, UPDATE, OWNERSHIP, GRANT_SELECT)
- **All other users**: No access

#### Queries
- **Admin user**: Can execute, kill, and view queries
- **All other users**: Cannot perform any query operations

## How It Works

1. When a user authenticates via OAuth2, their username/identifier is extracted from the OAuth token (configured via `OAUTH2_PRINCIPAL_FIELD`)
2. Trino loads the access control rules from `/etc/trino/rules.json`
3. The `docker-entrypoint.sh` script substitutes `${ENV:TRINO_ADMIN_USERNAME}` with the actual value from the environment variable
4. Trino matches the authenticated user's principal against the rules
5. Only the admin username is granted access to execute queries

## Testing

To test the authorization:

1. **As Admin User** (`shoham39@gmail.com`):
   - Log in with the configured admin username/email
   - You should be able to execute queries successfully

2. **As Non-Admin User**:
   - Log in with any other username/email
   - You should receive "Access Denied" errors when trying to execute queries

## Adding Multiple Admin Users

To allow multiple administrators, you can modify `trino/etc/rules.json`:

```json
{
  "catalogs": [
    {
      "user": "shoham39@gmail.com",
      "catalog": ".*",
      "allow": "all"
    },
    {
      "user": "another-admin@example.com",
      "catalog": ".*",
      "allow": "all"
    },
    {
      "user": ".*",
      "catalog": ".*",
      "allow": "none"
    }
  ],
  ...
}
```

Or use a regex pattern to match multiple users:
```json
{
  "user": "(shoham39@gmail\\.com|another-admin@example\\.com)",
  "catalog": ".*",
  "allow": "all"
}
```

## Deployment

After making changes:

```bash
# Restart Trino to apply the new configuration
docker-compose restart trino

# Or rebuild and restart all services
docker-compose down
docker-compose up --build -d
```

## Security Notes

1. The authorization rules are evaluated in order - first match wins
2. The refresh period is set to 1 second, so changes to rules.json take effect quickly
3. Always place deny rules (catch-all) at the end of each section
4. The admin username is case-sensitive and must match exactly as provided by the OAuth provider
5. Ensure `TRINO_ADMIN_USERNAME` matches the field specified in `OAUTH2_PRINCIPAL_FIELD`

## Troubleshooting

### User cannot execute queries
- Verify the user's principal field in the OAuth token matches `TRINO_ADMIN_USERNAME` exactly
- Check that `OAUTH2_PRINCIPAL_FIELD` is set to the correct field in the OAuth token
- Check Trino logs: `docker-compose logs trino`
- Ensure the rules.json file was properly processed with environment variables substituted
- Verify the principal field value is case-sensitive and matches exactly

### Access control not working
- Verify the access control files exist in `/etc/trino/`
- Check that `docker-entrypoint.sh` has execute permissions
- Ensure environment variables are properly loaded in docker-compose.yml
- Confirm that `TRINO_ADMIN_USERNAME` matches the field specified by `OAUTH2_PRINCIPAL_FIELD`
