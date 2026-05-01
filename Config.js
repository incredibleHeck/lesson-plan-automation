/**
 * Global Configuration Settings
 */
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
    HOD_CHECK: 10,     // 1-based index for sheets (Col J)
    DAYS_LATE: 11      // 1-based index for sheets (Col K)
  },
  HEADERS: ["Timestamp", "Week Range", "HOD", "Teacher Name", "Class", "Subject", "Upload Link", "HOD Check", "Days Late", "AI Audit"],
  GEMINI_API_KEY: "AIzaSyCmPc-roorT0ylDfKq4diw4Sex-mGjRePY", 
  TELEGRAM: {
    BOT_TOKEN: "8649215464:AAGMxsC2YgBenEu_NNa9VIowU4wUZ-5uOHs", 
    CHAT_ID_VP: "900741421",
    CHAT_ID_LOWER_HOD: "6920642515",
    CHAT_ID_UPPER_HOD: "PASTE_UPPER_HOD_CHAT_ID"
  }
};
