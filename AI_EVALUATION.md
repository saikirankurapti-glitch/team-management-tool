# AI Copilot Response Evaluation & Groundedness Benchmark

## 1. Evaluation Criteria
- **Groundedness**: 100% of factual statements must trace to actual Prisma database records.
- **Zero Hallucination Guardrail**: If requested data does not exist, Copilot responds: *"I searched your workspace data. All active projects, sprints, and tasks are grounded in actual database records."*
- **Tool Routing Accuracy**: 100% test coverage verifying intent mapping to controlled tool functions.
