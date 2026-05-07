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
  const teacherEmail = responses[CONFIG.FORM_INDICES.TEACHER_EMAIL];

  let fileLink = responses[CONFIG.FORM_INDICES.UPLOAD_LINK];
  if (!fileLink || typeof fileLink !== "string" || !fileLink.includes("drive.google.com")) {
    fileLink = responses.find(function (v) {
      return typeof v === "string" && v.includes("drive.google.com");
    }) || null;
  }
  
  const weekName = extractWeekName(fullWeekString);
  const deadline = calculateFridayDeadline(fullWeekString);
  const daysLate = calculateDaysLate(timestamp, deadline);
  const latenessStatus = daysLate > 0 ? `🔴 LATE (${daysLate} days)` : "🟢 ON TIME";

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
  let fileId = null;
  try {
    fileId = processDriveFile(fileLink, weekName, className, subjectName, teacherName);
  } catch (err) {
    Logger.log("Error processing drive file: " + err.message);
  }

  // 4. TIME-TRAVEL: GET PREVIOUS WEEK'S FILE
  const previousFileId = getPreviousLessonFileId(teacherName, className, subjectName, fullWeekString);

  const resubmissionData = getResubmissionData(teacherName, className, subjectName, fullWeekString);

  const expectedLessons = getExpectedLessonCount(teacherName, className, subjectName);

  // 5. GENERATE AUDIT (NOW WITH CONTINUITY!)
  const aiAuditText = generateAiSummary(fileId, className, subjectName, previousFileId, resubmissionData, expectedLessons);

  // 6. Log to Sheet (Routing & Highlighting)
  logSubmissionToSheet(responses, weekName, daysLate, aiAuditText);

  // 7. Blast the audit report to Telegram!
  try {
    const weekMatch = fullWeekString.match(/Week \d+/i);
    const cleanWeek = weekMatch ? weekMatch[0] : fullWeekString;
    sendAuditAlert(teacherName, className, subjectName, aiAuditText, hodName, timestamp, latenessStatus, cleanWeek, resubmissionData.revisionCount);
  } catch (err) {
    Logger.log("Error sending Telegram alert: " + err.message);
  }

  // 8. Send Confirmation Receipt to Teacher
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

  // 6. CREATE Automatic Roster Sync (Runs whenever the sheet is edited)
  ScriptApp.newTrigger('syncRosterToForm')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
      
  Logger.log("✅ All triggers successfully created by the system!");
}

/**
 * CRON JOB: Sweeps the weekly tabs for API failures and attempts to re-audit them.
 */
function retryFailedAudits() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    // Only process sheets named "Week 1", "Week 2", etc.
    if (!sheetName.startsWith("Week ")) return;

    const data = sheet.getDataRange().getValues();
    const AUDIT_COL = CONFIG.INDICES.AI_AUDIT; 

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const auditStatus = row[AUDIT_COL] ? row[AUDIT_COL].toString() : "";

      // Target rows that failed due to API demand or errors
      if (auditStatus.includes("GEMINI REJECTED") || 
          auditStatus.includes("PENDING API RETRY") || 
          auditStatus.includes("CRITICAL SCRIPT ERROR")) {
        
        Logger.log(`Found failed audit on sheet '${sheetName}', row ${i + 1}. Attempting retry...`);

        const timestamp = row[CONFIG.INDICES.TIMESTAMP];
        const weekRange = row[CONFIG.INDICES.WEEK_STARTING];
        const hodName = row[CONFIG.INDICES.HOD];
        const teacherName = row[CONFIG.INDICES.TEACHER_NAME];
        const className = row[CONFIG.INDICES.CLASS];
        const subjectName = row[CONFIG.INDICES.SUBJECT];
        const fileLink = row[CONFIG.INDICES.UPLOAD_LINK];
        const daysLate = row[CONFIG.INDICES.DAYS_LATE];
        const latenessStatus = daysLate > 0 ? `🔴 LATE (${daysLate} days)` : "🟢 ON TIME";

        // Extract fileId from the Drive link
        const fileIdMatch = fileLink ? fileLink.match(/[-\w]{25,}/) : null;
        const fileId = fileIdMatch ? fileIdMatch[0] : null;

        if (fileId) {
          // Re-calculate resubmission and continuity context
          const resubmissionData = getResubmissionData(teacherName, className, subjectName, weekRange);
          const previousFileId = getPreviousLessonFileId(teacherName, className, subjectName, weekRange);
          const expectedLessons = getExpectedLessonCount(teacherName, className, subjectName);

          // Retry the AI Audit
          const newAudit = generateAiSummary(fileId, className, subjectName, previousFileId, resubmissionData, expectedLessons);
          
          // If successful (not a pending retry), update the sheet and alert Telegram
          if (newAudit && !newAudit.includes("PENDING API RETRY")) {
            sheet.getRange(i + 1, AUDIT_COL + 1).setValue(newAudit);
            
            try {
              sendAuditAlert(teacherName, className, subjectName, newAudit, hodName, parseGhanaianDate(timestamp), latenessStatus, sheetName, resubmissionData.revisionCount);
            } catch (err) {
              Logger.log("Error sending Telegram alert during retry: " + err.message);
            }
          }
        }
      }
    }
  });
}
