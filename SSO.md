# Enterprise Single Sign-On (SSO) & Identity Management

## 1. Provider Abstraction
Supports integration with SAML 2.0 and OpenID Connect (OIDC) identity providers (Okta, Microsoft Entra ID, Google Workspace, Auth0).

## 2. Member Lifecycle & Domain Verification
- **Domain Verification**: Verifies ownership of company email domains (`company.com`).
- **User Lifecycle**: `Invite` ➔ `Accept` ➔ `Active` ➔ `Suspended` ➔ `Deactivated`. Historical user activity retains proper attribution upon deactivation.
