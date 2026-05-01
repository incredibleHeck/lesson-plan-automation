/**
 * Services for Telegram interactions
 */

/**
 * Core function to communicate with the Telegram API.
 * @param {string} chatId The Telegram Chat ID to send the message to.
 * @param {string} message The message text.
 */
function sendTelegramMessage(chatId, message) {
  // Failsafe: Don't run if the bot isn't set up yet
  if (!CONFIG.TELEGRAM.BOT_TOKEN || CONFIG.TELEGRAM.BOT_TOKEN === "PASTE_YOUR_BOT_TOKEN_HERE") {
    return;
  }
  
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML" // Allows us to use bolding and structure in the message
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch (err) {
    Logger.log("Error sending Telegram message: " + err.message);
  }
}

/**
 * Formats the AI Audit and routes it to the VP and the correct HOD.
 * @param {string} teacherName The name of the teacher.
 * @param {string} className The class name.
 * @param {string} subjectName The subject name.
 * @param {string} auditText The audit text from Gemini.
 * @param {string} hodName The name of the HOD for routing.
 */
function sendAuditAlert(teacherName, className, subjectName, auditText, hodName) {
  // Format the message for a clean mobile reading experience
  const message = `<b>🚨 New Lesson Plan Audit</b>\n\n` +
                  `<b>Teacher:</b> ${teacherName}\n` +
                  `<b>Class:</b> ${className}\n` +
                  `<b>Subject:</b> ${subjectName}\n\n` +
                  `<b>AI Audit Report:</b>\n${auditText}`;
  
  // 1. Always send a copy to VP Theodora Hammond
  if (CONFIG.TELEGRAM.CHAT_ID_VP) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_VP, message);
  }
  
  // 2. Route the second copy to the respective HOD
  if (hodName.includes("Alfred Ashia") && CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_LOWER_HID, message);
  } else if (hodName.includes("Abigail Sackey") && CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD, message);
  }
}
