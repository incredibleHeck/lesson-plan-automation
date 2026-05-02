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

  // 5. GENERATE AUDIT (NOW WITH CONTINUITY!)
  const aiAuditText = generateAiSummary(fileId, className, subjectName, previousFileId);

  // 6. Log to Sheet (Routing & Highlighting)
  logSubmissionToSheet(responses, weekName, daysLate, aiAuditText);

  // 7. Blast the audit report to Telegram!
  try {
    const weekMatch = fullWeekString.match(/Week \d+/i);
    const cleanWeek = weekMatch ? weekMatch[0] : fullWeekString;
    sendAuditAlert(teacherName, className, subjectName, aiAuditText, hodName, timestamp, latenessStatus, cleanWeek);
  } catch (err) {
    Logger.log("Error sending Telegram alert: " + err.message);
  }

  // 8. Send Confirmation Receipt to Teacher
  sendTeacherReceipt(teacherEmail, teacherName, subjectName, className, fullWeekString);
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
 * INITIAL SETUP: Run once from the editor
 */
function createTriggers() {
  const ss = SpreadsheetApp.getActive();
  
  // Clean up existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  // Form Submit Trigger
  ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
      
  // Friday Report Trigger (Every Friday at 4 PM)
  ScriptApp.newTrigger('sendFridayLateReport')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.FRIDAY)
      .atHour(16)
      .create();
}
