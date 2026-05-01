/**
 * Global Configuration Settings
 */
const CONFIG = {
  MASTER_FOLDER_NAME: "2026 Lesson Plans Master", // The system will look for or create this
  HOD_EMAILS: {
    "Mr. Alfred Ashia": "alfredashia@stadelaideschools.com",
    "Mrs. Abigail Sackey": "abigailsackey@stadelaideschool.com"
  },
  EMAILS: {
    HOD_LOWER_PRIMARY: "alfredashia@stadelaideschools.com", 
    HOD_UPPER_SECONDARY: "abigailsackey@stadelaideschool.com",
    VP_ACADEMICS: "theodorahammond@stadelaideschool.com" // Added VP Theodora Hammond
  },
  // Indices based on form response array (0-based)
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
    HOD_CHECK: 10,     // Col J
    DAYS_LATE: 11      // Col K
  },
  HEADERS: ["Timestamp", "Week Range", "HOD", "Teacher Name", "Class", "Subject", "Upload Link", "HOD Check", "Days Late"],
  DEADLINE: {
    HOUR: 23,
    MINUTE: 59,
    SECOND: 59
  }
};
