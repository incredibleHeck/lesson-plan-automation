/**
 * Enterprise Lesson Plan Automation System
 * 
 * Features:
 * 1. Dynamic Weekly Sheet Routing & Highlighting
 * 2. Chronological Google Drive Organization (Week -> Class)
 * 3. Automatic File Renaming ([Subject] - [Teacher Name])
 * 4. Automated Teacher Email Receipts
 * 5. Weekly Friday Late Report for HODs
 */

// Configuration - UPDATE THESE VALUES
const CONFIG = {
  HOD_EMAILS: {
    "Mr. Alfred Ashia": "alfredashia@stadelaideschools.com",
    "Mrs. Abigail Sackey": "abigailsackey@stadelaideschool.com"
  },
  // Mapping indices to the form response array (0-based)
  // Based on: Timestamp(0), Week Starting(1), HOD(2), Teacher(3), Class(4), Subject(5), Upload(6), Email(7)
  INDICES: {
    TIMESTAMP: 0,      // Col A
    WEEK_STARTING: 1,  // Col B
    HOD: 2,            // Col C
    TEACHER_NAME: 3,   // Col D
    CLASS: 4,          // Col E
    SUBJECT: 5,        // Col F
    UPLOAD_LINK: 6,    // Col G
    TEACHER_EMAIL: 7   // Col H
  },
  // Column positions for writing back to sheets
  COLUMNS: {
    HOD_CHECK: 10,     // Col J (Manual Toggle: UNREAD/READ)
    DAYS_LATE: 11      // Col K (Calculated Value)
  },
  HEADERS: ["Timestamp", "Week Range", "HOD", "Teacher Name", "Class", "Subject", "Upload Link", "HOD Check", "Days Late"],
  DEADLINE: {
    HOUR: 23,
    MINUTE: 59,
    SECOND: 59
  },
  MASTER_FOLDER_ID: "YOUR_MASTER_FOLDER_ID_HERE" // Paste your Drive Folder ID here
};

/**
 * 1. MAIN TRIGGER: Runs automatically on form submission.
 */
function onFormSubmit(e) {
  if (!e) return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const responses = e.values;
  
  const timestamp = new Date(responses[CONFIG.INDICES.TIMESTAMP]);
  const fullWeekString = responses[CONFIG.INDICES.WEEK_STARTING];
  const hodName = responses[CONFIG.INDICES.HOD];
  const teacherName = responses[CONFIG.INDICES.TEACHER_NAME];
  const className = responses[CONFIG.INDICES.CLASS];
  const subjectName = responses[CONFIG.INDICES.SUBJECT];
  const uploadLink = responses[CONFIG.INDICES.UPLOAD_LINK];
  const teacherEmail = responses[CONFIG.INDICES.TEACHER_EMAIL];
  
  const weekName = fullWeekString.split(":")[0].trim();
  
  // --- A. SHEET ROUTING ---
  let weeklySheet = ss.getSheetByName(weekName);
  if (!weeklySheet) {
    weeklySheet = ss.insertSheet(weekName);
    weeklySheet.appendRow(CONFIG.HEADERS);
    weeklySheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight("bold");
    weeklySheet.setFrozenRows(1);
  }
  
  // --- B. LATENESS CHECK ---
  const deadline = calculateFridayDeadline(fullWeekString);
  let daysLate = 0;
  if (deadline && timestamp > deadline) {
    const diffTime = Math.abs(timestamp - deadline);
    daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Immediate Alert to HOD for late submission
    const hodEmail = getHodEmail(hodName);
    if (hodEmail) {
      sendLateAlert(hodEmail, teacherName, subjectName, timestamp, deadline, daysLate);
    }
  }
  
  // --- C. AUTO-FILING & RENAMING ---
  try {
    if (CONFIG.MASTER_FOLDER_ID !== "YOUR_MASTER_FOLDER_ID_HERE") {
      organizeAndRenameFile(uploadLink, weekName, className, subjectName, teacherName);
    }
  } catch (err) {
    Logger.log("Error organizing file: " + err.message);
  }
  
  // --- D. RECORD DATA & FORMAT ---
  const rowData = [
    responses[CONFIG.INDICES.TIMESTAMP],
    fullWeekString,
    hodName,
    teacherName,
    className,
    subjectName,
    uploadLink,
    "UNREAD", // Default HOD Check
    daysLate
  ];
  
  weeklySheet.appendRow(rowData);
  const lastRow = weeklySheet.getLastRow();
  
  if (daysLate > 0) {
    weeklySheet.getRange(lastRow, 1, 1, rowData.length).setBackground("#f4cccc"); // Light Red
  }
  
  // --- E. EMAIL RECEIPT TO TEACHER ---
  if (teacherEmail) {
    sendTeacherReceipt(teacherEmail, teacherName, subjectName, className, fullWeekString, weekName);
  }
}

/**
 * 2. AUTO-FILING & RENAMING: Week -> Class structure + Subject - Teacher Name.
 */
function organizeAndRenameFile(fileUrl, weekName, className, subjectName, teacherName) {
  const masterFolder = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);

  const weekFolder = getOrCreateFolder(masterFolder, weekName);
  const classFolder = getOrCreateFolder(weekFolder, className);

  const fileId = fileUrl.indexOf("id=") !== -1 ? fileUrl.split("id=")[1] : null;

  if (fileId) {
    const file = DriveApp.getFileById(fileId);
    
    // Auto-Rename: [Subject] - [Teacher Name]
    const originalName = file.getName();
    const extension = originalName.indexOf('.') !== -1 ? originalName.split('.').pop() : "";
    const newName = subjectName + " - " + teacherName + (extension ? "." + extension : "");
    file.setName(newName);
    
    file.moveTo(classFolder); 
  }
}

/**
 * 3. FRIDAY REPORT: Time-driven function to summarize late submissions for HODs.
 */
function sendFridayLateReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName("Form responses 1"); // Ensure this matches your response tab name
  if (!rawSheet) return;
  
  const data = rawSheet.getDataRange().getValues();
  const reports = {};
  
  // Initialize report objects for each HOD
  for (let hod in CONFIG.HOD_EMAILS) {
    reports[hod] = [];
  }

  // Scan responses (skip header)
  for (let i = 1; i < data.length; i++) {
    const hod = data[i][CONFIG.INDICES.HOD];
    const teacher = data[i][CONFIG.INDICES.TEACHER_NAME];
    const classLevel = data[i][CONFIG.INDICES.CLASS];
    const daysLate = data[i][CONFIG.COLUMNS.DAYS_LATE - 1]; // Correct index for Col K

    if (daysLate > 0) {
      const entry = `- ${teacher} (${classLevel}): ${daysLate} day(s) late.`;
      
      // Match HOD to config
      for (let configHod in CONFIG.HOD_EMAILS) {
        if (hod.includes(configHod)) {
          reports[configHod].push(entry);
        }
      }
    }
  }

  // Send reports
  for (let hod in reports) {
    if (reports[hod].length > 0) {
      MailApp.sendEmail({
        to: CONFIG.HOD_EMAILS[hod],
        subject: `Friday Summary: Overdue Lesson Plans (${hod})`,
        body: `Hello ${hod},\n\nThe following teachers currently have overdue lesson plans recorded in the system:\n\n${reports[hod].join("\n")}\n\nPlease review the spreadsheet for details.`
      });
    }
  }
}

/**
 * HELPER: Folder Management
 */
function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

/**
 * HELPER: Calculate Friday Deadline
 */
function calculateFridayDeadline(rangeText) {
  const dateMatch = rangeText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
  if (!dateMatch) return null;
  
  const startDate = new Date(dateMatch[1]);
  if (isNaN(startDate.getTime())) return null;

  const deadline = new Date(startDate);
  deadline.setDate(startDate.getDate() + 4);
  deadline.setHours(CONFIG.DEADLINE.HOUR, CONFIG.DEADLINE.MINUTE, CONFIG.DEADLINE.SECOND, 999);
  
  return deadline;
}

/**
 * HELPER: Email Notifications
 */
function sendTeacherReceipt(email, teacher, subject, className, fullWeek, weekName) {
  const body = `Hello ${teacher},\n\nYour ${subject} lesson plan for ${className} has been successfully received and filed for ${fullWeek}.\n\nThank you!`;
  MailApp.sendEmail({
    to: email,
    subject: `Success: Lesson Plan Filed (${weekName})`,
    body: body
  });
}

function sendLateAlert(email, teacher, subject, submittedAt, deadline, daysLate) {
  const subjectLine = `LATE Submission Alert: ${teacher} (${daysLate} days late)`;
  const body = `Dear HOD,\n\nThis is an automated alert for a late lesson plan submission:\n\nTeacher: ${teacher}\nSubject: ${subject}\nDays Late: ${daysLate}\nSubmitted: ${submittedAt.toLocaleString()}\nDeadline: ${deadline.toLocaleString()}\n\nThe file has been organized into the weekly folder.`;
  MailApp.sendEmail(email, subjectLine, body);
}

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
 * INITIAL SETUP: Run these once from the editor
 */
function createTriggers() {
  const ss = SpreadsheetApp.getActive();
  
  // Form Submit Trigger
  ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
      
  // Friday Report Trigger (Every Friday at 4 PM)
  ScriptApp.newTrigger('sendFridayLateReport')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.FRIDAY)
      .atHour(16)
      .create();
}
