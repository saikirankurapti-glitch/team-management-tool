# Web Push Notifications Architecture (`PushSubscription`)

## 1. Push Device Registration (`POST /api/v1/push/subscribe`)
Registers browser Web Push endpoints and encryption keys (`p256dh`, `auth`).

## 2. Test Notification Dispatcher (`POST /api/v1/push/test`)
Dispatches simulated push payloads to subscriber device endpoints with deep links to work items and chat channels.
