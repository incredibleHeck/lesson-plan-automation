/**
 * Main Controller: Orchestrates the submission lifecycle
 */

/**
 * TRIGGER: Runs on Form Submit
 */
function onFormSubmit(e) {
  if (!e) return;
  
  const responses = e.values; 
  
  // 1. Data Extraction (DD/MM/YYYY from form/sheet — avoid US MDY mis-parse)
  const timestamp = parseGhanaianDate(responses[CONFIG.INDICES.TIMESTAMP]);
  const fullWeekString = responses[CONFIG.INDICES.WEEK_STARTING]; 
  const hodName = responses[CONFIG.INDICES.HOD];
  const teacherName = responses[CONFIG.INDICES.TEACHER_NAME];
  const className = responses[CONFIG.INDICES.CLASS];
  const subjectName = responses[CONFIG.INDICES.SUBJECT];
  const teacherEmail = responses[CONFIG.INDICES.TEACHER_EMAIL];

  let fileLink = responses[CONFIG.INDICES.UPLOAD_LINK];
  if (!fileLink || typeof fileLink !== "string" || !fileLink.includes("drive.google.com")) {
    fileLink = responses.find(function (v) {
      return typeof v === "string" && v.includes("drive.google.com");
    }) || null;
  }
  
  const weekName = extractWeekName(fullWeekString);
  const deadline = calculateFridayDeadline(fullWeekString);
  const daysLate = calculateDaysLate(timestamp, deadline);
  const latenessStatus = daysLate > 0 ? `🔴 LATE (${daysLate} days)` : "🟢 ON TIME";

  // 2. Immediate HOD Alert if Late (Updated Routing Logic)
  if (daysLate > 0) {
    let hodEmail = null;
    if (hodName.includes("Alfred Ashia")) {
      hodEmail = CONFIG.EMAILS.HOD_LOWER_PRIMARY;
    } else if (hodName.includes("Abigail Sackey")) {
      hodEmail = CONFIG.EMAILS.HOD_UPPER_SECONDARY;
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

  // 4. Log to Sheet (Routing & Highlighting) with AI Audit 
  const aiAuditText = generateAiSummary(fileId, className, subjectName);
  logSubmissionToSheet(responses, weekName, daysLate, aiAuditText);

  // 5. Blast the audit report to Telegram!
  try {
    const weekMatch = fullWeekString.match(/Week \d+/i);
    const cleanWeek = weekMatch ? weekMatch[0] : fullWeekString;
    sendAuditAlert(teacherName, className, subjectName, aiAuditText, hodName, timestamp, latenessStatus, cleanWeek);
  } catch (err) {
    Logger.log("Error sending Telegram alert: " + err.message);
  }

  // 6. Send Confirmation Receipt to Teacher
  sendTeacherReceipt(teacherEmail, teacherName, subjectName, className, fullWeekString);
}

/**
 * The Webhook Receiver: Catches incoming messages and button clicks from Telegram.
 */
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return HtmlService.createHtmlOutput("OK");
  }

  const update = JSON.parse(e.postData.contents);

  try {
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
