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
    cc: CONFIG.HOD_EMAILS.VP, // notify VP of immediate late submissions
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
  
  // 2. Get the Staff Roster Data (Fixed Tab Name)
  const rosterSheet = ss.getSheetByName("Staff Roster");
  if (!rosterSheet) {
    Logger.log("Error: Could not find the 'Staff Roster' tab.");
    return;
  }
  const rosterData = rosterSheet.getDataRange().getValues();

  // Fix: Calculate targetWeek by finding the most common week in the last 15 submissions
  // rather than just blindly trusting the absolute last row.
  const recentRows = data.slice(-15);
  const weekCounts = {};
  let targetWeek = "";
  let maxCount = 0;

  recentRows.forEach(row => {
    const week = row[CONFIG.FORM_INDICES.WEEK_STARTING];
    if (week) {
      weekCounts[week] = (weekCounts[week] || 0) + 1;
      if (weekCounts[week] > maxCount) {
        maxCount = weekCounts[week];
        targetWeek = week;
      }
    }
  });

  if (!targetWeek) {
    Logger.log("Error: Could not determine target week for Friday report.");
    return;
  }

  let submittedTeachers = [];
  let primaryReport = [];
  let secondaryReport = [];

  // 1. Scan submissions for LATE and identifying who submitted
  for (let i = 1; i < data.length; i++) {
    const timestampStr = data[i][CONFIG.FORM_INDICES.TIMESTAMP];
    if (!timestampStr) continue; // Skip empty rows

    const weekString = data[i][CONFIG.FORM_INDICES.WEEK_STARTING];
    const teacher = data[i][CONFIG.FORM_INDICES.TEACHER_NAME];
    const classLevel = data[i][CONFIG.FORM_INDICES.CLASS];
    const hodSelection = data[i][CONFIG.FORM_INDICES.HOD];

    const timestamp = parseGhanaianDate(timestampStr);

    if (weekString === targetWeek) {
      submittedTeachers.push(teacher);

      const deadline = calculateFridayDeadline(weekString);
      const daysLate = calculateDaysLate(timestamp, deadline);

      // LATE CHECK: Ensure we only flag late submissions for the CURRENT week!
      if (daysLate > 0) {
        const entry = `⚠️ LATE: ${teacher} (${classLevel}): ${daysLate} day(s) late.`;
        
        if (hodSelection.includes(CONFIG.HOD_NAMES.LOWER)) {
          primaryReport.push(entry);
        } else if (hodSelection.includes(CONFIG.HOD_NAMES.UPPER)) {
          secondaryReport.push(entry);
        }
      }
    }
  }

  // 2. Ghost Tracker: Scan roster for MISSING (Fixed Column Mapping)
  for (let i = 1; i < rosterData.length; i++) {
    const rosterTeacher = rosterData[i][0]; // Col A: Teacher Name
    const department = rosterData[i][1] ? rosterData[i][1].toString().toLowerCase() : ""; // Col B: Department

    if (rosterTeacher && !submittedTeachers.includes(rosterTeacher)) {
      const entry = `❌ MISSING: ${rosterTeacher} (No submission for ${extractWeekName(targetWeek)})`;
      
      // Route based on department string
      if (department.includes("upper") || department.includes("secondary")) {
        secondaryReport.push(entry);
      } else {
        primaryReport.push(entry);
      }
    }
  }

  // 3. Send Emails (CC'ing VP Theodora Hammond)
  if (primaryReport.length > 0) {
    MailApp.sendEmail({
      to: CONFIG.HOD_EMAILS.LOWER,
      cc: CONFIG.HOD_EMAILS.VP,
      subject: `Friday Report: Late & Missing Plans (Lower Primary)`,
      body: `Hello Mr. Ashia,\n\nHere is the status report for ${targetWeek}:\n\n` + primaryReport.join("\n") + `\n\nPlease check the spreadsheet for details.`
    });
  }

  if (secondaryReport.length > 0) {
    MailApp.sendEmail({
      to: CONFIG.HOD_EMAILS.UPPER,
      cc: CONFIG.HOD_EMAILS.VP,
      subject: `Friday Report: Late & Missing Plans (Upper/Secondary)`,
      body: `Hello Mrs. Sackey,\n\nHere is the status report for ${targetWeek}:\n\n` + secondaryReport.join("\n") + `\n\nPlease check the spreadsheet for details.`
    });
  }
}

/**
 * Sends a nudge email to a teacher regarding a missing lesson plan.
 */
function sendNudgeEmail(teacherEmail, teacherName, weekName, hodEmail) {
  const subject = `URGENT: Lesson Plan Submission for ${weekName}`;
  const body = `Dear ${teacherName},\n\nThis is a courtesy reminder from the St. Adelaide Ops Bot. Our records indicate that your lesson plan for ${weekName} has not been received yet.\n\nPlease submit it at your earliest convenience to avoid further delays.\n\nThank you.`;
  
  MailApp.sendEmail({
    to: teacherEmail,
    cc: hodEmail, // Copy the HOD on the nudge
    subject: subject,
    body: body
  });
}

/**
 * Sends a revision request email to the teacher.
 */
function sendRevisionEmail(teacherEmail, teacherName, weekName, auditResult) {
  if (!teacherEmail) return;

  const subject = `ACTION REQUIRED: Lesson Plan Revision (${weekName})`;
  const body = `Dear ${teacherName},\n\n` +
               `Your HOD has reviewed your lesson plan for ${weekName} and requested a revision.\n\n` +
               `AI AUDIT SUMMARY:\n${auditResult}\n\n` +
               `Please update your lesson plan on Google Drive and inform your HOD once the changes are made.\n\n` +
               `Thank you,\nSt. Adelaide Academic Office`;
  
  MailApp.sendEmail({
    to: teacherEmail,
    cc: CONFIG.HOD_EMAILS.VP, // Oversight for the VP
    subject: subject,
    body: body
  });
}
