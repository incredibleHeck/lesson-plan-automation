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
  
  // Telegram has a hard limit of 4096 characters per message.
  // We truncate at 4000 just to be safe with HTML tags.
  let safeMessage = message;
  if (safeMessage.length > 4000) {
    safeMessage = safeMessage.substring(0, 4000) + "\n\n<i>...[Message truncated due to length. View full audit in Google Sheets]</i>";
  }
  
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: safeMessage,
    parse_mode: "HTML" 
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
 * @param {Date} timestamp Form submission time.
 * @param {string} latenessStatus Human-readable on-time / late line for Telegram.
 */
function sendAuditAlert(teacherName, className, subjectName, auditText, hodName, timestamp, latenessStatus) {

  const formattedTime = Utilities.formatDate(timestamp, "Africa/Accra", "MMM d, yyyy 'at' h:mm a");

  let cleanAudit = auditText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  cleanAudit = cleanAudit.replace(/\*/g, "");

  const message = `<b>🚨 Lesson Plan Submitted</b>\n\n` +
                  `<b>Teacher:</b> ${teacherName}\n` +
                  `<b>Class:</b> ${className}\n` +
                  `<b>Subject:</b> ${subjectName}\n` +
                  `<b>Submitted:</b> ${formattedTime}\n` +
                  `<b>Status:</b> ${latenessStatus}\n\n` +
                  `<b>🤖 AI Audit:</b>\n${cleanAudit}`;
  
  // 1. Always send a copy to VP Theodora Hammond
  if (CONFIG.TELEGRAM.CHAT_ID_VP) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_VP, message);
  }
  
  // 2. Route the second copy to the respective HOD (Typo Fixed: HOD instead of HID)
  if (hodName.includes("Alfred Ashia") && CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD, message);
  } else if (hodName.includes("Abigail Sackey") && CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD, message);
  }
}
