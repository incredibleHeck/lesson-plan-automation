/**
 * Services for Email communications
 */

/**
 * Sends a confirmation receipt to the submitting teacher
 */
function sendTeacherReceipt(teacherEmail, teacherName, subjectName, className, fullWeekString) {
  if (teacherEmail) {
    const weekName = extractWeekName(fullWeekString);
    const body = `Hello ${teacherName},\n\nYour ${subjectName} lesson plan for ${className} has been successfully received and filed for ${fullWeekString}.\n\nThank you!`;
    MailApp.sendEmail({
      to: teacherEmail,
      subject: `Success: Lesson Plan Received for ${weekName}`,
      body: body
    });
  }
}

/**
 * Immediate alert to HOD for late submission
 */
function sendLateAlert(email, teacher, subject, submittedAt, deadline, daysLate) {
  const subjectLine = `LATE Submission Alert: ${teacher} (${daysLate} days late)`;
  const body = `Dear HOD,\n\nThis is an automated alert for a late lesson plan submission:\n\nTeacher: ${teacher}\nSubject: ${subject}\nDays Late: ${daysLate}\nSubmitted: ${submittedAt.toLocaleString()}\nDeadline: ${deadline.toLocaleString()}\n\nThe file has been organized into the weekly folder.`;
  MailApp.sendEmail({
    to: email,
    cc: CONFIG.EMAILS.VP_ACADEMICS, // Also notify VP of immediate late submissions
    subject: subjectLine,
    body: body
  });
}

/**
 * TRIGGERED EVENT: Scans sheet and emails HODs regarding LATE and MISSING submissions.
 */
function sendFridayLateReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get the Submission Data
  const rawSheet = ss.getSheetByName("Form responses 1"); 
  if (!rawSheet) return;
  const data = rawSheet.getDataRange().getValues();
  
  // 2. Get the Staff Roster Data
  const rosterSheet = ss.getSheetByName("Staff Roster");
  if (!rosterSheet) {
    Logger.log("Error: Please create a 'Staff Roster' tab.");
    return;
  }
  const rosterData = rosterSheet.getDataRange().getValues();

  // Find target week from the most recent submission
  const latestRow = data[data.length - 1];
  const targetWeek = latestRow[CONFIG.INDICES.WEEK_STARTING];

  let submittedTeachers = [];
  let primaryReport = [];
  let secondaryReport = [];

  // 1. Scan submissions for LATE and identifying who submitted
  for (let i = 1; i < data.length; i++) {
    const weekString = data[i][CONFIG.INDICES.WEEK_STARTING];
    const teacher = data[i][CONFIG.INDICES.TEACHER_NAME];
    const classLevel = data[i][CONFIG.INDICES.CLASS];
    const daysLate = data[i][CONFIG.COLUMNS.DAYS_LATE - 1]; 
    const hodSelection = data[i][CONFIG.INDICES.HOD];

    // Only count them as submitted if it's for the current target week
    if (weekString === targetWeek) {
      submittedTeachers.push(teacher);
    }

    // LATE CHECK: Ensure we only flag late submissions for the CURRENT week!
    if (daysLate > 0 && weekString === targetWeek) {
      const entry = `⚠️ LATE: ${teacher} (${classLevel}): ${daysLate} day(s) late.`;
      
      if (hodSelection.includes("Alfred Ashia")) {
        primaryReport.push(entry);
      } else if (hodSelection.includes("Abigail Sackey")) {
        secondaryReport.push(entry);
      }
    }
  }

  // 2. Ghost Tracker: Scan roster for MISSING
  for (let i = 1; i < rosterData.length; i++) {
    const rosterTeacher = rosterData[i][0]; // Col A: Teacher Name
    const rosterDept = rosterData[i][1];    // Col B: Department

    if (rosterTeacher && !submittedTeachers.includes(rosterTeacher)) {
      const entry = `❌ MISSING: ${rosterTeacher} (No submission for ${extractWeekName(targetWeek)})`;
      
      // Route missing teachers based on department in roster
      if (rosterDept === "Lower Primary") {
        primaryReport.push(entry);
      } else if (rosterDept === "Upper/Secondary") {
        secondaryReport.push(entry);
      }
    }
  }

  // 3. Send Emails (CC'ing VP Theodora Hammond)
  if (primaryReport.length > 0) {
    MailApp.sendEmail({
      to: CONFIG.EMAILS.HOD_LOWER_PRIMARY,
      cc: CONFIG.EMAILS.VP_ACADEMICS,
      subject: `Friday Report: Late & Missing Plans (Lower Primary)`,
      body: `Hello Mr. Ashia,\n\nHere is the status report for ${targetWeek}:\n\n${primaryReport.join("\n")}\n\nPlease check the spreadsheet for details.`
    });
  }

  if (secondaryReport.length > 0) {
    MailApp.sendEmail({
      to: CONFIG.EMAILS.HOD_UPPER_SECONDARY,
      cc: CONFIG.EMAILS.VP_ACADEMICS,
      subject: `Friday Report: Late & Missing Plans (Upper/Secondary)`,
      body: `Hello Mrs. Sackey,\n\nHere is the status report for ${targetWeek}:\n\n${secondaryReport.join("\n")}\n\nPlease check the spreadsheet for details.`
    });
  }
}
