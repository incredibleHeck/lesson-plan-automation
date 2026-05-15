# St. Adelaide Lesson Plan Automation (HeckTeck 2.0)

An enterprise-grade Google Apps Script (GAS) system for St. Adelaide International Schools: lesson plan intake, Drive filing, AI auditing against Cambridge criteria, a **Teaching Load** deliverables matrix, and real-time leadership oversight via Telegram.

## Features

- **Automated filing and conversion:** Organizes submissions into a chronological folder structure on Google Drive. Converts Microsoft Word (`.docx`) files to PDF using a Google Doc bridge for stable formatting.
- **AI academic audits (Gemini 3.1 Pro Preview):** Calls **`gemini-3.1-pro-preview`** with **3-attempt exponential backoff** (2s, 4s, 8s) for resilience. Heavy work does **not** run inside the form-submit trigger: submissions are logged immediately with a **pending** placeholder, and a **time-driven queue** completes audits safely (see below). Audits use subject-aware Cambridge-style rubrics, **weekly lesson-count completeness**, **subject continuity**, and **resubmission / re-audit** context. The model is instructed to output **`LESSONS DETECTED: [N] Lessons / [M] Lessons`** so downstream **Email** and **Telegram** parsers stay aligned.
- **Queued processing (timeout-safe):** `onFormSubmit` writes **`CONFIG.AUDIT_PENDING_PLACEHOLDER`** to the weekly tab and exits quickly. **`processPendingAudits`** runs on a **10-minute** time trigger, acquires a lock, and processes **many** pending rows **per run** until elapsed time nears **~5 minutes** (Gemini + direct cell write + Telegram each), staying under Apps Script’s **6-minute** limit when many teachers submit at once or when using the Pro model.
- **Autonomous scheduling:** Reminders and reports use a **`Term Schedule`** tab to look up today’s date and determine the target week—no manual week guessing.
- **Failure recovery (reset-to-queue):** An hourly job (**`retryFailedAudits`**) scans **every** **`Week N`** tab in the workbook for failed audit text (`GEMINI REJECTED`, `PENDING API RETRY`, etc.) and **resets those cells to the pending placeholder**. It does **not** call Gemini inline. The **10-minute** **`processPendingAudits`** job drains that queue in **batched** runs with a **~5 minute** cap per execution.
- **Granular compliance tracking:** The **`/defaulters`** command and **morning reminders** use a Map-based engine with **fraction-style** parsing of `LESSONS DETECTED` (including bundled “periods/lessons” text). Defaulters are flagged as **Missing** or **Partial (X/Y done)**. Morning reminder emails throttle sends (**`Utilities.sleep(1500)`**) to reduce Mail quota spikes.
- **Phase 2 — Deliverables matrix:** The **`Teaching Load`** sheet defines what each teacher must submit. Friday reports compare submissions to that matrix using normalized keys.
- **Leadership oversight (Telegram):** Audit summaries go to leadership with inline **Approve** / **Request Revision** actions. **`sendTelegramMessage`** uses **429-aware exponential backoff** for burst traffic.
- **Lateness and reports:** Automated receipts, immediate late HOD alerts, and a Friday HOD report covering late/missing work.
- **Roster and form sync (manual, quota-safe):** **`FormService.js`** builds **Class**, **Subject**, and **Teacher** lists from the spreadsheet. Admins run **HecTech Tools → Sync Form Dropdowns** from the sheet menu (`onOpen`) after editing **Staff Roster** or **Teaching Load**—no **onEdit** storm against the Forms API.

## Tech stack

- **Language:** JavaScript (Google Apps Script, V8)
- **AI:** Google Generative Language API — **Gemini 3.1 Pro Preview** (`gemini-3.1-pro-preview`)
- **Messaging:** Telegram Bot API (webhooks)
- **Storage:** Google Drive API (Advanced Service), Google Sheets
- **Deployment:** `clasp` (optional local sync)

## Project structure

| File | Description |
|------|-------------|
| `Main.js` | `onFormSubmit`, `doPost` (Telegram), `createTriggers`, **`processPendingAudits`** (batched pending drains, ~5 min cap), **`retryFailedAudits`** (hourly sweep of all **`Week N`** tabs, reset-to-queue). |
| `AiService.js` | Gemini API integration with exponential backoff; strict **`LESSONS DETECTED`** line format. |
| `SheetService.js` | Weekly tabs, roster, **Term Schedule** lookup, teaching load. |
| `EmailService.js` | Receipts, late alerts, Friday report, **Wed–Thu–Fri morning reminders**. |
| `TelegramService.js` | Audit alerts, callbacks, **`/defaulters`**, **`/status`**, send backoff. |
| `FormService.js` | **`updateAllFormDropdowns`**, **`onOpen`** → **HecTech Tools** menu. |
| `DriveService.js` | Drive filing, conversion, **`extractTextFromFiles`** for Gemini. |
| `Config.js` | Centralized settings, **`AUDIT_PENDING_PLACEHOLDER`**, Script Properties. |
| `Utils.js` | Ghanaian date parsing, Friday deadline (optional comma in month-day-year), lateness. |

## Spreadsheet model

- **`Form responses 1`** — raw data source (optional **`AI_AUDIT`** column index in `CONFIG` if you mirror weekly audits for reminders).
- **`Staff Roster`** — teacher / department / email → HOD routing.
- **`Teaching Load`** — matrix of expected deliverables and **Lessons/WK**.
- **`Term Schedule`** — calendar master for autonomous week selection.
- **`Week 1`, `Week 2`, …** — processed logs with **AI Audit** text (source of truth for defaulters and BI).

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
4. **Triggers:** Run **`createTriggers()`** once from the editor (installs form submit, Friday report, morning reminders, **hourly** retry reset, **10-minute** pending queue—**not** form dropdown auto-sync).
5. **Form dropdowns:** Open the master spreadsheet and use **HecTech Tools → Sync Form Dropdowns** after roster/load changes.
6. **Data quality:** **Teaching Load** names should match form **Teacher / Class / Subject** text. The system uses **normalization** (lower-case, trimmed, spaces collapsed) for matching.

## Board / BI note

Aggregated reporting (e.g. Looker Studio) should read from **weekly tabs** or a dedicated rollup sheet that includes the **AI Audit** column—not from **Form responses 1** alone. See `conductor/heckteck-enterprise-proposal.md` for context.

---

*This README is excluded from Apps Script via `.claspignore` and is for repository documentation only.*
