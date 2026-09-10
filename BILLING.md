# Commercial Subscription Billing & Metered Usage Specifications

## 1. Subscription Lifecycle & Trial System
Organizations initialize with a **14-Day Free Trial** on the `TEAM` plan.
- **Trial Status**: `TRIALING` status with `trialEndsAt` timestamp.
- **Billing Management UI**: Accessible at `/settings/billing` displaying active plan, trial remaining days, and metered resource limits.

## 2. Plan Entitlements & Pricing Tiers

| Tier Name | Price | Member Limit | Project Limit | AI Allowance | Outbound Webhooks |
|---|---|---|---|---|---|
| **Starter** | $0 / mo | 5 Members | 3 Projects | Disabled | Disabled |
| **Team** | $15 / user / mo | 25 Members | 20 Projects | 10,000 Tokens/mo | 5 Endpoints |
| **Business** | $29 / user / mo | 100 Members | 50 Projects | 50,000 Tokens/mo | 20 Endpoints |
| **Enterprise** | Custom | Unlimited | Unlimited | Custom | Unlimited |
