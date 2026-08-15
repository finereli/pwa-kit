# upload

XHR upload with real progress, and a queue that runs a per-file pipeline with bounded concurrency, cancel, retry and a close-tab guard. Spec: `reference/behavior.md` (admin patterns), and Yael's admin for a full pipeline (upload → create draft → trim → transcribe/title).

`lib/upload.ts` → `shared/lib/`. The app supplies `run(job, helpers)`; the queue owns states. Baked in: max 3 concurrent; cancel only while queued/uploading (once the record exists, the pipeline runs to completion and retry resumes after upload); `beforeunload` guard; `baseName` (extension stripped) as the default title so a failed generation never leaves it unnamed. Seams: `accept`, `maxConcurrent`, error strings, the pipeline.

Verify: drop 5 files → 3 run; cancel a queued and an uploading one; close the tab mid-upload → warning; navigate within the SPA → keeps running; retry after a failed process step doesn't re-upload.
