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
 * Looks at the previous week's tab to find the teacher's previous lesson plan.
 * Returns the Google Drive File ID if found.
 */
function getPreviousLessonFileId(teacherName, className, subjectName, currentWeekString) {
  // Extract the week number (e.g., gets "3" from "Week 3: May 4...")
  const match = currentWeekString.match(/Week (\d+)/i);
  if (!match) return null;
  
  const currentWeekNum = parseInt(match[1], 10);
  if (currentWeekNum <= 1) return null; // Week 1 has no previous week!
  
  const prevWeekName = "Week " + (currentWeekNum - 1);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prevSheet = ss.getSheetByName(prevWeekName);
  
  if (!prevSheet) return null; // If the tab doesn't exist yet, abort gracefully
  
  const data = prevSheet.getDataRange().getValues();
  
  // Loop backwards to find their latest submission for this EXACT class and subject
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][CONFIG.INDICES.TEACHER_NAME] === teacherName &&
        data[i][CONFIG.INDICES.CLASS] === className &&
        data[i][CONFIG.INDICES.SUBJECT] === subjectName) {
        
        const fileUrl = data[i][CONFIG.INDICES.UPLOAD_LINK]; 
        if (!fileUrl) return null;
        
        // Extract the raw Drive File ID from the URL string
        const idMatch = fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
        return idMatch ? idMatch[1] : null;
    }
  }
  return null;
}

/**
 * Updates the approval status on the specific Week's sheet and gets the Audit text
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
    if (data[i][CONFIG.INDICES.TEACHER_NAME] === teacherName) {
      
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
 * Dynamically pulls the master teacher list from the "Staff Roster" sheet
 * Returns an object: { "Teacher Name": { email: "...", hodEmail: "..." } }
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
    const department = row[1];  // Department in Column B
    const email = row[2];       // Email in Column C
    
    if (teacherName) {
      // Figure out which HOD email to CC based on their department
      const hodEmail = (department.includes("Upper") || department.includes("Secondary"))
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
