/**
 * Global Configuration Settings
 * Secrets live in Apps Script: Project Settings → Script Properties (never commit them).
 */
const scriptProps = PropertiesService.getScriptProperties();

const CONFIG = {
  MASTER_FOLDER_NAME: "2026 Lesson Plans Master",
  
  // HOD Emails for routing (since they are not in the Staff Roster)
  HOD_EMAILS: {
    "LOWER": "alfredashia@stadelaideschools.com", 
    "UPPER": "abigailsackey@stadelaideschool.com"
  },

  EMAILS: {
    HOD_LOWER_PRIMARY: "alfredashia@stadelaideschools.com",
    HOD_UPPER_SECONDARY: "abigailsackey@stadelaideschool.com",
    VP_ACADEMICS: "theodorahammond@stadelaideschools.com"
  },

  // Indices based on the actual CSV column structure (0-based)
  // [Timestamp, Week Range, HOD, Teacher Name, Class, Subject, Upload Link, HOD Check, Days Late, AI Audit]
  INDICES: {
    TIMESTAMP: 0,
    WEEK_STARTING: 1,
    HOD: 2,
    TEACHER_NAME: 3,
    CLASS: 4,
    SUBJECT: 5,
    UPLOAD_LINK: 6,
    HOD_CHECK: 7,
    DAYS_LATE: 8,
    AI_AUDIT: 9,
    TEACHER_EMAIL: 7 // This index is used for the main responses sheet, not weekly tabs
  },

  // Column numbers for writing back to sheets (1-based)
  STATUS_COLUMN_NUMBER: 8, // Column H: HOD Check
  
  HEADERS: ["Timestamp", "Week Range", "HOD", "Teacher Name", "Class", "Subject", "Upload Link", "HOD Check", "Days Late", "AI Audit"],

  DEADLINE: {
    HOUR: 23,
    MINUTE: 59,
    SECOND: 59
  },

  GEMINI_API_KEY: scriptProps.getProperty("GEMINI_API_KEY"),
  TELEGRAM: {
    BOT_TOKEN: scriptProps.getProperty("TELEGRAM_BOT_TOKEN"),
    CHAT_ID_VP: scriptProps.getProperty("CHAT_ID_VP"),
    CHAT_ID_LOWER_HOD: scriptProps.getProperty("CHAT_ID_LOWER_HOD"),
    CHAT_ID_UPPER_HOD: scriptProps.getProperty("CHAT_ID_UPPER_HOD")
  }
};
