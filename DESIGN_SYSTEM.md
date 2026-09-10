# Design System & UI/UX Standards

## Design Tokens & Palette
- **Background**: `#0f172a` (Slate 900) & `#020617` (Slate 950).
- **Glassmorphism Panels**: `bg-slate-900/60 backdrop-blur-md border border-slate-800`.
- **Primary Accent**: `#6366f1` (Indigo 500) & `#4f46e5` (Indigo 600).
- **Status Indicators**:
  - `BACKLOG` / `UNSTARTED`: Slate (`#64748b`).
  - `IN_PROGRESS`: Indigo (`#6366f1`) / Sky (`#0284c7`).
  - `BLOCKED` / `CRITICAL`: Rose (`#f43f5e`).
  - `COMPLETED`: Emerald (`#10b981`).

## Component Conventions
- **Empty States**: Clear description of what the area is, why it is empty, and a primary CTA button (*"Create your first project"*).
- **Loading States**: Animated skeletons or spinners without layout shifts.
- **Error States**: Non-blocking toasts or inline alert boxes with explicit retry triggers.
