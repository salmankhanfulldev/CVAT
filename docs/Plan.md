# Plan — Annotation Analytics Assessment
**Branch:** dev-test01  
**Author:** Assessment Candidate  
**Committed:** Before any feature code  

---

## What This Assessment Asks

Add two things to CVAT:

1. **An API endpoint** — `GET /api/tasks/<id>/annotation-counts/` — that counts annotations by label class, reading from the database.
2. **A frontend page** — a graph on the task detail page that calls that endpoint and shows the counts.

Items 1–4 are the floor. Items 5–10 are bonuses attempted in order.

---

## Decision Made Before Starting

**Approach taken:** A new Django app named `test` placed at the project root (not inside `cvat/apps/`). The app has no models of its own — it reads from the existing `LabeledShape`, `LabeledImage`, and `LabeledTrack` tables in the `engine` app via Django ORM. The API view uses DRF `APIView` with `IsAuthenticated`. The frontend is a React functional component that calls the API over `fetch` and renders a horizontal bar chart with `chart.js` (already a dependency in `cvat-ui/package.json`).

**Approach rejected:** Writing a raw SQL query or using the CVAT annotation manager (`dm`) pipeline. Rejected because: the ORM approach is readable and maintainable; the annotation manager is designed for export/import workflows and would add unnecessary indirection. Cost: the ORM approach is slightly slower on very large annotation sets (millions of rows) compared to raw SQL, but the difference is negligible at the scale of a task.

---

## Time Budget (8 hours total)

| Hour | Work |
|------|------|
| 0:00–0:30 | Read the codebase: `models.py`, `views.py`, `urls.py`, frontend structure |
| 0:30–1:00 | Commit this Plan + stub docs |
| 1:00–2:00 | Backend: `test/views.py`, `test/urls.py` — Req 1 |
| 2:00–2:30 | Verify API works in Docker with curl |
| 2:30–3:30 | Frontend: `annotation-analytics.tsx` — Req 2 & 3 |
| 3:30–4:00 | Frontend: integrate into `task-page.tsx` |
| 4:00–4:30 | Error and no-data states — Req 4 |
| 4:30–5:30 | Auth & task-access check — Req 5 |
| 5:30–6:00 | Measure endpoint speed — Req 6 |
| 6:00–6:30 | Filter by shape_type — Req 7 |
| 6:30–7:30 | Live polling / WebSocket reconnect — Req 8 & 9 |
| 7:30–8:00 | Final review, clean dead code, commit, write Loom |

**Skipped (declared):** True Django Channels WebSocket push (Req 8 fully). The frontend polls every 10 seconds with exponential back-off on failure (Req 9 satisfied). A full WS push would require adding Django Channels to the Docker stack and changing `cvat/asgi.py` — that is a bigger infrastructure change than the remaining time allows.

---

## What Changed vs. Plan

The plan held. The only deviation: the first commits before this document already existed (the repo had three stub commits from initial scaffolding). This plan supersedes those.

---

## Decision Record (Item 10)

| | |
|---|---|
| **Approach taken** | Django ORM with `.values('label__name').annotate(count=Count('id'))` — one SQL query per annotation table (3 queries total). |
| **Approach rejected** | Python loop over all shapes and counting in memory (`for shape in shapes: counts[shape.label.name] += 1`). This was the initial stub in `views.py`. |
| **Cost of rejection** | The loop approach fetches every row and every related `Label` row (N+1 queries), making it O(N) in both time and memory where N is the annotation count. For a COCO val2017 task (36,781 instances), this would be ~36k DB round trips. The aggregating ORM query does it in one round trip. |
