/**
 * Main Controller: Orchestrates the submission lifecycle
 */

/**
 * TRIGGER: Runs on Form Submit
 */
function onFormSubmit(e) {
  if (!e) return;
  
  const responses = e.values; 
  
  // 1. Data Extraction
  const timestamp = new Date(responses[CONFIG.INDICES.TIMESTAMP]); 
  const fullWeekString = responses[CONFIG.INDICES.WEEK_STARTING]; 
  const hodName = responses[CONFIG.INDICES.HOD];
  const teacherName = responses[CONFIG.INDICES.TEACHER_NAME];
  const className = responses[CONFIG.INDICES.CLASS];
  const subjectName = responses[CONFIG.INDICES.SUBJECT];
  const fileLink = responses[CONFIG.INDICES.UPLOAD_LINK]; 
  const teacherEmail = responses[CONFIG.INDICES.TEACHER_EMAIL];
  
  const weekName = extractWeekName(fullWeekString);
  const deadline = calculateFridayDeadline(fullWeekString);
  const daysLate = calculateDaysLate(timestamp, deadline);

  // 2. Immediate HOD Alert if Late
  if (daysLate > 0) {
    const hodEmail = getHodEmail(hodName);
    if (hodEmail) {
      sendLateAlert(hodEmail, teacherName, subjectName, timestamp, deadline, daysLate);
    }
  }

  // 3. Log to Sheet (Routing & Highlighting)
  logSubmissionToSheet(responses, weekName, daysLate);

  // 4. Process in Drive (Filing & Renaming)
  try {
    processDriveFile(fileLink, weekName, className, subjectName, teacherName);
  } catch (err) {
    Logger.log("Error processing drive file: " + err.message);
  }

  // 5. Send Confirmation Receipt to Teacher
  sendTeacherReceipt(teacherEmail, teacherName, subjectName, className, fullWeekString);
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
