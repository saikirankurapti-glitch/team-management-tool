# Statistical Monte Carlo Range Forecasting Methodology

## 1. Monte Carlo Range Forecasting Model
Delivery forecasting estimates backlog completion dates using historical velocity distributions rather than single-point estimates.

| Confidence Level | Calculation Basis | Sample Completion Window |
|:---:|:---:|:---:|
| **50% Confidence** | `Remaining Points / (Avg Velocity * 1.1)` | Oct 12, 2026 (4 Weeks) |
| **70% Confidence** | `Remaining Points / Avg Velocity` | Oct 18, 2026 (5 Weeks) |
| **85% Confidence** | `Remaining Points / (Avg Velocity * 0.85)` | Oct 25, 2026 (6 Weeks) |

## 2. Insufficient History Guardrail
If fewer than 5 completed work items exist, the engine displays:
`"Not enough historical data for reliable forecasting."`
to prevent misleading predictions.
