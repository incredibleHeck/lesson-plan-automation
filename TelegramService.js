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
  
  // Compress "Week 3" to "W3" for Telegram's 64-byte limit
  const shortWeek = weekString.replace("Week ", "W").trim();

  const approvalKeyboard = {
    "inline_keyboard": [
      [
        { "text": "✅ Approve", "callback_data": `APP_${shortWeek}_${teacherName}` },
        { "text": "🚨 Request Revision", "callback_data": `REV_${shortWeek}_${teacherName}` }
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
    
    // 1. Get current submission data to see who HAS submitted
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rawSheet = ss.getSheetByName("Form responses 1");
    const submissionData = rawSheet.getDataRange().getValues();
    const latestRow = submissionData[submissionData.length - 1];
    const targetWeek = latestRow[CONFIG.INDICES.WEEK_STARTING];
    
    let submittedTeachers = new Set();
    for (let i = 1; i < submissionData.length; i++) {
      if (submissionData[i][CONFIG.INDICES.WEEK_STARTING] === targetWeek) {
        submittedTeachers.add(submissionData[i][CONFIG.INDICES.TEACHER_NAME]);
      }
    }

    // 2. Get dynamic roster to see who SHOULD submit
    const liveRoster = getDynamicTeacherRoster();
    let missingRows = [];
    
    Object.keys(liveRoster).forEach(teacher => {
      if (!submittedTeachers.has(teacher)) {
        missingRows.push([
          { "text": `📲 Nudge ${teacher}`, "callback_data": `NUDGE_${teacher}` }
        ]);
      }
    });

    if (missingRows.length > 0) {
      const report = `<b>📊 Defaulters Report (${extractWeekName(targetWeek)}):</b>\nThe following teachers have not submitted plans yet. Tap to send a nudge:`;
      const nudgeKeyboard = { "inline_keyboard": missingRows };
      sendTelegramMessage(chatId, report, nudgeKeyboard);
    } else {
      sendTelegramMessage(chatId, `<b>✅ 100% Compliance:</b> All teachers in the roster have submitted plans for ${extractWeekName(targetWeek)}!`);
    }
    
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

  let responseText = "";
  const parts = data.split("_");
  const action = parts[0];

  if (action === "APP" || action === "REV") {
    const shortWeek = parts[1];
    const teacher = parts[2];
    const targetSheetName = shortWeek.replace("W", "Week ");
    
    if (action === "APP") {
      updateApprovalStatus(teacher, targetSheetName, "✅ APPROVED");
      responseText = `✅ <b>Approved:</b> You have approved the plan for ${teacher} on the '${targetSheetName}' tab.`;
    } else if (action === "REV") {
      const rowData = updateApprovalStatus(teacher, targetSheetName, "🚨 REVISION NEEDED");
      if (rowData && rowData.email) {
        sendRevisionEmail(rowData.email, teacher, targetSheetName, rowData.audit);
        responseText = `🚨 <b>Revision Requested:</b> The '${targetSheetName}' tab is updated, and an email was sent to ${teacher}.`;
      } else {
        responseText = `⚠️ <b>Warning:</b> Status updated for ${teacher}, but no email found in the Staff Roster.`;
      }
    }
  } else if (action === "NUDGE") {
    const teacher = parts[1];
    const liveRoster = getDynamicTeacherRoster();
    const teacherInfo = liveRoster[teacher];
    
    if (teacherInfo && teacherInfo.email) {
      sendNudgeEmail(teacherInfo.email, teacher, "the current week", teacherInfo.hodEmail);
      responseText = `✉️ <b>Nudge Sent:</b> An urgent reminder was emailed to ${teacher}, copying their HOD.`;
    } else {
      responseText = `⚠️ <b>Error:</b> Could not find an email address for ${teacher} in the Staff Roster.`;
    }
  }

  // 3. Update message to show result
  sendTelegramMessage(chatId, responseText);
}
