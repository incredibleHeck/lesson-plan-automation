/**
 * Automated Lesson Plan Verification
 * 
 * Objectives:
 * 1. Parse deadline from "Week Starting" (Friday 23:59:59 GMT).
 * 2. Compare submission timestamp.
 * 3. Mark "LATE" in Column L if needed.
 * 4. Notify respective HOD.
 */

/**
 * Automated Lesson Plan Verification & Routing
 * 
 * Objectives:
 * 1. Parse "Week Name" (e.g., "Week 1") from submission.
 * 2. Create a specific sheet for that week if it doesn't exist.
 * 3. Calculate deadline (Friday 23:59:59 GMT).
 * 4. Append row to the correct weekly sheet with status "UNREAD".
 * 5. Highlight the row in red if it's late.
 * 6. Notify respective HOD if late.
 */

// Configuration
const CONFIG = {
  HOD_EMAILS: {
    "Mr. Alfred Ashia": "alfredashia@stadelaideschools.com",
    "Mrs. Abigail Sackey": "abigailsackey@stadelaideschool.com"
  },
  // Indices based on form response array (0-based)
  INDICES: {
    TIMESTAMP: 0,      // Col A
    WEEK_STARTING: 1,  // Col B
    HOD: 2,            // Col C
    TEACHER_NAME: 3,   // Col D
    CLASS: 4,          // Col E
    SUBJECT: 5,        // Col F
    UPLOAD_LINK: 6     // Col G
  },
  HEADERS: ["Timestamp", "Week Range", "HOD", "Teacher Name", "Class", "Subject", "Upload Link", "HOD Check", "Days Late"],
  DEADLINE_HOUR: 23,
  DEADLINE_MINUTE: 59,
  DEADLINE_SECOND: 59
};

/**
 * Triggered on Form Submit.
 */
function onFormSubmit(e) {
  if (!e) return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const responses = e.values;
  
  const timestamp = new Date(responses[CONFIG.INDICES.TIMESTAMP]);
  const fullWeekString = responses[CONFIG.INDICES.WEEK_STARTING];
  const hodSelection = responses[CONFIG.INDICES.HOD];
  const teacherName = responses[CONFIG.INDICES.TEACHER_NAME];
  const subject = responses[CONFIG.INDICES.SUBJECT];
  const uploadLink = responses[CONFIG.INDICES.UPLOAD_LINK];
  
  // 1. Extract Sheet Name (e.g., "Week 1")
  const weekName = fullWeekString.split(":")[0].trim();
  
  // 2. Get or Create Weekly Sheet
  let weeklySheet = ss.getSheetByName(weekName);
  if (!weeklySheet) {
    weeklySheet = ss.insertSheet(weekName);
    weeklySheet.appendRow(CONFIG.HEADERS);
    weeklySheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight("bold");
    weeklySheet.setFrozenRows(1);
  }
  
  // 3. Calculate Deadline & Lateness
  const deadline = calculateFridayDeadline(fullWeekString);
  let daysLate = 0;
  if (deadline && timestamp > deadline) {
    const diffTime = Math.abs(timestamp - deadline);
    daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const hodEmail = getHodEmail(hodSelection);
    if (hodEmail) {
      sendLateAlert(hodEmail, teacherName, subject, timestamp, deadline, daysLate);
    }
  }
  
  // 4. Prepare Row Data
  const rowData = [
    responses[CONFIG.INDICES.TIMESTAMP],
    fullWeekString,
    hodSelection,
    teacherName,
    responses[CONFIG.INDICES.CLASS],
    subject,
    uploadLink,
    "UNREAD", // Default HOD Check
    daysLate
  ];
  
  // 5. Append and Format
  weeklySheet.appendRow(rowData);
  const lastRow = weeklySheet.getLastRow();
  
  // Highlight row if late
  if (daysLate > 0) {
    weeklySheet.getRange(lastRow, 1, 1, rowData.length).setBackground("#f4cccc"); // Light Red
  }
}

/**
 * Parses the Friday of the selected week range at 23:59:59.
 */
function calculateFridayDeadline(rangeText) {
  const dateMatch = rangeText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
  if (!dateMatch) return null;
  
  const startDate = new Date(dateMatch[1]);
  if (isNaN(startDate.getTime())) return null;

  const deadline = new Date(startDate);
  deadline.setDate(startDate.getDate() + 4);
  deadline.setHours(CONFIG.DEADLINE_HOUR, CONFIG.DEADLINE_MINUTE, CONFIG.DEADLINE_SECOND, 999);
  
  return deadline;
}

/**
 * Returns the email for the selected HOD.
 */
function getHodEmail(hodSelection) {
  if (!hodSelection) return null;
  const selectionLower = hodSelection.toLowerCase();
  for (let name in CONFIG.HOD_EMAILS) {
    if (selectionLower.indexOf(name.toLowerCase()) !== -1 || name.toLowerCase().indexOf(selectionLower) !== -1) {
      return CONFIG.HOD_EMAILS[name];
    }
  }
  return null;
}

/**
 * Sends an email alert to the HOD.
 */
function sendLateAlert(email, teacher, subject, submittedAt, deadline, daysLate) {
  const subjectLine = "LATE Lesson Plan Submission: " + teacher + " (" + daysLate + " days late)";
  const body = "Dear HOD,\n\n" +
               "This is an automated alert to inform you that " + teacher + " has submitted a lesson plan LATE.\n\n" +
               "Subject: " + subject + "\n" +
               "Days Late: " + daysLate + "\n" +
               "Submitted At: " + submittedAt.toLocaleString() + "\n" +
               "Deadline was: " + deadline.toLocaleString() + "\n\n" +
               "Please check the specific weekly sheet for more details.";
               
  MailApp.sendEmail(email, subjectLine, body);
}

/**
 * Test function to verify logic.
 * You can run this from the Apps Script editor to check the calculations.
 */
function testSubmission() {
  const mockWeek = "Week 3: May 4, 2026 – May 10, 2026";
  const deadline = calculateFridayDeadline(mockWeek);
  
  Logger.log("Mock Week: " + mockWeek);
  Logger.log("Calculated Deadline (Friday): " + deadline.toLocaleString());
  
  // Test 1: On Time (Thursday)
  const onTimeDate = new Date("May 7, 2026 14:00:00");
  Logger.log("Test 1 (Thursday): " + (onTimeDate > deadline ? "LATE" : "On Time"));
  
  // Test 2: Exactly Deadline (Friday 23:59:59)
  const exactDeadline = new Date("May 8, 2026 23:59:59");
  Logger.log("Test 2 (Fri 23:59:59): " + (exactDeadline > deadline ? "LATE" : "On Time"));
  
  // Test 3: Late (Saturday)
  const lateDate = new Date("May 9, 2026 08:00:00");
  Logger.log("Test 3 (Saturday): " + (lateDate > deadline ? "LATE" : "On Time"));
}

/**
 * Run this function once from the editor to set up the trigger.
 */
function createTrigger() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
}
