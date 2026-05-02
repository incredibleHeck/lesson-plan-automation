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
    responses[CONFIG.INDICES.TIMESTAMP],
    responses[CONFIG.INDICES.WEEK_STARTING],
    responses[CONFIG.INDICES.HOD],
    responses[CONFIG.INDICES.TEACHER_NAME],
    responses[CONFIG.INDICES.CLASS],
    responses[CONFIG.INDICES.SUBJECT],
    responses[CONFIG.INDICES.UPLOAD_LINK],
    "UNREAD", // Default HOD Check
    daysLate,
    aiAuditText || "Audit Pending/Skipped"
  ];
  
  weeklySheet.appendRow(rowData);
  const lastRow = weeklySheet.getLastRow();
  
  // PRO UPGRADE: Add an interactive dropdown to the "HOD Check" column
  const hodCheckCell = weeklySheet.getRange(lastRow, CONFIG.WEEKLY_COLUMNS.HOD_CHECK); 
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
 * Updates the approval status on the specific Week's sheet and returns the teacher's data
 */
function updateApprovalStatus(teacherName, sheetName, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName(sheetName); 
  
  if (!targetSheet) {
    Logger.log(`🚨 CRITICAL ERROR: Could not find a tab named '${sheetName}'`);
    return null;
  }

  const data = targetSheet.getDataRange().getValues();
  
  // Loop backwards to find the teacher's MOST RECENT submission on this specific week tab
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][CONFIG.WEEKLY_INDICES.TEACHER_NAME] === teacherName) {
      
      // Update the status column (i + 1 because Sheets are 1-indexed)
      targetSheet.getRange(i + 1, CONFIG.WEEKLY_COLUMNS.HOD_CHECK).setValue(status);
      
      // Fetch email from the dynamic roster for the notification
      const roster = getDynamicTeacherRoster();
      const teacherInfo = roster[teacherName];

      return {
        email: teacherInfo ? teacherInfo.email : null,
        week: sheetName,
        audit: data[i][CONFIG.WEEKLY_INDICES.AI_AUDIT] || "Please review the feedback from your HOD."
      };
    }
  }
  return null;
}

/**
 * Dynamically pulls the master teacher list from the "Teachers Roster" sheet
 * Returns an object: { "Teacher Name": { email: "...", hodEmail: "..." } }
 */
function getDynamicTeacherRoster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName("Teachers Roster"); 
  
  if (!rosterSheet) {
    Logger.log("Error: Could not find the 'Teachers Roster' sheet.");
    return {};
  }

  const data = rosterSheet.getDataRange().getValues();
  const roster = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const teacherName = row[0]; // Name in Column A
    
    if (teacherName) {
      roster[teacherName] = {
        email: row[1],    // Teacher Email in Column B
        hodEmail: row[2]  // HOD Email in Column C
      };
    }
  }
  
  return roster;
}
