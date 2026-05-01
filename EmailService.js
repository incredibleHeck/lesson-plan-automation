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
 * Scans sheet and emails HODs regarding late submissions (Triggered weekly)
 */
function sendFridayLateReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Form responses 1"); 
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const reports = {};
  
  for (let hod in CONFIG.HOD_EMAILS) {
    reports[hod] = [];
  }

  for (let i = 1; i < data.length; i++) {
    const hodSelection = data[i][CONFIG.INDICES.HOD];
    const teacher = data[i][CONFIG.INDICES.TEACHER_NAME];
    const classLevel = data[i][CONFIG.INDICES.CLASS];
    const daysLate = data[i][CONFIG.COLUMNS.DAYS_LATE - 1]; 

    if (daysLate > 0) {
      const entry = `- ${teacher} (${classLevel}): ${daysLate} day(s) late.`;
      for (let hodName in CONFIG.HOD_EMAILS) {
        if (hodSelection.includes(hodName)) {
          reports[hodName].push(entry);
        }
      }
    }
  }

  for (let hod in reports) {
    if (reports[hod].length > 0) {
      // Send to HOD and CC the VP for accountability
      MailApp.sendEmail({
        to: CONFIG.HOD_EMAILS[hod],
        cc: CONFIG.EMAILS.VP_ACADEMICS,
        subject: `Friday Summary: Overdue Lesson Plans (${hod})`,
        body: `Hello ${hod},\n\nThe following teachers currently have overdue lesson plans recorded in the system:\n\n${reports[hod].join("\n")}\n\nPlease review the spreadsheet for details.`
      });
    }
  }
}
