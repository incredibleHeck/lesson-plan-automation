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
  
  // PRO UPGRADE: Add an interactive dropdown to the "HOD Check" column (Column 8)
  const hodCheckCell = weeklySheet.getRange(lastRow, 8); 
  const validationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["UNREAD", "APPROVED", "REVISION NEEDED"], true)
    .build();
  hodCheckCell.setDataValidation(validationRule);
  
  // Apply lateness formatting
  if (daysLate > 0) {
    weeklySheet.getRange(lastRow, 1, 1, rowData.length).setBackground("#f4cccc"); // Light Red
  }
}
