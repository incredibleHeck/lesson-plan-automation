/**
 * Services for Spreadsheet interactions
 */

/**
 * Routes data to the correct weekly tab and applies lateness formatting
 */
function logSubmissionToSheet(responses, weekName, daysLate, aiAuditText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Update local headers to match what we write
  const currentHeaders = [...CONFIG.HEADERS, "AI Audit Summary"];

  let weeklySheet = ss.getSheetByName(weekName);
  if (!weeklySheet) {
    weeklySheet = ss.insertSheet(weekName);
    weeklySheet.appendRow(currentHeaders);
    weeklySheet.getRange(1, 1, 1, currentHeaders.length).setFontWeight("bold");
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
  
  if (daysLate > 0) {
    weeklySheet.getRange(lastRow, 1, 1, rowData.length).setBackground("#f4cccc"); // Light Red
  }
}
