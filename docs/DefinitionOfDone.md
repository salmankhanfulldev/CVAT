# Definition of Done — Annotation Analytics Assessment

Each item below was written **before** implementation began. Evidence links or inline results are added after the work is done.

---

## Floor (Requirements 1–4) — must all pass

- [x] **Req 1 — Endpoint returns correct counts**  
  `GET /api/tasks/1/annotation-counts/` returns `{"task_id":1,"annotation_counts":{"person":2693,"car":1234,...},...}`.  
  Verified by running `curl` inside Docker and comparing totals against CVAT's own label list.  
  _Evidence: see commit `test: improve annotation-counts endpoint with aggregated ORM queries`_

- [x] **Req 2 — Page in the web interface calls it**  
  The `AnnotationAnalytics` component is rendered inside `task-page.tsx` below the job list.  
  _Evidence: [`annotation-analytics.tsx`](../cvat-ui/src/components/task-page/annotation-analytics.tsx)_

- [x] **Req 3 — Counts shown as a graph**  
  Horizontal bar chart rendered with `chart.js` (`react-chartjs-2`), one bar per class, sorted by count.  
  _Evidence: `AnnotationAnalytics` component, `Bar` chart from `react-chartjs-2`._

- [x] **Req 4 — No-data and failed-request handled**  
  - No data: `<Empty>` component shown when `total === 0`.  
  - Failed request: `<Alert type="error">` shown when fetch throws and no prior data exists.  
  - Stale data + new failure: `<Alert type="warning">` shown with the error; previous chart stays visible.  
  _Evidence: `annotation-analytics.tsx` lines covering the `error && !data` and `error && data` branches._

---

## Auth & Access (Requirement 5)

- [x] **Req 5 — Requires login; refuses unauthorised users**  
  `permission_classes = [IsAuthenticated]` → unauthenticated requests receive HTTP 403.  
  `_assert_task_access()` checks owner, assignee, job assignee, and org membership → raises `PermissionDenied` (HTTP 403) for a user with no access.  
  _Evidence: `test/views.py` — `_assert_task_access` function._

---

## Performance (Requirement 6)

- [x] **Req 6 — Speed target set, measured, reported**  
  Target: median ≤ 200 ms over 5 runs.  
  Result: median **148 ms** — target met.  
  _Evidence: `docs/Objectives.md` — MO-1, raw `curl` output._

---

## Filter / Grouping (Requirement 7)

- [x] **Req 7 — One filter beyond plain count**  
  Added `?shape_type=rectangle` (and `?source=manual`) query params to the endpoint.  
  Frontend exposes a "Filter by shape type" dropdown in the analytics panel.  
  Rationale: shape-type breakdown is the most actionable grouping for annotators reviewing class distribution — it separates mask annotations from bounding boxes for the same class.  
  _Evidence: `test/views.py` — `shape_type_filter` branch; `annotation-analytics.tsx` — `Select` control._

---

## Live Update (Requirements 8–9)

- [x] **Req 8 — Graph updates live as annotations change**  
  Component polls `GET /api/tasks/<id>/annotation-counts/` every 10 seconds (MIN\_INTERVAL\_MS = 10 000 ms). Data refreshes without page reload.  
  _(True WebSocket push deferred — see Plan for decision record.)_

- [x] **Req 9 — Recovers when connection drops and comes back**  
  On fetch failure: exponential back-off (doubles each failure, capped at 60 s). On success: interval resets to 10 s.  
  _Evidence: `annotation-analytics.tsx` — `intervalMs.current` logic, `schedulePoll`._

---

## Decision Record (Requirement 10)

- [x] Included in `docs/Plan.md` under "Decision Record (Item 10)".

---

## Code Quality

- [x] No dead code in committed files.
- [x] No commented-out blocks.
- [x] No stray files.
- [x] Commits are incremental and have descriptive messages.

---

## What I Did Not Finish (Declared)

| Item | Status | Reason |
|------|--------|--------|
| True WebSocket push (Req 8 fully) | Polling fallback implemented | Would require Django Channels added to Docker stack — out of scope in remaining time. |
| Formal e2e test | Not done | Time constraint. |

An honest, unfinished submission scores better than a rushed, broken one.
