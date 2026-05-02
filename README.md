# St. Adelaide Lesson Plan Automation

An enterprise-grade Google Apps Script (GAS) system designed to automate the lesson plan intake, filing, and auditing lifecycle for St. Adelaide International Schools. This system leverages AI to ensure academic continuity and provides leadership with real-time oversight via Telegram.

## 🚀 Features

- **Automated Filing & Conversion:** Automatically organizes submissions into a chronological folder structure on Google Drive. Converts Microsoft Word (`.docx`) files to PDF using a Google Doc "bridge" to ensure 100% formatting stability.
- **AI Academic Audits:** Integrates **Gemini 1.5 Pro** to perform automated audits. The AI evaluates plans against Cambridge standards (e.g., TWM in Math, Science in Context) and checks for **Subject Continuity** between weeks.
- **Leadership Oversight (Telegram):** Sends real-time audit reports to HODs and the VP via Telegram. Features interactive buttons for immediate "Approval" or "Revision Request" directly from the chat.
- **Lateness & Missing Reports:** Automatically recomputes lateness based on a Friday 23:59:59 deadline and generates a "Friday Late Report" identifying defaulters and late submissions.
- **Teacher Nudges:** Provides an interface for leadership to send "Urgent Nudge" emails to teachers with a single click.
- **Self-Healing Permissions:** Automatically manages Drive and Spreadsheet permissions for the leadership team.

## 🛠️ Tech Stack

- **Language:** JavaScript (Google Apps Script - V8 Runtime)
- **AI:** Google Gemini API (Generative AI)
- **Messaging:** Telegram Bot API (Webhooks)
- **Storage:** Google Drive API & Google Sheets
- **Deployment:** `clasp` (Command Line Apps Script Projects)

## 📂 Project Structure

| File | Description |
|------|-------------|
| `Main.js` | Core orchestration logic and trigger handlers. |
| `AiService.js` | OCR extraction and Gemini AI audit logic. |
| `DriveService.js` | File organization, renaming, and Word-to-PDF conversion. |
| `TelegramService.js` | Webhook handling and interactive bot messaging. |
| `SheetService.js` | Weekly tab management and data routing. |
| `EmailService.js` | Automated receipts, alerts, and Friday reports. |
| `FormService.js` | Staff roster synchronization with Google Forms. |
| `Config.js` | Centralized configuration and secret retrieval. |
| `Utils.js` | Date parsing, deadline calculations, and string helpers. |

## ⚙️ Setup

1. **Environment:** Use `clasp` to manage the project locally.
2. **Secrets:** Configure the following in **Script Properties** (Apps Script Project Settings):
   - `GEMINI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `CHAT_ID_VP`, `CHAT_ID_LOWER_HOD`, `CHAT_ID_UPPER_HOD`
   - `WEBHOOK_SECRET` (For Telegram security)
3. **Advanced Services:** Ensure **Drive API v3** is enabled in the Apps Script editor.
4. **Triggers:** Run `createTriggers()` once from `Main.js` to initialize the automation.

---
*Note: This README is excluded from Apps Script via `.claspignore` and is intended for repository documentation only.*
