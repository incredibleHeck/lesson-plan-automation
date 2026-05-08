/**
 * Global Configuration Settings
 * Secrets live in Apps Script: Project Settings → Script Properties (never commit them).
 */
const scriptProps = PropertiesService.getScriptProperties();

const CONFIG = {
  MASTER_FOLDER_NAME: "2026 Lesson Plans Master",
  
  // SECURED: Pulled from Script Properties to protect PII
  HOD_EMAILS: {
    LOWER: scriptProps.getProperty("EMAIL_LOWER_HOD") || "lower_hod@example.com",
    UPPER: scriptProps.getProperty("EMAIL_UPPER_HOD") || "upper_hod@example.com",
    VP: scriptProps.getProperty("EMAIL_VP") || "vp@example.com"
  },
  
  HOD_NAMES: {
    LOWER: scriptProps.getProperty("NAME_LOWER_HOD") || "Lower HOD",
    UPPER: scriptProps.getProperty("NAME_UPPER_HOD") || "Upper HOD"
  },

  // 1. INDICES FOR INCOMING FORM SUBMISSION (e.values array)
  // Ensure these match the exact column order of the "Form responses 1" tab
  FORM_INDICES: {
    TIMESTAMP: 0,
    WEEK_STARTING: 1,
    HOD: 2,
    TEACHER_NAME: 3,
    CLASS: 4,
    SUBJECT: 5,
    UPLOAD_LINK: 6,
    TEACHER_EMAIL: 7 
  },

  // 2. INDICES FOR WEEKLY TABS 
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
    AI_AUDIT: 9 
  },

  // Column number for writing back to sheets (1-based)
  STATUS_COLUMN_NUMBER: 8, // Column H: HOD Check
  
  HEADERS: ["Timestamp", "Week Range", "HOD", "Teacher Name", "Class", "Subject", "Upload Link", "HOD Check", "Days Late", "AI Audit"],

  DEADLINE: {
    HOUR: 23,
    MINUTE: 59,
    SECOND: 59
  },

  GEMINI_API_KEY: scriptProps.getProperty("GEMINI_API_KEY"),
  WEBHOOK_SECRET: scriptProps.getProperty("WEBHOOK_SECRET"), // Security token for the Telegram webhook
  
  TELEGRAM: {
    BOT_TOKEN: scriptProps.getProperty("TELEGRAM_BOT_TOKEN"),
    CHAT_ID_VP: scriptProps.getProperty("CHAT_ID_VP"),
    CHAT_ID_LOWER_HOD: scriptProps.getProperty("CHAT_ID_LOWER_HOD"),
    CHAT_ID_UPPER_HOD: scriptProps.getProperty("CHAT_ID_UPPER_HOD"),
    // SECURED: Personal Telegram User IDs for button authorization
    AUTHORIZED_USER_IDS: [
      scriptProps.getProperty("TELEGRAM_VP_USER_ID") || "REPLACE_WITH_VP_USER_ID",
      scriptProps.getProperty("TELEGRAM_LOWER_USER_ID") || "REPLACE_WITH_LOWER_USER_ID",
      scriptProps.getProperty("TELEGRAM_UPPER_USER_ID") || "REPLACE_WITH_UPPER_USER_ID"
    ]
  }
};
