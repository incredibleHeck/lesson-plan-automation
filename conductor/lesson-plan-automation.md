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
- **Drive links:** File IDs are parsed with a regex so `/file/d/…` and `open?id=…` style URLs both work.

## Triggers

Run `createTriggers()` once from the editor to register form-submit and Friday time-based triggers.
