# Lesson plan automation (Google Apps Script)

End-to-end automation for St. Adelaide lesson plans: **form submit → Drive filing → weekly sheet row → Gemini 3.1 Pro Preview audit → email & Telegram**, plus a **Friday report** driven by the **Teaching Load** matrix.

## Script layout (clasp)

| File | Role |
|------|------|
| `Config.js` | `CONFIG`, HOD names/emails, form vs weekly column indices, headers, `DEADLINE`; secrets from Script Properties |
| `Main.js` | `onFormSubmit`, `doPost` (Telegram), `createTriggers` |
| `Utils.js` | Week parsing (`extractWeekName`), Friday deadline, lateness, Ghanaian date parsing |
| `DriveService.js` | `CONFIG.MASTER_FOLDER_NAME`, move/rename, Word→PDF, file ID from URL |
| `SheetService.js` | `logSubmissionToSheet` (weekly tabs), `updateApprovalStatus`, `getDynamicTeacherRoster`, `getPreviousLessonFileId`, `getResubmissionData`, `getTeachingLoad`, `getExpectedLessonCount`, **`getTargetWeekFromSchedule`** (calendar lookup) |
| `FormService.js` | Automated form setup: `updateAllFormDropdowns` (syncs Teacher, Class, and Subject lists) |
| `AiService.js` | `extractTextFromPdf` (Drive OCR), **`gemini-3.1-pro-preview`** audit: Cambridge rubric, continuity, resubmission context, **Lessons/WK** completeness, fixed output format, **Exponential Backoff** (retry loop for 503/429 errors) |
| `EmailService.js` | Teacher receipt, immediate late HOD alert, **`sendFridayLateReport`** (late rows + missing matrix rows vs **Teaching Load**), **`sendMorningReminders`** (Wed-Thu-Fri autonomous reminders) |
| `TelegramService.js` | `sendAuditAlert` (resubmission header, partial-lesson warning), approval callbacks, matrix-based `/defaulters` (**Granular Tracking**: Partial vs Missing via AI counts), `/status` |
| `appsscript.json` | V8 runtime, timezone |

## AI model

- **API:** `generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent`
- **Key:** Script Property `GEMINI_API_KEY`
- **Resilience:** 3-attempt exponential backoff (2s, 4s, 8s) for high-demand rejections.

## Spreadsheet tabs

| Tab | Purpose |
|-----|---------|
| `Form responses 1` | Linked form responses (columns per `CONFIG.FORM_INDICES`); basis for Friday scan of *submissions* |
| `Staff Roster` | Name, department, email → `getDynamicTeacherRoster()` and HOD email routing |
| `Teaching Load` | Teacher, Class, Subject, Lessons/WK → expected deliverables and `getExpectedLessonCount()` |
| `Term Schedule` | **Current Week**, **Start/End Dates**, **Target Submission Week** → autonomous schedule for reminders |
| `Week N` | Appended rows with HOD check, days late, **AI Audit** text (used for resubmission history and BI) |

## Feature phases (logic overview)

1. **Resubmission / re-audit:** Before audit, `getResubmissionData` scans the current week tab for prior rows with the same teacher/class/subject; prior **AI Audit** text is injected into the user prompt. Telegram titles show resubmission revision count.
2. **Deliverables matrix:** Friday missing detection uses a `Set` of normalized `teacher_class_subject` keys from form rows for the target week, cross-checked against `getTeachingLoad()`; routing uses roster `hodEmail` vs `CONFIG.HOD_EMAILS.UPPER`.
3. **Lesson count & Granular Tracking:** `getExpectedLessonCount` reads **Lessons/WK** for the row matching the submission. The `/defaulters` command and morning reminders now use a **Map-based detection engine** that parses the AI Audit for "LESSONS DETECTED: X". Defaulters are flagged as **❌ Missing** or **⚠️ Partial (X/Y done)**.
4. **Form Automation & Combined Cohorts:** `FormService.js` implements a **Combined Cohort Strategy** (e.g., "Year 1 (A & B)") for teachers sharing streams, ensuring form choices always match matrix keys. Standardized subjects (e.g., **"Computing"**) are enforced.
5. **Self-Healing Sweeper:** `retryFailedAudits` runs hourly via time-trigger, scanning weekly tabs for `PENDING API RETRY` or `GEMINI REJECTED` status and attempting to re-process failed audits and send delayed Telegram alerts.

## Secrets (Script Properties)

**Project Settings → Script Properties:**

- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `CHAT_ID_VP`, `CHAT_ID_LOWER_HOD`, `CHAT_ID_UPPER_HOD`
- `WEBHOOK_SECRET`
- Optional overrides: `EMAIL_*`, `NAME_*` per `Config.js`

Never commit live values to git.

## Behaviour notes

- **Deadline:** Friday immediately before the week start (from the week-range string), `23:59:59` via `CONFIG.DEADLINE` and `calculateFridayDeadline`.
- **Autonomous Schedule:** Reminders and reports use `getTargetWeekFromSchedule()` to read today's date against the **Term Schedule** tab, ensuring perfect alignment without manual week-guessing.
- **Drive links:** If the configured upload column is empty, `onFormSubmit` scans response values for `drive.google.com`.
- **Matrix / form alignment:** Keys strip spaces and lower-case; teacher/class/subject strings should match **Teaching Load** and **Staff Roster** names to avoid false MISSING flags.
- **HOD vs AI:** Sheet/Telegram **Approve** / **Revision** actions are human; AI STATUS is guidance from the prompt rules.

## Drive permissions

Uploads from Google Forms live in the form’s linked responses folder. The account that runs the script needs **Editor** (or equivalent) on that folder and on `CONFIG.MASTER_FOLDER_NAME` so `DriveApp.getFileById` and moves succeed. See historical notes in this repo if moves fail after permission changes.

## Triggers

Run `createTriggers()` once: form submit, Friday report, **Wed-Thu-Fri morning reminders**, **hourly recovery sweeper**, roster sync on edit (see `Main.js`).


## Related doc

- `conductor/heckteck-enterprise-proposal.md` — board-facing summary and Looker / data-source notes
