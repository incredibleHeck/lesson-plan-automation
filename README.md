# St. Adelaide Lesson Plan Automation (HeckTeck 2.0)

An enterprise-grade Google Apps Script (GAS) system for St. Adelaide International Schools: lesson plan intake, Drive filing, AI auditing against Cambridge criteria, a **Teaching Load** deliverables matrix, and real-time leadership oversight via Telegram.

## Features

- **Automated filing and conversion:** Organizes submissions into a chronological folder structure on Google Drive. Converts Microsoft Word (`.docx`) files to PDF using a Google Doc bridge for stable formatting.
- **AI academic audits (Gemini 3.1 Pro Preview):** Calls the **`gemini-3.1-pro-preview`** model via the Generative Language API. Audits use subject-aware Cambridge-style rubrics, **weekly lesson-count completeness** (from the matrix), **subject continuity** with the previous week’s plan when a prior file exists, and **resubmission / re-audit** context when the same teacher/class/subject row already exists for that week. The model outputs a fixed layout including **LESSONS DETECTED: found / expected**, a **RATING** out of 10, and **STATUS** with a school-wide threshold (**7.0+ suggested as APPROVED**, **6.9 or below as REVISION NEEDED**). HODs still make the final call in Telegram.
- **Phase 2 — Deliverables matrix:** **`Teaching Load`** sheet (Teacher, Class, Subject, Lessons/WK) defines what each teacher must submit. The Friday email report compares form submissions to that matrix (normalized keys), so missing work is reported per **class/subject**, not only “did the teacher submit something.”
- **Phase 3 — Lesson count awareness:** Expected lessons per week are passed into the audit; Telegram can show a **partial submission** banner when parsed counts fall short of expected.
- **Resubmission lifecycle:** New submissions for the same teacher/class/subject on the same week tab carry prior AI feedback into the prompt; Telegram headers flag **RESUBMISSION** with a revision counter.
- **Leadership oversight (Telegram):** Audit summaries go to the VP and relevant HOD with inline **Approve** / **Request Revision** actions (human-in-the-loop).
- **Lateness and Friday reports:** Lateness uses the Friday-before-week-start deadline (`CONFIG.DEADLINE`). The Friday report lists late submissions (by HOD routing) and **missing** matrix deliverables (using **Staff Roster** for Upper vs Lower routing).
- **Teacher nudges:** Slash commands and callbacks help leadership nudge missing teachers and update sheet status.
- **Roster and form sync:** **`FormService.js`** automates the population of **Class**, **Subject**, and **Teacher** dropdowns. It implements a **Combined Cohort Strategy** (e.g., "Year 1 (A & B)") to handle multi-stream teaching with single submissions, ensuring form options perfectly match the **Teaching Load** matrix.
- **Terminology standardization:** The system uses standardized subject names (e.g., **"Computing"** instead of the legacy "ICT") to ensure clean reporting and matrix matching.

## Tech stack

- **Language:** JavaScript (Google Apps Script, V8)
- **AI:** Google Generative Language API — **Gemini 3.1 Pro Preview** (`gemini-3.1-pro-preview`)
- **Messaging:** Telegram Bot API (webhooks)
- **Storage:** Google Drive API (Advanced Service), Google Sheets
- **Deployment:** `clasp` (optional local sync)

## Project structure

| File | Description |
|------|-------------|
| `Main.js` | `onFormSubmit` orchestration, `doPost` webhook entry, `createTriggers` |
| `AiService.js` | PDF OCR via Drive, Gemini audit prompts and API call; enforces **7.0/10 automated threshold** |
| `DriveService.js` | Master folder, move/rename, Word→PDF |
| `TelegramService.js` | Audit alerts, partial-count warning, approval callbacks, matrix-based `/defaulters` (granular tracking) |
| `SheetService.js` | Weekly tabs, logging, roster, previous-week file lookup, resubmission data, teaching load, expected lesson count |
| `EmailService.js` | Receipts, immediate late alerts, Friday late/missing report |
| `FormService.js` | Automated form setup: Roster → dropdown sync, Class/Subject standardization |
| `Config.js` | `CONFIG`, indices, headers, Script Properties |
| `Utils.js` | Ghanaian date parsing, deadlines, week helpers |

## Spreadsheet model

- **`Form responses 1`** — raw form responses (no AI column; used for triggers and Friday scanning).
- **`Staff Roster`** — teacher name, department, email (HOD routing).
- **`Teaching Load`** — expected deliverables and **Lessons/WK** per teacher/class/subject.
- **`Week 1`, `Week 2`, …** — one tab per week with logged rows including **AI Audit**, **Days Late**, **HOD Check**.

## Setup

1. **Environment:** Use `clasp` to push/pull if you maintain the script from this repo.
2. **Secrets (Script Properties):** `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CHAT_ID_VP`, `CHAT_ID_LOWER_HOD`, `CHAT_ID_UPPER_HOD`, `WEBHOOK_SECRET`, plus email-related properties as set in `Config.js`.
3. **Advanced services:** Enable **Drive API v3** in the Apps Script editor.
4. **Triggers:** Run `createTriggers()` once from the editor.
5. **Data quality:** **Teaching Load** names should match form **Teacher / Class / Subject** text (normalization ignores case and spaces).

## Board / BI note

Aggregated reporting (e.g. Looker Studio) should read from **weekly tabs** or a dedicated rollup sheet that includes the **AI Audit** column—not from **Form responses 1** alone. See `conductor/heckteck-enterprise-proposal.md` for context.

---

*This README is excluded from Apps Script via `.claspignore` and is for repository documentation only.*
