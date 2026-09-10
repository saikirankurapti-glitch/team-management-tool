# Deployment & Production Readiness Specifications

## Health Checks & Load Balancer Target Groups
- Liveness Probe: `GET /health/live`
- Readiness Probe: `GET /health/ready`
- Dependency Health: `GET /health/deps`
