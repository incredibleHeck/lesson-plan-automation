/**
 * Services for Email communications
 */

/**
 * Sends a confirmation receipt to the submitting teacher by checking the live roster.
 */
function sendTeacherReceipt(teacherName, subjectName, className, fullWeekString) {
  const roster = getDynamicTeacherRoster();
  const teacherInfo = roster[teacherName];

  if (!teacherInfo || !teacherInfo.email) {
    Logger.log(`⚠️ Skipping receipt: No email found in Staff Roster for ${teacherName}`);
    return;
  }

  const weekName = extractWeekName(fullWeekString);
  const body = `Hello ${teacherName},\n\nYour ${subjectName} lesson plan for ${className} has been successfully received and filed for ${fullWeekString}.\n\nThank you!`;
  
  MailApp.sendEmail({
    to: teacherInfo.email,
    subject: `Success: Lesson Plan Received for ${weekName}`,
    body: body,
    name: "St. Adelaide Academic Office",
    replyTo: CONFIG.HOD_EMAILS.VP
  });
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
  
  // 1. Determine target week autonomously from the Term Schedule
  const targetWeek = getTargetWeekFromSchedule();

  if (!targetWeek) {
    Logger.log("Friday Report Aborted: Could not resolve a valid Target Week from the Term Schedule.");
    return;
  }

  // 2. Get the Submission Data
  const rawSheet = ss.getSheetByName("Form responses 1"); 
  if (!rawSheet) return;
  const data = rawSheet.getDataRange().getValues();

  let primaryReport = [];
  let secondaryReport = [];

  // 1. Scan submissions and build a Set of what WAS submitted
  const submittedSet = new Set();

  for (let i = 1; i < data.length; i++) {
    const timestampStr = data[i][CONFIG.FORM_INDICES.TIMESTAMP];
    if (!timestampStr) continue; // Skip empty rows

    const weekString = data[i][CONFIG.FORM_INDICES.WEEK_STARTING];

    if (weekString === targetWeek) {
      const teacher = data[i][CONFIG.FORM_INDICES.TEACHER_NAME].toString().trim();
      const classLevel = data[i][CONFIG.FORM_INDICES.CLASS].toString().trim();
      const subject = data[i][CONFIG.FORM_INDICES.SUBJECT].toString().trim();

      // Create a normalized unique key for the submission
      const subKey = `${teacher}_${classLevel}_${subject}`.toLowerCase().replace(/\s+/g, "");
      submittedSet.add(subKey);

      // Keep the Lateness check for what WAS submitted
      const timestamp = parseGhanaianDate(timestampStr);
      const deadline = calculateFridayDeadline(weekString);
      const daysLate = calculateDaysLate(timestamp, deadline);

      if (daysLate > 0) {
        const hodSelection = data[i][CONFIG.FORM_INDICES.HOD];
        const entry = `⚠️ LATE: ${teacher} (${classLevel} - ${subject}): ${daysLate} day(s) late.`;

        if (hodSelection.includes(CONFIG.HOD_NAMES.LOWER)) {
          primaryReport.push(entry);
        } else if (hodSelection.includes(CONFIG.HOD_NAMES.UPPER)) {
          secondaryReport.push(entry);
        }
      }
    }
  }

  // 2. The New Ghost Tracker: Cross-reference with Teaching Load Matrix
  const teachingLoad = getTeachingLoad(); // From SheetService.js
  const staffRoster = getDynamicTeacherRoster(); // From SheetService.js

  teachingLoad.forEach(load => {
    // Skip empty/placeholder rows in the teaching load matrix
    if (!load.className || !load.subjectName) return;

    // Generate the exact same normalized key pattern
    const loadKey = `${load.teacherName}_${load.className}_${load.subjectName}`.toLowerCase().replace(/\s+/g, "");

    // If the required load key is NOT in the submitted set, it's missing!
    if (!submittedSet.has(loadKey)) {
      const entry = `❌ MISSING: ${load.teacherName} - ${load.subjectName} (${load.className})`;

      // Route to correct HOD using the Staff Roster department mapping
      const teacherInfo = staffRoster[load.teacherName];
      if (teacherInfo && teacherInfo.hodEmail === CONFIG.HOD_EMAILS.UPPER) {
        secondaryReport.push(entry);
      } else {
        primaryReport.push(entry); // Default to Lower if unmapped
      }
    }
  });

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
 * Sends a nudge email to a teacher and copies their specific HOD automatically.
 */
function sendNudgeEmail(teacherName, weekName) {
  const roster = getDynamicTeacherRoster();
  const teacherInfo = roster[teacherName];

  if (!teacherInfo || !teacherInfo.email) {
    Logger.log(`⚠️ Cannot send nudge: No email found for ${teacherName}`);
    return;
  }

  const subject = `Pending: Lesson Plan Submission - ${weekName}`;
  const body = `Dear ${teacherName},\n\nThis is an automated notification from the Academic Office.\n\nOur records indicate that your lesson plan for ${weekName} has not been received yet. Please submit it at your earliest convenience to ensure pedagogical continuity.\n\nThank you,\nSt. Adelaide Ops Bot`;
  
  MailApp.sendEmail({
    to: teacherInfo.email,
    cc: teacherInfo.hodEmail, // Automatically routes to their specific Dept Head
    subject: subject,
    body: body,
    name: "St. Adelaide Academic Office",
    replyTo: teacherInfo.hodEmail // Forces replies to go directly to the teacher's specific HOD
  });
}

/**
 * Sends a revision request email to the teacher.
 */
function sendRevisionEmail(teacherName, weekName, auditResult) {
  const roster = getDynamicTeacherRoster();
  const teacherInfo = roster[teacherName];

  if (!teacherInfo || !teacherInfo.email) {
    Logger.log(`⚠️ Cannot send revision request: No email found for ${teacherName}`);
    return;
  }

  const subject = `Update Requested: Lesson Plan - ${weekName}`;
  const body = `Dear ${teacherName},\n\nYour Head of Department has reviewed your lesson plan for ${weekName} and requested a brief revision.\n\nAI Audit Summary:\n${auditResult}\n\nPlease update your document on Google Drive and notify your HOD once complete.\n\nThank you,\nSt. Adelaide Academic Office`;
  
  MailApp.sendEmail({
    to: teacherInfo.email,
    cc: CONFIG.HOD_EMAILS.VP, // Oversight for the VP
    subject: subject,
    body: body,
    name: "St. Adelaide Academic Office",
    replyTo: teacherInfo.hodEmail // Forces replies to go directly to the teacher's specific HOD
  });
}

/**
 * CRON JOB: Automatically emails teachers who have missing deliverables for the active week.
 */
function sendMorningReminders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName("Form responses 1"); 
  if (!rawSheet) return;
  
  const data = rawSheet.getDataRange().getValues();
  
  // 1. Determine target week autonomously from the Term Schedule
  const targetWeek = getTargetWeekFromSchedule();
  
  if (!targetWeek || !targetWeek.toLowerCase().includes("week")) {
    Logger.log("Cron Job Aborted: Could not resolve a valid Target Week from the Term Schedule.");
    return; 
  }

  // 2. Build a Map of what WAS submitted and count detected lessons
  let submittedMap = new Map();
  for (let i = 1; i < data.length; i++) {
    const weekString = data[i][CONFIG.FORM_INDICES.WEEK_STARTING];
    if (weekString === targetWeek) {
      const teacher = data[i][CONFIG.FORM_INDICES.TEACHER_NAME].toString().trim();
      const classLevel = data[i][CONFIG.FORM_INDICES.CLASS].toString().trim();
      const subject = data[i][CONFIG.FORM_INDICES.SUBJECT].toString().trim();
      const auditText = data[i][CONFIG.FORM_INDICES.AI_AUDIT] ? data[i][CONFIG.FORM_INDICES.AI_AUDIT].toString() : "";

      const subKey = `${teacher}_${classLevel}_${subject}`.toLowerCase().replace(/\s+/g, "");

      let foundLessons = submittedMap.has(subKey) ? submittedMap.get(subKey) : 0;
      let currentFound = 0;

      // Advanced fraction extraction to handle "2 Plans (4 Periods) / 4 Lessons" scenarios
      const match = auditText.match(/LESSONS DETECTED:\s*(.*?)\//i);

      if (match) {
        const leftSide = match[1].toUpperCase();

        if (leftSide.includes("PERIOD") || leftSide.includes("LESSON")) {
          const periodMatch = leftSide.match(/(\d+)\s*(?:PERIOD|LESSON)/);
          if (periodMatch) {
            currentFound = parseInt(periodMatch[1], 10);
          } else {
            const numMatch = leftSide.match(/(\d+)/);
            if (numMatch) currentFound = parseInt(numMatch[1], 10);
          }
        } else {
          const numMatch = leftSide.match(/(\d+)/);
          if (numMatch) {
            currentFound = parseInt(numMatch[1], 10);
          }
        }
      } else if (auditText.length > 10 && !auditText.includes("EXTRACTION ERROR") && !auditText.includes("Skipped")) {
        currentFound = 1;
      }

      // Add lessons together to support multiple submissions
      submittedMap.set(subKey, foundLessons + currentFound);
    }
  }

  // 3. Cross-reference with the Teaching Load Matrix to group missing items
  const teachingLoad = getTeachingLoad();
  let missingByTeacher = {};

  teachingLoad.forEach(load => {
    if (!load.className || !load.subjectName) return;
    const loadKey = `${load.teacherName}_${load.className}_${load.subjectName}`.toLowerCase().replace(/\s+/g, "");
    
    const expectedLessons = load.expectedLessons || 1;
    const foundLessons = submittedMap.has(loadKey) ? submittedMap.get(loadKey) : 0;

    if (foundLessons < expectedLessons) {
      if (!missingByTeacher[load.teacherName]) {
        missingByTeacher[load.teacherName] = [];
      }
      
      if (foundLessons === 0) {
        missingByTeacher[load.teacherName].push(`   ❌ ${load.subjectName} (${load.className})`);
      } else {
        missingByTeacher[load.teacherName].push(`   ⚠️ ${load.subjectName} (${load.className}) - Partial: ${foundLessons}/${expectedLessons} done`);
      }
    }
  });

  // 4. Send the personalized email to each defaulter with API pacing
  const roster = getDynamicTeacherRoster();

  Object.keys(missingByTeacher).forEach(teacher => {
    const teacherInfo = roster[teacher];
    if (teacherInfo && teacherInfo.email) {
      const missingItemsList = missingByTeacher[teacher].join("\n");

      const subject = `Action Required: Missing Lesson Plans - ${targetWeek}`;
      const body = `Dear ${teacher},\n\nThis is an automated morning reminder from the Academic Office.\n\nOur records show that you have not yet submitted the following expected lesson plans for ${targetWeek}:\n\n${missingItemsList}\n\nPlease submit these deliverables to the HecTech portal at your earliest convenience to ensure pedagogical continuity.\n\nThank you,\nSt. Adelaide Ops Bot`;

      MailApp.sendEmail({
        to: teacherInfo.email,
        cc: teacherInfo.hodEmail,
        subject: subject,
        body: body,
        name: "St. Adelaide Academic Office",
        replyTo: teacherInfo.hodEmail
      });

      // API SAFEGUARD: Throttle to prevent "Service invoked too many times" quota errors
      Utilities.sleep(1500);
    }
  });
}
