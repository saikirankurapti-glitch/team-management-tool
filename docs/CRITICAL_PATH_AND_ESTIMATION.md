# Critical Path Method (CPM) & Software Estimation

## Critical Path Algorithm
Implemented in `server/src/services/planningService.ts`:

1. **Cycle Detection (DFS)**:
   - Evaluates dependency graph $G = (V, E)$.
   - Visited states: `UNVISITED (0)`, `VISITING (1)`, `VISITED (2)`.
   - If an edge targets a vertex in state `1`, a cycle exists and an error is thrown.

2. **Forward Pass (Earliest Start / Earliest Finish)**:
   - For all root tasks without predecessors: $ES = \text{Project Start}$.
   - $EF = ES + \text{Duration}$.
   - For downstream tasks: $ES_j = \max_{i \in \text{Pred}(j)} (EF_i + \text{Lag}_{ij})$.

3. **Backward Pass (Latest Start / Latest Finish)**:
   - Project Finish: $T_{\max} = \max_{i} (EF_i)$.
   - For leaf tasks: $LF = T_{\max}$.
   - $LS = LF - \text{Duration}$.
   - For upstream tasks: $LF_i = \min_{j \in \text{Succ}(i)} (LS_j - \text{Lag}_{ij})$.

4. **Slack & Critical Path Determination**:
   - $Slack_i = LS_i - ES_i = LF_i - EF_i$.
   - $\text{IsCritical}_i = (Slack_i \le 0)$.

## Three-Point PERT Estimation Formula
- Optimistic ($O$): Best-case scenario.
- Most Likely ($M$): Realistic estimation.
- Pessimistic ($P$): Worst-case scenario.
- Expected Value: $\mu = \frac{O + 4M + P}{6}$
- Standard Deviation: $\sigma = \frac{P - O}{6}$
- Variance: $\sigma^2 = \left(\frac{P - O}{6}\right)^2$
