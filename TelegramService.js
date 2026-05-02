/**
 * Services for Telegram interactions
 */

/**
 * Compresses long subject names into short codes for Telegram's 64-byte limit.
 */
function compressSubject(subjectName) {
  const subj = subjectName.toLowerCase();
  if (subj.includes("ict") || subj.includes("computing")) return "ICT";
  if (subj.includes("math")) return "MAT";
  if (subj.includes("english") || subj.includes("literacy")) return "ENG";
  if (subj.includes("science")) return "SCI";
  if (subj.includes("french")) return "FRE";
  if (subj.includes("history")) return "HIS";
  if (subj.includes("geography")) return "GEO";
  return subjectName.substring(0, 4).toUpperCase();
}

/**
 * Core function to communicate with the Telegram API.
 */
function sendTelegramMessage(chatId, message, keyboard = null) {
  if (!CONFIG.TELEGRAM.BOT_TOKEN || CONFIG.TELEGRAM.BOT_TOKEN === "PASTE_YOUR_BOT_TOKEN_HERE") {
    return;
  }
  
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
 * Formats the AI Audit and routes it to leadership with approval buttons.
 * Data: Action_Week_Subject_Teacher
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
  
  const shortWeek = weekString.replace("Week ", "W").trim();
  const shortSubj = compressSubject(subjectName);

  const approvalKeyboard = {
    "inline_keyboard": [
      [
        { "text": "✅ Approve", "callback_data": `APP_${shortWeek}_${shortSubj}_${teacherName}` },
        { "text": "🚨 Request Revision", "callback_data": `REV_${shortWeek}_${shortSubj}_${teacherName}` }
      ]
    ]
  };

  if (CONFIG.TELEGRAM.CHAT_ID_VP) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_VP, message, approvalKeyboard);
  }
  
  if (hodName.includes(CONFIG.HOD_NAMES.LOWER) && CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD, message, approvalKeyboard);
  } else if (hodName.includes(CONFIG.HOD_NAMES.UPPER) && CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD, message, approvalKeyboard);
  }
}

/**
 * Handles incoming Slash Commands.
 */
function handleSlashCommand(message) {
  const text = message.text;
  const chatId = message.chat.id;

  if (text.startsWith("/defaulters")) {
    const parts = text.split(" ");
    let targetWeek = "";
    
    if (parts.length > 1) {
      targetWeek = parts.slice(1).join(" ");
    } else {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const rawSheet = ss.getSheetByName("Form responses 1");
      const lastRowData = rawSheet.getRange(rawSheet.getLastRow(), CONFIG.FORM_INDICES.WEEK_STARTING + 1).getValue();
      targetWeek = extractWeekName(lastRowData);
    }

    sendTelegramMessage(chatId, `⏳ Scanning ${targetWeek} for defaulters...`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const weeklySheet = ss.getSheetByName(targetWeek);
    
    if (!weeklySheet) {
      sendTelegramMessage(chatId, `⚠️ <b>Error:</b> Could not find a tab named '${targetWeek}'.`);
      return;
    }

    const submissionData = weeklySheet.getDataRange().getValues();
    let submittedTeachers = new Set();
    for (let i = 1; i < submissionData.length; i++) {
      submittedTeachers.add(submissionData[i][CONFIG.INDICES.TEACHER_NAME]);
    }

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
      const report = `<b>📊 Defaulters Report (${targetWeek}):</b>\nThe following teachers are missing plans. Tap to send a nudge:`;
      sendTelegramMessage(chatId, report, { "inline_keyboard": missingRows });
    } else {
      sendTelegramMessage(chatId, `<b>✅ 100% Compliance:</b> All rostered teachers have submitted plans for ${targetWeek}!`);
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
    const shortSubj = parts[2];
    const teacher = parts.slice(3).join("_"); 
    const targetSheetName = shortWeek.replace("W", "Week ");
    const fullStatus = action === "APP" ? "✅ APPROVED" : "🚨 REVISION NEEDED";
    
    const rowData = updateApprovalStatus(teacher, shortSubj, targetSheetName, fullStatus);
    
    if (rowData) {
      if (action === "REV" && rowData.email) {
        sendRevisionEmail(rowData.email, teacher, targetSheetName, rowData.audit);
        responseText = `🚨 <b>Revision Requested:</b> ${teacher} has been notified for ${targetSheetName}.`;
      } else {
        responseText = `✅ <b>Status Updated:</b> ${teacher}'s ${shortSubj} plan is now ${fullStatus} on the ${targetSheetName} tab.`;
      }
    } else {
      responseText = `⚠️ <b>Error:</b> Could not find a matching row for ${teacher}'s ${shortSubj} plan on the ${targetSheetName} tab.`;
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

  sendTelegramMessage(chatId, responseText);
}
