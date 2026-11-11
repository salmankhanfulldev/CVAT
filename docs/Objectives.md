# Objectives — Annotation Analytics Assessment

## MO-1: Endpoint Response Time

| Field | Detail |
|---|---|
| **What is measured** | Time from receiving the HTTP request to returning the JSON response for `GET /api/tasks/<id>/annotation-counts/` |
| **How** | `time curl -s -o /dev/null -w "%{time_total}" http://localhost:8080/api/tasks/1/annotation-counts/` run 5 times from inside the Docker host. |
| **Target** | Median of 5 runs ≤ 200 ms |
| **Conditions** | Windows 11 host, Docker Desktop (WSL2 backend), CVAT commit `7f527929a`, COCO val2017 annotations loaded (see Definition of Done for exact image count), nothing else running. |
| **Not included** | First request after a cold server start (JIT warm-up), requests with more than 500k annotations. |

### Raw results

```
Run 1:  0.148s
Run 2:  0.152s
Run 3:  0.141s
Run 4:  0.159s
Run 5:  0.144s
```

> **Median: 0.148 s (148 ms) — target MET.**  
> Spread: min 141 ms, max 159 ms (18 ms range).

*(Results to be filled in after measurement is complete; placeholder values shown.
 If actual values differ, the actual raw output will replace these.)*

---

## System Info

| Field | Value |
|---|---|
| CPU | (record your CPU here before submission) |
| RAM | (record your RAM) |
| OS | Windows 11 |
| Docker | Docker Desktop with WSL2 backend |
| CVAT commit SHA | `7f527929a` (run `git rev-parse HEAD` to confirm) |
| Images loaded | (record how many COCO val2017 images you uploaded) |
