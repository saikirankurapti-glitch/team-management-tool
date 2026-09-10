# Integration Architecture & Provider Management

## 1. Provider Abstraction Model
The platform implements an extensible integration architecture designed to support multiple version control and CI/CD providers (`GITHUB`, `GITLAB`, `BITBUCKET`, `AZURE_DEVOPS`).

```text
                     Integration Hub (Prisma ORM)
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
    GitHub Provider       GitLab Provider      Bitbucket Provider
    - REST & OAuth        - REST & OAuth       - Webhook Receiver
    - Webhook Receiver    - Webhook Receiver   - PR Association
    - PR Association      - PR Association
```

---

## 2. GitHub Integration Setup
1. **Connect Provider**: Navigate to `Settings -> Integrations` or `/integrations` and click **Connect GitHub**.
2. **Webhook Endpoint Configuration**:
   - URL: `https://api.yourstartup.com/api/webhooks/github`
   - Content Type: `application/json`
   - Secret: Shared HMAC Secret Key
   - Events: `pull_request`, `push`, `deployment_status`
3. **Automatic Work Item Reference Detection**:
   When PR titles or branch names contain work item IDs (e.g. `[PROJ-102] Refactor API client` or `bugfix/CUST-104-timeout`), the system links the PR directly to the Work Item.
