/**
 * Services for Spreadsheet interactions
 */

/**
 * Routes data to the correct weekly tab and applies lateness formatting
 */
function logSubmissionToSheet(responses, weekName, daysLate, aiAuditText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let weeklySheet = ss.getSheetByName(weekName);
  if (!weeklySheet) {
    weeklySheet = ss.insertSheet(weekName);
    weeklySheet.appendRow(CONFIG.HEADERS); // Use headers directly from Config
    weeklySheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight("bold");
    weeklySheet.setFrozenRows(1);
  }

  const rowData = [
    responses[CONFIG.FORM_INDICES.TIMESTAMP],
    responses[CONFIG.FORM_INDICES.WEEK_STARTING],
    responses[CONFIG.FORM_INDICES.HOD],
    responses[CONFIG.FORM_INDICES.TEACHER_NAME],
    responses[CONFIG.FORM_INDICES.CLASS],
    responses[CONFIG.FORM_INDICES.SUBJECT],
    responses[CONFIG.FORM_INDICES.UPLOAD_LINK],
    "UNREAD", // Default HOD Check
    daysLate,
    aiAuditText || "Audit Pending/Skipped"
  ];
  
  weeklySheet.appendRow(rowData);
  const lastRow = weeklySheet.getLastRow();
  
  // PRO UPGRADE: Add an interactive dropdown to the "HOD Check" column (Column H / 8)
  const hodCheckCell = weeklySheet.getRange(lastRow, CONFIG.STATUS_COLUMN_NUMBER); 
  const validationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["UNREAD", "✅ APPROVED", "🚨 REVISION NEEDED"], true)
    .build();
  hodCheckCell.setDataValidation(validationRule);
  
  // Apply lateness formatting
  if (daysLate > 0) {
    weeklySheet.getRange(lastRow, 1, 1, rowData.length).setBackground("#f4cccc"); // Light Red
  }
}

/**
 * Updates the approval status on the specific Week's sheet and gets the Audit text.
 * Supports partial matching for subject codes (e.g. "ICT" matches "Information and Communication Technology (ICT)")
 */
function updateApprovalStatus(teacherName, subjectCode, sheetName, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName(sheetName); 
  
  if (!targetSheet) {
    Logger.log(`🚨 CRITICAL ERROR: Could not find a tab named '${sheetName}'`);
    return null;
  }

  const data = targetSheet.getDataRange().getValues();
  
  // Loop backwards to find the teacher's MOST RECENT submission FOR THIS SUBJECT
  for (let i = data.length - 1; i >= 1; i--) {
    const sheetTeacher = data[i][CONFIG.INDICES.TEACHER_NAME];
    const sheetSubject = data[i][CONFIG.INDICES.SUBJECT] ? data[i][CONFIG.INDICES.SUBJECT].toString().toUpperCase() : "";

    if (sheetTeacher === teacherName && sheetSubject.includes(subjectCode.toUpperCase())) {
      
      // Update the status column (i + 1 because Sheets are 1-indexed)
      targetSheet.getRange(i + 1, CONFIG.STATUS_COLUMN_NUMBER).setValue(status);
      
      // Look up their email from the live roster!
      const roster = getDynamicTeacherRoster();
      const teacherEmail = roster[teacherName] ? roster[teacherName].email : null;
      
      return {
        email: teacherEmail,
        week: sheetName,
        audit: data[i][CONFIG.INDICES.AI_AUDIT] || "Please review the feedback from your HOD."
      };
    }
  }
  return null;
}

/**
 * Dynamically pulls the master teacher list from the "Staff Roster" sheet.
 * Includes case-insensitive department matching and centralized HOD routing.
 */
function getDynamicTeacherRoster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName("Staff Roster"); 
  
  if (!rosterSheet) {
    Logger.log("Error: Could not find the 'Staff Roster' sheet.");
    return {};
  }

  const data = rosterSheet.getDataRange().getValues();
  const roster = {};

  // Start loop at 1 to skip the header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const teacherName = row[0]; // Name in Column A
    const department = row[1] ? row[1].toString().toLowerCase() : ""; // Column B: Department (Sanitized)
    const email = row[2];       // Email in Column C
    
    if (teacherName) {
      // Safe, lowercase matching for HOD routing (Patched to use HOD_EMAILS keys)
      const hodEmail = (department.includes("upper") || department.includes("secondary"))
                       ? CONFIG.HOD_EMAILS.UPPER 
                       : CONFIG.HOD_EMAILS.LOWER;

      roster[teacherName] = {
        email: email,
        hodEmail: hodEmail
      };
    }
  }
  
  return roster;
}

/**
 * TIME-TRAVEL ENGINE: Finds the file ID of the teacher's PREVIOUS lesson plan.
 * Used by Gemini to check for academic continuity between weeks.
 */
function getPreviousLessonFileId(teacherName, className, subjectName, currentWeekString) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Identify the previous week name (e.g., "Week 3" -> "Week 2")
  const currentWeekMatch = currentWeekString.match(/Week (\d+)/i);
  if (!currentWeekMatch) return null;
  
  const currentWeekNum = parseInt(currentWeekMatch[1]);
  if (currentWeekNum <= 1) return null; // No continuity check for Week 1
  
  const prevWeekName = "Week " + (currentWeekNum - 1);
  const prevSheet = ss.getSheetByName(prevWeekName);
  
  if (!prevSheet) return null;

  // 2. Scan the previous week's sheet for a matching subject and teacher
  const data = prevSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const rowTeacher = data[i][CONFIG.INDICES.TEACHER_NAME];
    const rowClass = data[i][CONFIG.INDICES.CLASS];
    const rowSubject = data[i][CONFIG.INDICES.SUBJECT] ? data[i][CONFIG.INDICES.SUBJECT].toString() : "";

    if (rowTeacher === teacherName && 
        rowClass === className &&
        rowSubject.includes(subjectName)) {
      
      const link = data[i][CONFIG.INDICES.UPLOAD_LINK];
      const fileIdMatch = link ? link.match(/[-\w]{25,}/) : null;
      return fileIdMatch ? fileIdMatch[0] : null;
    }
  }
  return null;
}
