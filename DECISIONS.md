# Architectural Decision Log & History System (`DecisionRecord`)

## 1. Decision Record Schema
Stores Title, Context, Decision statement, Reason, Alternatives considered, and Owner.
Statuses: `PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`.

## 2. Superseding Decision Lineage (`POST /api/v1/decisions/:id/supersede`)
When architectural decisions evolve, new decisions link back to the superseded record (`supersededById`) preserving immutable audit history.
