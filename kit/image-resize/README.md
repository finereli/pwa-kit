# image-resize

Client-side resize before upload: 1568px max, JPEG 0.85 stepping to 0.3 until under 4MB. `lib/image-resize.ts` → `shared/lib/`. Verify: a 12MB photo uploads under 4MB and ≤1568px.
