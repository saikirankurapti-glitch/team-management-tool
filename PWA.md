# Progressive Web App (PWA) Specifications & Caching Rules

## 1. Web App Manifest (`manifest.json`)
Standalone display mode (`display: "standalone"`), theme colors (`#0f172a`), and app shortcuts (*My Work*, *Chat*, *Knowledge*).

## 2. Service Worker Strategy (`sw.js`)
- Static assets and shell: Cache-first.
- API requests (`/api/*`): Network-first with offline fallback.
- Web Push Notifications: Handles push event dispatches and deep link window focus.
