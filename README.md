# St. Adelaide Lesson Plan Automation (HeckTeck 2.0)

An enterprise-grade Google Apps Script (GAS) system for St. Adelaide International Schools: lesson plan intake, Drive filing, AI auditing against Cambridge criteria, a **Teaching Load** deliverables matrix, and real-time leadership oversight via Telegram.

## Features

- **Automated filing and conversion:** Organizes submissions into a chronological folder structure on Google Drive. Converts Microsoft Word (`.docx`) files to PDF using a Google Doc bridge for stable formatting.
- **AI academic audits (Gemini 3.1 Pro Preview):** Calls the **`gemini-3.1-pro-preview`** model with **3-attempt exponential backoff** (2s, 4s, 8s) for resilience. Audits use subject-aware Cambridge-style rubrics, **weekly lesson-count completeness**, **subject continuity**, and **resubmission / re-audit** context. The model outputs a fixed layout including **LESSONS DETECTED: found / expected**, a **RATING** out of 10, and **STATUS** (7.0 threshold).
- **Autonomous Scheduling:** Reminders and reports use a **`Term Schedule`** tab to look up today's date and determine the target week perfectly, eliminating manual "week guessing."
- **Self-Healing Recovery:** An hourly **Recovery Sweeper** (`retryFailedAudits`) scans for `PENDING API RETRY` or `GEMINI REJECTED` statuses and automatically re-processes them, ensuring 100% compliance tracking even during API outages.
- **Granular Compliance Tracking:** The `/defaulters` command and morning reminders use a Map-based engine to parse AI audits. Defaulters are flagged as **❌ Missing** or **⚠️ Partial (X/Y done)**.
- **Phase 2 — Deliverables matrix:** **`Teaching Load`** sheet defines what each teacher must submit. Friday reports compare submissions to that matrix using normalized keys.
- **Leadership oversight (Telegram):** Audit summaries go to leadership with inline **Approve** / **Request Revision** actions.
- **Lateness and Reports:** Automated receipts, immediate late alerts, and a Friday HOD report covering late/missing work.
- **Roster and form sync:** **`FormService.js`** automates **Class**, **Subject**, and **Teacher** dropdowns, enforcing a **Combined Cohort Strategy** to match matrix keys.

## Tech stack

- **Language:** JavaScript (Google Apps Script, V8)
- **AI:** Google Generative Language API — **Gemini 3.1 Pro Preview** (`gemini-3.1-pro-preview`)
- **Messaging:** Telegram Bot API (webhooks)
- **Storage:** Google Drive API (Advanced Service), Google Sheets
- **Deployment:** `clasp` (optional local sync)

## Project structure

| File | Description |
|------|-------------|
| `Main.js` | Orchestration, webhooks, `createTriggers`, and the **Recovery Sweeper**. |
| `AiService.js` | Gemini API integration with **Exponential Backoff**. |
| `SheetService.js` | Weekly tabs, roster, **Autonomous Schedule lookup**, and teaching load. |
| `EmailService.js` | Receipts, late alerts, Friday report, and **Wed-Thu-Fri Morning Reminders**. |
| `TelegramService.js` | Audit alerts, callbacks, and **Granular `/defaulters` Tracking**. |
| `FormService.js` | Dropdown automation and standardization. |
| `Config.js` | Centralized settings and Script Properties. |
| `Utils.js` | Ghanaian date parsing and deadline math. |

## Spreadsheet model

- **`Form responses 1`** — raw data source.
- **`Staff Roster`** — teacher/dept/email mapping.
- **`Teaching Load`** — matrix of expected deliverables and **Lessons/WK**.
- **`Term Schedule`** — calendar master for autonomous week selection.
- **`Week 1`, `Week 2`, …** — processed logs with AI audits.

## Setup

1. **Environment:** Use `clasp` to push/pull if you maintain the script from this repo.
2. **Secrets (Script Properties):** Go to **Project Settings → Script Properties** and add the following keys:

| Property Key | Description | Example / Source |
|--------------|-------------|-----------------|
| `GEMINI_API_KEY` | Google AI Studio API Key | `AIzaSy...` |
| `TELEGRAM_BOT_TOKEN` | BotFather token | `123456:ABC-DEF...` |
| `CHAT_ID_VP` | Telegram Chat ID for VP | `-100...` |
| `CHAT_ID_LOWER_HOD` | Telegram Chat ID for Lower HOD | `-100...` |
| `CHAT_ID_UPPER_HOD` | Telegram Chat ID for Upper HOD | `-100...` |
| `WEBHOOK_SECRET` | Custom token for `?token=X` | Any long random string |
| `EMAIL_VP` | VP's official email | `theodora@...` |
| `EMAIL_LOWER_HOD` | Lower HOD email | `alfred@...` |
| `EMAIL_UPPER_HOD` | Upper HOD email | `abigail@...` |

3. **Advanced services:** Enable **Drive API v3** in the Apps Script editor.
4. **Triggers:** Run `createTriggers()` once from the editor.
5. **Data quality:** **Teaching Load** names should match form **Teacher / Class / Subject** text. The system uses **Normalization (lower-case, trimmed, and space-agnostic)** to ensure robust matching even with minor typos.

## Board / BI note

Aggregated reporting (e.g. Looker Studio) should read from **weekly tabs** or a dedicated rollup sheet that includes the **AI Audit** column—not from **Form responses 1** alone. See `conductor/heckteck-enterprise-proposal.md` for context.

---

*This README is excluded from Apps Script via `.claspignore` and is for repository documentation only.*
