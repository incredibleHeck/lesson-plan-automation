# Lesson plan automation (Google Apps Script)

End-to-end automation for St. Adelaide lesson plans: **form submit → Drive filing → weekly sheet row (audit pending) → queued Gemini 3.1 Pro Preview audit → email & Telegram**, plus a **Friday report** driven by the **Teaching Load** matrix.

## Script layout (clasp)

| File | Role |
|------|------|
| `Config.js` | `CONFIG`, HOD names/emails, form vs weekly column indices (including optional `FORM_INDICES.AI_AUDIT`), headers, `AUDIT_PENDING_PLACEHOLDER`, `DEADLINE`; secrets from Script Properties |
| `Main.js` | `onFormSubmit` (fast path: no Gemini), `doPost` (Telegram), `createTriggers`, **`processPendingAudits`** (one audit per run), **`retryFailedAudits`** (hourly sweep of all **`Week N`** tabs; reset failed cells to pending—no API calls) |
| `Utils.js` | Week parsing (`extractWeekName`), Friday deadline (month-day-year regex with **optional comma**), lateness (`Math.ceil` days), Ghanaian date parsing for form timestamps |
| `DriveService.js` | `CONFIG.MASTER_FOLDER_NAME`, move/rename, Word→PDF, **`extractTextFromFiles`** for Gemini input |
| `SheetService.js` | `logSubmissionToSheet` (weekly tabs), `updateApprovalStatus`, `getDynamicTeacherRoster`, `getPreviousLessonFileId`, `getResubmissionData`, `getTeachingLoad`, `getExpectedLessonCount`, **`getTargetWeekFromSchedule`** |
| `FormService.js` | **`updateAllFormDropdowns`** (Class / Subject / Teacher from sheets), **`onOpen`** → **HecTech Tools** menu (manual sync—no `onEdit` trigger) |
| `AiService.js` | **`gemini-3.1-pro-preview`** audit: Cambridge rubric, continuity, resubmission context, **Lessons/WK**, fixed output with **`LESSONS DETECTED: … Lessons / … Lessons`**, exponential backoff (503/429) |
| `EmailService.js` | Teacher receipt, late HOD alert, **`sendFridayLateReport`**, **`sendMorningReminders`** (fraction parsing + pacing; portal **HecTech**) |
| `TelegramService.js` | `sendAuditAlert`, **`sendTelegramMessage`** (429 backoff), approval callbacks, **`/defaulters`** (same counting logic as morning reminders), **`/status`** |
| `appsscript.json` | V8 runtime, timezone |

## AI model

- **API:** `generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent`
- **Key:** Script Property `GEMINI_API_KEY`
- **Execution:** Audits run in **`processPendingAudits`**, not in `onFormSubmit`, to stay under the **6-minute** Apps Script limit.
- **Resilience:** 3-attempt exponential backoff (2s, 4s, 8s) for high-demand rejections; hourly **`retryFailedAudits`** walks every **`Week X`** sheet and resets matching failed rows to **`CONFIG.AUDIT_PENDING_PLACEHOLDER`** for the queue to drain.

## Spreadsheet tabs

| Tab | Purpose |
|-----|---------|
| `Form responses 1` | Linked form responses (`CONFIG.FORM_INDICES`); Friday scan of *submissions*; optional column for mirrored AI audit if used by morning reminders |
| `Staff Roster` | Name, department, email → `getDynamicTeacherRoster()` |
| `Teaching Load` | Teacher, Class, Subject, Lessons/WK → deliverables and `getExpectedLessonCount()` |
| `Term Schedule` | Date ranges and **Target Submission Week** → `getTargetWeekFromSchedule()` |
| `Week N` | Processed rows: HOD check, days late, **AI Audit** (pending placeholder until the queue runs) |

## Feature phases (logic overview)

1. **Resubmission / re-audit:** `getResubmissionData` scans the week tab; prior **AI Audit** text is injected when present. Telegram titles show resubmission revision count.
2. **Deliverables matrix:** Friday missing detection uses normalized keys vs **`getTeachingLoad()`**; routing uses **Staff Roster** HOD email.
3. **Lesson count & granular tracking:** Expected count from **Lessons/WK**; **`/defaulters`** and **morning reminders** parse **`LESSONS DETECTED`** with fraction-style logic and **additive** totals across multiple rows for split submissions.
4. **Form alignment:** **`updateAllFormDropdowns`** uses resilient title matching (`includes("class")`, etc.) and **skips** `setChoiceValues` when a list is empty. Sync runs from **HecTech Tools → Sync Form Dropdowns** after **Staff Roster** / **Teaching Load** edits.
5. **Audit queue:** `onFormSubmit` sets **`AUDIT_PENDING_PLACEHOLDER`**; **`processPendingAudits`** (10-minute trigger, script lock, **one row per run**) runs **`generateAiSummary`**, **`updateSheetWithAudit`**, **`sendAuditAlert`**.
6. **Failure reset:** **`retryFailedAudits`** (hourly, all tabs named **`Week N`**) finds `GEMINI REJECTED`, `PENDING API RETRY`, etc., and **only** resets the cell to the pending placeholder—**no** inline Gemini calls.

## Secrets (Script Properties)

**Project Settings → Script Properties:**

- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `CHAT_ID_VP`, `CHAT_ID_LOWER_HOD`, `CHAT_ID_UPPER_HOD`
- `WEBHOOK_SECRET`
- Optional overrides: `EMAIL_*`, `NAME_*`, `TELEGRAM_*_USER_ID` per `Config.js`

Never commit live values to git.

## Behaviour notes

- **Deadline:** Friday immediately before the week start (from the week-range string), `23:59:59` via `CONFIG.DEADLINE` and `calculateFridayDeadline` (date token allows **optional comma** after the day).
- **Autonomous schedule:** Reminders and reports use **`getTargetWeekFromSchedule()`** vs **Term Schedule**.
- **Drive links:** If the upload column is empty, `onFormSubmit` scans response values for `drive.google.com`.
- **Matrix / form alignment:** Normalized keys; names on **Teaching Load** and **Staff Roster** should match form choices.
- **HOD vs AI:** Sheet/Telegram **Approve** / **Revision** are human actions; AI **STATUS** follows prompt rules.

## Drive permissions

Uploads from Google Forms live in the form’s linked responses folder. The account that runs the script needs **Editor** (or equivalent) on that folder and on **`CONFIG.MASTER_FOLDER_NAME`** so moves and reads succeed.

## Triggers

Run **`createTriggers()`** once: **form submit**, **Friday report**, **Wed–Thu–Fri morning reminders**, **hourly** `retryFailedAudits`, **10-minute** `processPendingAudits`.

**Not installed:** spreadsheet **`onEdit`** for form syncing (use the **HecTech Tools** menu instead).

## Related doc

- `conductor/heckteck-enterprise-proposal.md` — board-facing summary and Looker / data-source notes
