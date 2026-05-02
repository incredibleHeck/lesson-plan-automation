/**
 * Global Configuration Settings
 * Secrets live in Apps Script: Project Settings → Script Properties (never commit them).
 */
const scriptProps = PropertiesService.getScriptProperties();

const CONFIG = {
  MASTER_FOLDER_NAME: "2026 Lesson Plans Master",
  EMAILS: {
    HOD_LOWER_PRIMARY: "alfredashia@stadelaideschools.com",
    HOD_UPPER_SECONDARY: "abigailsackey@stadelaideschools.com",
    VP_ACADEMICS: "theodorahammond@stadelaideschools.com"
  },
  // Indices based on form response array (0-based)
  INDICES: {
    TIMESTAMP: 0,
    WEEK_STARTING: 1,
    HOD: 2,
    TEACHER_NAME: 3,
    CLASS: 4,
    SUBJECT: 5,
    UPLOAD_LINK: 6,
    TEACHER_EMAIL: 7
  },
  COLUMNS: {
    HOD_CHECK: 10,
    DAYS_LATE: 11
  },
  // Columns for the dynamically created weekly sheets (1-indexed)
  WEEKLY_COLUMNS: {
    HOD_CHECK: 8,
    AI_AUDIT: 10
  },
  // Indices for the row data in weekly sheets (0-indexed)
  WEEKLY_INDICES: {
    TEACHER_NAME: 3,
    TEACHER_EMAIL: 7, // Note: Not currently in weekly sheet row, retrieved from roster or responses
    AI_AUDIT: 9
  },
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
