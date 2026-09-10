# Webhook Payload Versioning & Test Simulator

## 1. Webhook Payload Versioning (`work_item.created.v1`)
All outbound webhook events include versioned payload structures (`v1`).

## 2. Test Event Simulator (`POST /api/v1/webhooks/:id/test`)
Allows developers to trigger simulated test payload dispatches to verify HMAC-SHA256 signature verification (`X-Webhook-Signature`).
