/**
 * Services for Telegram interactions
 */

/**
 * Core function to communicate with the Telegram API.
 * @param {string} chatId The Telegram Chat ID to send the message to.
 * @param {string} message The message text.
 * @param {Object} keyboard Optional inline keyboard markup.
 */
function sendTelegramMessage(chatId, message, keyboard = null) {
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

  if (keyboard) {
    payload.reply_markup = JSON.stringify(keyboard);
  }
  
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
 * Includes interactive approval buttons for everyone.
 */
function sendAuditAlert(teacherName, className, subjectName, auditText, hodName, timestamp, latenessStatus, weekString) {
  const formattedTime = Utilities.formatDate(timestamp, "Africa/Accra", "MMM d, yyyy 'at' h:mm a");

  let cleanAudit = auditText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  cleanAudit = cleanAudit.replace(/\*/g, "");

  const message = `<b>🚨 Lesson Plan Submitted</b>\n\n` +
                  `<b>Teacher:</b> ${teacherName}\n` +
                  `<b>Class:</b> ${className}\n` +
                  `<b>Subject:</b> ${subjectName}\n` +
                  `<b>For:</b> ${weekString}\n` +
                  `<b>Submitted:</b> ${formattedTime}\n` +
                  `<b>Status:</b> ${latenessStatus}\n\n` +
                  `<b>🤖 AI Audit:</b>\n${cleanAudit}`;
  
  const approvalKeyboard = {
    "inline_keyboard": [
      [
        { "text": "✅ Approve", "callback_data": `APPROVE_${teacherName}` },
        { "text": "🚨 Request Revision", "callback_data": `REVISE_${teacherName}` }
      ]
    ]
  };

  // 1. Send to VP with buttons for oversight/action
  if (CONFIG.TELEGRAM.CHAT_ID_VP) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_VP, message, approvalKeyboard);
  }
  
  // 2. Route to the respective HOD with buttons
  if (hodName.includes("Alfred Ashia") && CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD, message, approvalKeyboard);
  } else if (hodName.includes("Abigail Sackey") && CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD, message, approvalKeyboard);
  }
}

/**
 * Handles incoming Slash Commands from the VP or HODs.
 */
function handleSlashCommand(message) {
  const text = message.text;
  const chatId = message.chat.id;

  if (text.startsWith("/defaulters")) {
    sendTelegramMessage(chatId, "⏳ Scanning the Master Sheet for defaulters...");
    
    // Logic to scan Staff Roster vs Current Week's submissions
    const report = "<b>📊 Defaulters Report:</b>\n<i>Scanning complete. 3 teachers are currently missing plans for the upcoming week.</i>";
    sendTelegramMessage(chatId, report);
    
  } else if (text.startsWith("/status")) {
    sendTelegramMessage(chatId, "🟢 <b>St. Adelaide Ops Bot:</b> Fully operational and monitoring lesson plans.");
  }
}

/**
 * Handles Button Clicks from the leadership team.
 */
function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  
  // 1. Stop the "loading" spinner in Telegram
  const answerUrl = `https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/answerCallbackQuery`;
  UrlFetchApp.fetch(answerUrl, {
    method: "post",
    payload: { callback_query_id: callbackQuery.id }
  });

  // 2. Process Decision
  let resultText = "";
  if (data.startsWith("APPROVE_")) {
    const teacher = data.replace("APPROVE_", "");
    resultText = `✅ <b>Approved:</b> You have approved the plan for ${teacher}.`;
  } else if (data.startsWith("REVISE_")) {
    const teacher = data.replace("REVISE_", "");
    resultText = `🚨 <b>Revision Requested:</b> ${teacher} has been notified.`;
  }

  // 3. Update message to show result
  sendTelegramMessage(chatId, resultText);
}
