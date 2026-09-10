# Custom Fields Framework Specifications (`CustomFieldDefinition` & `CustomFieldValue`)

## 1. Typed Field Definitions
Supports `TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `SINGLE_SELECT`, `MULTI_SELECT`, and `USER` field types.

## 2. Storage & Querying (`POST /api/v1/custom-values`)
Values are stored in normalized `CustomFieldValue` tables mapped by `fieldId` and `workItemId`.
