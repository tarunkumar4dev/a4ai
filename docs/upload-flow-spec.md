# a4ai: Test Link → Student Upload → Check → Share Result
Handoff spec for Claude Code. Code mein jo already bana hai usse REUSE karo. Naya kuch tabhi banao jab recon mein na mile.

## 0. Pehle ye karo (recon, koi code likhne se pehle)
Repo mein dhundho aur batao kya already hai: test + answer key generation, test link / WhatsApp share, student access code portal, copy checker v4 (feat/checker-v4, job queue, red-pen render, ZIP, WhatsApp share), Supabase storage buckets, results/marks tables, RLS policies. Phir niche ke flow se gap list banao. Sirf gaps wire karo.

## 1. Requirement (teacher ke notes se)
1. Teacher test + answer key create karta hai.
2. Test conduct hota hai (offline paper ya online).
3. Teacher ek link WhatsApp pe share karta hai.
4. Student link kholta hai. Name / class / mail autofetch hote hain.
5. Student answer copy ki files upload karta hai (+ upload). File size, format aur instructions validate hote hain.
6. Upload ke baad "Upload-1" record hota hai. History mein attempts / uploads save hote hain aur wahin visible hote hain.
7. Check hota hai (easy method se, student ko wait na karna pade).
8. Marks visible hote hain, teacher result share karta hai.

## 2. Architecture (flow)

```
Teacher                     Backend (FastAPI/Vercel bom1)            Supabase                     Student
  |-- create test+key ------>| save tests, answer_key ----------------> tests, answer_keys
  |-- create submit link --->| test_links(token, window, rules) ------> test_links
  |-- share on WhatsApp ----------------------------------------------------------------------->  link open
  |                          |<-- GET /link/{token} (validate) --------------------------------|
  |                          |-- identity autofetch (profile / access code) ------------------->|
  |                          |<-- POST /uploads/sign (size, mime) ------------------------------|
  |                          |-- signed URL ---------------------------------------------------->|
  |                          |                                   direct upload to Storage <------|
  |                          |<-- POST /submissions (idempotency_key, file refs) ----------------|
  |                          | create submission(status=uploaded) + enqueue check job
  |                          | worker: Stage A pages -> Gemini Vision check -> marks -> red-pen
  |                          | status=checked (needs_review if low confidence)
  |<-- review/override ------| teacher edits marks
  |-- publish/share result ->| results.published=true ------------------------------------>  marks visible + history
```

Important: Vercel request body limit ~4.5 MB hai. Files backend se mat bhejo. Supabase signed upload URL se direct storage mein upload karo, backend sirf references leta hai.

## 3. Data model (existing tables ke saath map karo, duplicate mat banao)
- test_links: token (unguessable), test_id, opens_at, closes_at, max_attempts, allowed_mimes, max_mb, max_pages, require_identity (login | access_code), is_active
- submissions: id, link_id, student_id, attempt_no, status, idempotency_key (unique), created_at
- submission_files: submission_id, storage_path, mime, size, sha256, page_order
- check_jobs: (existing queue reuse) submission_id, state, retries, error
- results: submission_id, marks, per_question jsonb, confidence, reviewed_by, published (bool), published_at
- result_history: submission_id, marks, per_question jsonb, answer_key_version, changed_by, changed_at (re-grade / override pe purani row yahan jaati hai; naya table banane se pehle check karo ki results ka audit already hai ya nahi)
- answer_keys: test_id, version, content (key edit = naya version, submissions.answer_key_version pin hota hai)

Status machine: `uploaded → queued → checking → checked → (needs_review) → published`. Side states: `failed` (retry hoga), `rejected` (invalid file).

## 4. API contract (minimum)
- GET /link/{token}: validate window, active, attempts left. Test title aur rules return karo (answer key kabhi nahi).
- POST /uploads/sign: mime/size pehle hi validate karke signed URL do.
- POST /submissions: idempotency_key ke saath. Same key dobara aaye to wahi submission return karo.
- GET /submissions/mine: student ki history (attempts + uploaded files + status).
- GET /results/{submission_id}: sirf tab jab published = true aur owner student ho.
- Teacher: GET /tests/{id}/submissions, PATCH /results/{id} (override), POST /tests/{id}/publish.

## 5. Edge cases (carefully dekhna)
**Identity**
- Autofetch kahan se? Logged-in profile ya 6-char access code. Link forward ho jaye to doosra banda kisi aur ke naam se submit na kare: token sirf test tak le jaye, identity alag verify ho.
- Student ka class/mail missing ho to manual fill + teacher-side verify.
- Ek student, ek test: max_attempts enforce backend pe, sirf UI pe nahi.

**Upload**
- Phone se HEIC/WebP aate hain: accept karo ya convert karo, warna format error se student atak jayega.
- Multiple photos ek copy ki: page order drag-reorder, phir PDF merge (Stage A already hai).
- File size/format fail: saaf Hinglish error, kaunsi file kyun reject hui.
- Network beech mein toot jaye: retry + resume, aur idempotency_key se duplicate submission na bane.
- Same file dobara upload (sha256 match): duplicate warn karo.
- 30-page cap, blurry/rotated/andhera: auto-rotate, quality warning, retake ka option.
- Closes_at ke baad upload: reject ya "late" flag (teacher decide kare, link setting mein).
- Link expire / inactive / galat token: friendly page, 404 nahi.
- Low bandwidth: client-side compress (~1600px JPEG), progress bar.

**Check**
- Checker fail ya Gemini 429: job retry with backoff, student ko "checking" dikhao, error nahi.
- Answer key missing/incomplete: submission accept karo, status = waiting_key.
- Teacher ne key edit ki check ke baad: re-grade option (purane marks history mein rahein).
- Low confidence / unreadable answer: needs_review, auto-publish mat karo.
- Burst: ~500 copies/hour, queue se, rate limiter on, zero extra Gemini cost render ke liye (PyMuPDF).
- Student ne upload kiya, abhi check nahi hua, aur dobara upload kiya: latest attempt count hoga ya best? Teacher setting rakho, default = latest.

**Result / privacy**
- Marks tab tak hidden jab tak teacher publish na kare (ya auto-publish setting on ho).
- RLS: student sirf apni submission/result/files dekhe. Doosre student ki copy ka URL guess se na khule (signed, short-expiry URLs).
- Publish ke baad marks badle to student ko updated dikhe aur audit log rahe.
- Red-pen copy + summary share link (G6): link private/expiring ho.

**Cheating (pichli discussion se)**
- Per-student paper variant (question/option shuffle, randomized numbers) ho to submission ko variant_id se map karo, warna answer key mismatch hoga.
- Similarity check cross-submissions pe: "review needed" flag, accusation nahi.
- Same sha256 / same device-IP burst flag karo.

## 6. Build order (gate by gate, har gate pe test + commit)
- G1: test_links + GET /link/{token} validation + identity autofetch
- G2: signed upload + validations + idempotent POST /submissions + history page
- G3: submission → existing checker queue wire, status updates student ko dikhein
- G4: teacher review/override + publish toggle + result page (marks visible)
- G5: edge cases ki list upar se ek-ek test karo (har case ka test likho)
- G6: WhatsApp share of result + variant mapping + similarity flag

## 7. Assumptions (galat ho to batao)
- "Easy method" ka matlab maine student ke liye bina wait ka simple async check (queue) samjha hai.
- "Autofetch" = login/access-code se profile data. Agar login nahi hota to access-code flow use hoga.
- Test online ya offline dono ho sakta hai; yahan focus copy-upload flow pe hai.

## 8. Hardening (review ke baad add kiya)

### 8A. v1 mein MUST (launch se pehle, G1-G5 ke andar)
- **Time:** sab kuch UTC mein store, UI mein IST dikhao. Window check sirf server clock se (phone ka time mat maano). Default grace 2 min. Late submission default = accept + "late" flag, teacher setting se reject.
- **Duplicate/race:** DB unique constraint `(link_id, student_id, attempt_no)`. attempt_no server assign kare, ek Postgres function (RPC) ke andar: pehle `pg_advisory_xact_lock(hashtext(link_id || student_id))` lo, phir max_attempts check karke attempt_no = count+1 insert karo. (Sirf `SELECT ... FOR UPDATE` kaafi nahi: pehle attempt pe lock karne ko koi row hi nahi hoti.) Unique constraint last safety net hai; violation pe ek baar retry karo. idempotency_key client localStorage mein persist ho, retry pe regenerate na ho.
- **Answer key version:** `answer_key_version` har submission pe pin. Key edit ho to naya version; purane marks tabhi badlein jab teacher "re-grade" dabaye. Purane marks `result_history` mein rahein.
- **Publish rules:** status `checking`/`queued` mein publish block. Unpublish allowed (audit log ke saath). Publish ke baad marks edit ho to student ko updated dikhe.
- **needs_review reason codes (enum):** `empty_answer`, `illegible`, `low_confidence`, `key_missing`, `blank_pages`, `bad_scan`. Confidence threshold per-question, global nahi.
- **Upload validation (server side):** magic bytes check (extension/mime header pe bharosa nahi), page count PyMuPDF se, password-protected PDF reject, EXIF/GPS strip, blank page detect.
- **Client side:** HEIC → JPEG convert (heic2any ya canvas), ~1600px JPEG compress, page-by-page progress. Direct-to-storage upload hai, to Vercel 4.5MB limit yahan issue nahi; compress sirf bandwidth/speed ke liye hai.
- **Identity:** v1 mein existing 6-char student access code flow use karo. Rate limit: access code 5 attempts/min/IP + 10 galat attempts pe temporary lockout. Autofetch ke baad email/name "ye aap hi ho?" confirm step.
- **Checker queue:** max retries (3) with backoff, uske baad state `failed` + teacher ko dikhe. Daily Gemini cost cap + circuit breaker (cap cross pe naye jobs pause, alert).
- **AI determinism:** temperature=0, `model_version` har result ke saath store. Note: temperature=0 pe bhi output 100% deterministic nahi hota, isliye marks DB mein store karo, retry pe dobara mat nikalo.
- **Worker timeout:** confirm karo check job ki max duration kitni hai. Agar kam hai to per-page / per-chunk jobs mein todo.
- **DB indexes:** `test_links(token)` unique, `submissions(link_id, student_id)`, `check_jobs(state, created_at)`, `results(submission_id)`.
- **Storage:** bucket private, sirf signed URL. Student files ke liye expiry ~5 min, result share link ~24h.
- **Logs:** student name/email/phone logs mein masked.
- **Rate limit:** submit 3/min/student/link.

### 8B. Baad mein (v1 ke baad, jab real usage dikhe)
- Variant assignment (per-student paper) + similarity flag: pehle variants bane tabhi. Link pe student ko variant kaise milega ye us waqt decide karo.
- Result PDF pe watermark (student name + time).
- Retention/deletion policy (90 din default sochna, deletion request API), DPDP ke hisaab se.
- Resumable upload (TUS), priority lane for small copies, negative marking/grace marks rules.
- Read replica, CDN caching, pre-warm workers: sirf tab jab load test mein bottleneck dikhe.
- Device fingerprint / IP burst flag: school WiFi pe false positive deta hai, isliye sirf sha256 duplicate + similarity use karo.
- Multi-tenant: institute_id pe RLS already hai, bas har naye table pe wahi policy lagao.

### 8C. Test cases
Har edge case ke liye ek test likho: duplicate submit (2 tabs), network drop mid-upload, HEIC file, password PDF, fake .jpg (andar PDF), late submit, key edit after check, publish during checking, galat access code 6 baar, Gemini 429, 31-page PDF.
