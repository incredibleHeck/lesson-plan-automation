/**
 * Main Controller: Orchestrates the submission lifecycle
 */

/**
 * TRIGGER: Runs on Form Submit
 */
function onFormSubmit(e) {
  if (!e) return;
  
  const responses = e.values; 
  
  // 1. Data Extraction (DD/MM/YYYY from form/sheet)
  const timestamp = parseGhanaianDate(responses[CONFIG.FORM_INDICES.TIMESTAMP]);
  const fullWeekString = responses[CONFIG.FORM_INDICES.WEEK_STARTING]; 
  const hodName = responses[CONFIG.FORM_INDICES.HOD];
  const teacherName = responses[CONFIG.FORM_INDICES.TEACHER_NAME];
  const className = responses[CONFIG.FORM_INDICES.CLASS];
  const subjectName = responses[CONFIG.FORM_INDICES.SUBJECT];

  let fileLink = responses[CONFIG.FORM_INDICES.UPLOAD_LINK];
  if (!fileLink || typeof fileLink !== "string" || !fileLink.includes("drive.google.com")) {
    fileLink = responses.find(function (v) {
      return typeof v === "string" && v.includes("drive.google.com");
    }) || null;
  }
  
  const weekName = extractWeekName(fullWeekString);
  const deadline = calculateFridayDeadline(fullWeekString);
  const daysLate = calculateDaysLate(timestamp, deadline);

  // 2. Immediate HOD Alert if Late (Patched to use CONFIG.HOD_NAMES and HOD_EMAILS)
  if (daysLate > 0) {
    let hodEmail = null;
    if (hodName.includes(CONFIG.HOD_NAMES.LOWER)) {
      hodEmail = CONFIG.HOD_EMAILS.LOWER;
    } else if (hodName.includes(CONFIG.HOD_NAMES.UPPER)) {
      hodEmail = CONFIG.HOD_EMAILS.UPPER;
    }
    
    if (hodEmail) {
      sendLateAlert(hodEmail, teacherName, subjectName, timestamp, deadline, daysLate);
    }
  }

  // 3. Process in Drive (Filing & Renaming)
  try {
    processDriveFile(fileLink, weekName, className, subjectName, teacherName);
  } catch (err) {
    Logger.log("Error processing drive file: " + err.message);
  }

  // 4. Log to sheet with pending placeholder — Gemini audit runs in processPendingAudits (decoupled from this trigger)
  logSubmissionToSheet(responses, weekName, daysLate, CONFIG.AUDIT_PENDING_PLACEHOLDER);

  // 5. Send immediate confirmation receipt to teacher
  sendTeacherReceipt(teacherName, subjectName, className, fullWeekString);
}

/**
 * The Webhook Receiver: Catches incoming messages and button clicks from Telegram.
 * Security Check: Verifies the secret token in the URL (e.g., ?token=YOUR_SECRET)
 */
function doPost(e) {
  // 1. Security Check: Block unauthorized triggers
  if (!e.parameter.token || e.parameter.token !== CONFIG.WEBHOOK_SECRET) {
    Logger.log("Unauthorized webhook access attempt.");
    return HtmlService.createHtmlOutput("Unauthorized");
  }
  
  if (!e || !e.postData || !e.postData.contents) {
    return HtmlService.createHtmlOutput("OK");
  }

  // 2. Initialize the Lock Service to prevent database collisions
  const lock = LockService.getScriptLock();
  
  try {
    // Wait for up to 10 seconds for other instances to finish their database writes
    lock.waitLock(10000); 
  } catch (err) {
    Logger.log("Lock Timeout: Too many simultaneous webhook requests.");
    
    // UI FEEDBACK: Notify the Telegram user that the system is busy
    try {
      const update = JSON.parse(e.postData.contents);
      const chatId = update.callback_query ? update.callback_query.message.chat.id : 
                     (update.message ? update.message.chat.id : null);
      if (chatId) {
        sendTelegramMessage(chatId, "⚠️ <b>System Busy:</b> Too many simultaneous requests. Please wait 3 seconds and try again.");
      }
    } catch (uiErr) {}
    
    return HtmlService.createHtmlOutput("OK"); 
  }

  try {
    const update = JSON.parse(e.postData.contents);

    // Route 1: HOD Button Click
    if (update.callback_query) {
      handleCallbackQuery(update.callback_query);
    }
    // Route 2: VP/HOD Slash Command
    else if (update.message && update.message.text) {
      handleSlashCommand(update.message);
    }
  } catch (err) {
    Logger.log("Webhook Error: " + err.message);
  } finally {
    // ALWAYS release the lock when finished
    lock.releaseLock();
  }

  return HtmlService.createHtmlOutput("OK");
}

/**
 * INITIAL SETUP: Run once from the editor to build all automated schedules
 */
function createTriggers() {
  const ss = SpreadsheetApp.getActive();
  
  // 1. Clean up existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  // 2. CREATE Form Submit Trigger (Instant)
  ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
      
  // 3. CREATE Friday Report Trigger (Every Friday at 4 PM)
  ScriptApp.newTrigger('sendFridayLateReport')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.FRIDAY)
      .atHour(16)
      .create();

  // 4. CREATE Morning Reminders: Wednesday, Thursday, Friday at 8 AM
  [ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY].forEach(day => {
    ScriptApp.newTrigger('sendMorningReminders')
        .timeBased()
        .onWeekDay(day)
        .atHour(8)
        .create();
  });

  // 5. CREATE Recovery Sweeper Trigger (Every hour for API Failures)
  ScriptApp.newTrigger('retryFailedAudits')
      .timeBased()
      .everyHours(1)
      .create();

  // 5b. Pending audit queue: Pro model runs here sequentially, not on form submit
  ScriptApp.newTrigger('processPendingAudits')
      .timeBased()
      .everyMinutes(10)
      .create();

  // 6. NOTE: Form dropdown sync is manual — use menu “HecTech Tools → Sync Form Dropdowns” (onOpen in FormService.js).

  Logger.log("✅ All triggers successfully created by the system!");
}

/**
 * CRON JOB: Finds failed audit cells and resets them to the pending queue.
 * Does not call Gemini here — processPendingAudits handles AI work one row per run.
 */
function retryFailedAudits() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Identify target weeks to scan (Current + Previous)
  const currentWeek = getTargetWeekFromSchedule();
  if (!currentWeek) return;

  const currentWeekNum = parseInt(currentWeek.replace("Week ", ""), 10);
  const sheetsToScan = [ss.getSheetByName(currentWeek)];
  
  if (currentWeekNum > 1) {
    const previousWeek = "Week " + (currentWeekNum - 1);
    const prevSheet = ss.getSheetByName(previousWeek);
    if (prevSheet) sheetsToScan.push(prevSheet);
  }

  // 2. Scan identified sheets
  sheetsToScan.forEach(sheet => {
    if (!sheet) return;
    const sheetName = sheet.getName();

    const data = sheet.getDataRange().getValues();
    const AUDIT_COL = CONFIG.INDICES.AI_AUDIT; 

    for (let i = 1; i < data.length; i++) {
      const auditStatus = data[i][AUDIT_COL] ? data[i][AUDIT_COL].toString() : "";

      // Target rows that failed due to API demand or errors
      if (auditStatus.includes("GEMINI REJECTED") ||
          auditStatus.includes("PENDING API RETRY") ||
          auditStatus.includes("CRITICAL SCRIPT ERROR") ||
          auditStatus.includes("AI Audit Error")) {

        Logger.log(`Found failed audit on sheet '${sheetName}', row ${i + 1}. Resetting to queue...`);

        // Do not call generateAiSummary here (avoids 6-minute timeouts). processPendingAudits
        // picks up CONFIG.AUDIT_PENDING_PLACEHOLDER rows one at a time.
        sheet.getRange(i + 1, AUDIT_COL + 1).setValue(CONFIG.AUDIT_PENDING_PLACEHOLDER);
      }
    }
  });
}

/**
 * Time-driven queue: completes AI audits that were deferred from onFormSubmit.
 * Processes one pending row per run (sequential, avoids Apps Script 6-minute limit with Gemini Pro).
 */
function processPendingAudits() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log("processPendingAudits: lock busy, skipping.");
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const AUDIT_COL = CONFIG.INDICES.AI_AUDIT;
    const pendingMarker = CONFIG.AUDIT_PENDING_PLACEHOLDER;

    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      if (!/^Week \d+$/i.test(sheet.getName())) {
        continue;
      }

      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const auditVal = data[i][AUDIT_COL];
        const auditStr = auditVal != null ? auditVal.toString().trim() : "";
        if (auditStr !== pendingMarker) {
          continue;
        }

        const fileLink = data[i][CONFIG.INDICES.UPLOAD_LINK];
        if (!fileLink) {
          sheet.getRange(i + 1, AUDIT_COL + 1).setValue("⚠️ AI Audit Failed: No upload link on row.");
          continue;
        }

        const timestamp = data[i][CONFIG.INDICES.TIMESTAMP];
        const weekRange = data[i][CONFIG.INDICES.WEEK_STARTING];
        const hodName = data[i][CONFIG.INDICES.HOD];
        const teacherName = data[i][CONFIG.INDICES.TEACHER_NAME];
        const className = data[i][CONFIG.INDICES.CLASS];
        const subjectName = data[i][CONFIG.INDICES.SUBJECT];
        const daysLate = data[i][CONFIG.INDICES.DAYS_LATE];
        const latenessStatus = daysLate > 0 ? `🔴 LATE (${daysLate} days)` : "🟢 ON TIME";

        const resubmissionData = getResubmissionData(teacherName, className, subjectName, weekRange);
        const previousFileId = getPreviousLessonFileId(teacherName, className, subjectName, weekRange);
        const expectedLessons = getExpectedLessonCount(teacherName, className, subjectName);

        let aiAuditText;
        try {
          aiAuditText = generateAiSummary(fileLink, className, subjectName, previousFileId, resubmissionData, expectedLessons);
        } catch (err) {
          Logger.log("processPendingAudits: " + err.message);
          aiAuditText = "⚠️ AI Audit Failed: Please notify the system administrator.";
        }

        updateSheetWithAudit(teacherName, subjectName, sheet.getName(), aiAuditText);

        try {
          const weekMatch = weekRange.toString().match(/Week \d+/i);
          const cleanWeek = weekMatch ? weekMatch[0] : weekRange.toString();
          sendAuditAlert(teacherName, className, subjectName, aiAuditText, hodName, parseGhanaianDate(timestamp), latenessStatus, cleanWeek, resubmissionData.revisionCount);
        } catch (err) {
          Logger.log("processPendingAudits Telegram: " + err.message);
        }

        return;
      }
    }
  } finally {
    lock.releaseLock();
  }
}
