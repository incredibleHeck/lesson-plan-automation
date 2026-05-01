# Lesson plan automation (Google Apps Script)

Automates St. Adelaide lesson plan intake: form submit → Drive filing, weekly sheet rows, Gemini audit, email/Telegram alerts, and a Friday late/missing report.

## Script layout (clasp)

| File | Role |
|------|------|
| `Config.js` | `CONFIG`, emails, indices, headers, `DEADLINE`; secrets from Script Properties |
| `Main.js` | `onFormSubmit`, `createTriggers` |
| `Utils.js` | Week parsing, Friday deadline, lateness |
| `DriveService.js` | Master folder, move/rename/PDF, Drive file ID from URL |
| `SheetService.js` | Weekly tabs and row logging |
| `FormService.js` | Sync teacher dropdown from Staff Roster |
| `AiService.js` | OCR + Gemini audit |
| `EmailService.js` | Receipts, late alerts, Friday report |
| `TelegramService.js` | Audit alerts to VP/HOD |
| `appsscript.json` | Runtime V8, timezone (`Africa/Abidjan`, GMT) |

## Secrets (required): Script Properties

In the Apps Script editor: **Project Settings** (gear) → **Script Properties** → add:

- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `CHAT_ID_VP`
- `CHAT_ID_LOWER_HOD`
- `CHAT_ID_UPPER_HOD`

Never commit these values to GitHub.

## Behaviour notes

- **Deadline:** Friday 23:59:59 script timezone, computed from the week-range string (`CONFIG.DEADLINE` + `calculateFridayDeadline`).
- **Friday report:** Lateness is recomputed from each row’s timestamp and week string (not read from weekly tabs).
- **Drive links:** If the configured upload column is empty or lacks a URL, `onFormSubmit` scans all response cells for the first `drive.google.com` string (handles reordered form questions). File IDs are parsed with a regex so `/file/d/…` and `open?id=…` style URLs both work.

## Drive permissions

Uploads from Google Forms live in the Form’s linked **responses folder**, owned by the Form creator. The Apps Script runs as a specific Google account (the project owner or execution identity).

- Open the **Google Form** → **Responses** → use the folder icon to open the linked Drive folder for file uploads.
- **Share** that folder with the account that runs the script (**Editor**), or use an organization-wide rule your school allows for testing.
- Ensure that account can still access files **after** they are moved into `CONFIG.MASTER_FOLDER_NAME`. If the master folder is restricted to VP/HOD only, add the script runner as **Editor** on that folder (or run the automation as an account that owns both the Form-linked folder and the destination folder).

Without this, `DriveApp.getFileById` may fail with permission errors and the AI audit will skip when `fileId` is null.

## Triggers

Run `createTriggers()` once from the editor to register form-submit and Friday time-based triggers.
