# Google Integration Security Architecture

## Token Encryption at Rest
All OAuth access tokens and refresh tokens received from Google OAuth endpoints are encrypted at rest using **AES-256-CBC** before persisting to SQLite database tables (`GoogleAppConfig` and `GoogleConnection`).

```ts
const ALGORITHM = 'aes-256-cbc';
const secretKey = process.env.JWT_SECRET;
// IV is randomly generated per token and prepended as <iv_hex>:<encrypted_hex>
```

## Security Best Practices Enforced
1. **Zero Secret Leakage**: `Client Secret`, `AccessTokenEncrypted`, and `RefreshTokenEncrypted` are never exposed in API responses or frontend JSON payloads. The UI displays masked `••••••••••••••••` placeholders for configured secrets.
2. **Automatic Refresh Token Rotation**: When an access token approaches expiry (within 5 minutes), `getValidAccessTokenForUser()` automatically invokes Google OAuth `grant_type=refresh_token` endpoint to refresh credentials in the background without user interruption.
3. **Graceful Status Transition**: If a refresh token is revoked or invalidated by the user in Google Security Settings, the connection status transitions to `REAUTH_REQUIRED` and prompts the user for re-authorization.
4. **Role-Based Access Control (RBAC)**: Only organization `OWNER` or `ADMIN` roles can view, save, or modify system Google OAuth Client credentials.
