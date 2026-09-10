# Third-Party OAuth Application Specifications (`OAuthApp`)

## 1. Application Registration
Developers register third-party OAuth apps storing `clientId`, `clientSecretHash` (SHA-256 digest), `redirectUri`, and scopes.
- **Client Secret Display**: Plaintext client secret is returned ONLY ONCE upon creation.
- **Secret Rotation**: Secret rotation invalidates previous hashes immediately.
