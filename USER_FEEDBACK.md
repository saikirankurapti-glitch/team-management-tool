# Pilot User Feedback & Support System

## 1. Internal Pilot Feedback System Overview
The platform includes a lightweight in-app feedback modal (`FeedbackModal.tsx`) available on every page via the Header toolbar 💬 icon.

## 2. Data Schema & Collection
Feedback entries are stored in the database under the `Feedback` model:
- `id`: Unique UUID
- `organizationId`: Tenant isolation boundary
- `userId`: Submitting team member ID
- `category`: `UX_ISSUE` | `BUG` | `FEATURE_REQUEST` | `GENERAL`
- `pageUrl`: URL pathname where feedback was triggered (e.g. `/boards`, `/analytics`)
- `description`: Detailed user message
- `createdAt`: Timestamp

## 3. Administrative Review Endpoint
Admins can view all pilot feedback entries via:
- `GET /api/feedback` (Returns list of feedbacks with submitter user details).
