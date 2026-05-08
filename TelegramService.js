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
 * Safely escapes HTML special characters for Telegram's brittle parser.
 */
function escapeHTML(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
function sendAuditAlert(teacherName, className, subjectName, auditText, hodName, timestamp, latenessStatus, weekString, revisionCount = 0) {
  const formattedTime = Utilities.formatDate(timestamp, "Africa/Accra", "MMM d, yyyy 'at' h:mm a");

  // Sanitize the raw AI text FIRST to prevent HTML injection crashes
  let cleanAudit = escapeHTML(auditText);
  // Then safely apply bolding for Markdown-like double asterisks
  cleanAudit = cleanAudit.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  cleanAudit = cleanAudit.replace(/\*/g, "");

  let partialWarning = "";
  const match = cleanAudit.match(/LESSONS DETECTED:\s*(\d+)\s*\/\s*(\d+)/i);

  if (match) {
    const found = parseInt(match[1], 10);
    const expected = parseInt(match[2], 10);
    if (found < expected) {
      partialWarning = `\n\n⚠️ <b>PARTIAL SUBMISSION WARNING:</b> Teacher submitted ${found} lessons, but ${expected} Lessons/WK are required!`;
    }
  }

  const headerTitle = revisionCount > 0
      ? `<b>🚨 [RESUBMISSION - REVISION ${revisionCount}]</b>`
      : `<b>🚨 Lesson Plan Submitted</b>`;

  const message = `${headerTitle}${partialWarning}\n\n` +
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
  
  const safeHodName = hodName ? hodName.toString() : "";
  if (safeHodName.includes(CONFIG.HOD_NAMES.LOWER) && CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD, message, approvalKeyboard);
  } else if (safeHodName.includes(CONFIG.HOD_NAMES.UPPER) && CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD) {
    sendTelegramMessage(CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD, message, approvalKeyboard);
  }
}

/**
 * Handles incoming Slash Commands.
 * SECURED: Includes an Allowlist check to ensure only leadership can run commands.
 */
function handleSlashCommand(message) {
  const text = message.text;
  const chatId = String(message.chat.id);

  // SECURITY: The Allowlist Check
  const allowedIds = [
    String(CONFIG.TELEGRAM.CHAT_ID_VP),
    String(CONFIG.TELEGRAM.CHAT_ID_LOWER_HOD),
    String(CONFIG.TELEGRAM.CHAT_ID_UPPER_HOD)
  ];

  if (!allowedIds.includes(chatId)) {
    Logger.log(`Unauthorized slash command attempt from Chat ID: ${chatId}`);
    return; // Silently drop unauthorized requests
  }

  if (text.startsWith("/defaulters")) {
    const parts = text.split(" ");
    let targetWeek = "";
    
    if (parts.length > 1) {
      targetWeek = parts.slice(1).join(" ");
    } else {
      // Autonomously determine the target week from the calendar tab
      targetWeek = getTargetWeekFromSchedule();
      if (!targetWeek) {
        sendTelegramMessage(chatId, `⚠️ <b>Error:</b> Could not determine the current week from the Term Schedule. Please specify manually (e.g., /defaulters Week 4).`);
        return;
      }
    }

    sendTelegramMessage(chatId, `⏳ Scanning ${targetWeek} for defaulters...`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const weeklySheet = ss.getSheetByName(targetWeek);
    
    if (!weeklySheet) {
      sendTelegramMessage(chatId, `⚠️ <b>Error:</b> Could not find a tab named '${targetWeek}'.`);
      return;
    }

    const submissionData = weeklySheet.getDataRange().getValues();
    
    // 1. Build a Map of what WAS submitted and count detected lessons
    let submittedMap = new Map();
    for (let i = 1; i < submissionData.length; i++) {
      const teacher = submissionData[i][CONFIG.INDICES.TEACHER_NAME];
      const classLevel = submissionData[i][CONFIG.INDICES.CLASS];
      const subject = submissionData[i][CONFIG.INDICES.SUBJECT];
      const auditText = submissionData[i][CONFIG.INDICES.AI_AUDIT] ? submissionData[i][CONFIG.INDICES.AI_AUDIT].toString() : "";
      
      if (teacher && classLevel && subject) {
        const subKey = `${teacher}_${classLevel}_${subject}`.toLowerCase().replace(/\s+/g, '');
        
        let foundLessons = 0;
        const match = auditText.match(/LESSONS DETECTED:\s*(\d+)/i);
        if (match) {
          foundLessons = parseInt(match[1], 10);
        } else if (auditText.length > 10) { 
          foundLessons = 1; // Fallback if AI missed strict formatting but still audited
        }

        // If multiple submissions exist, keep the highest detected number
        const currentFound = submittedMap.get(subKey) || 0;
        submittedMap.set(subKey, Math.max(currentFound, foundLessons));
      }
    }

    // 2. Cross-reference with Teaching Load Matrix
    const teachingLoad = getTeachingLoad(); 
    let missingByTeacher = {}; 

    teachingLoad.forEach(load => {
      // Skip empty/placeholder rows in the teaching load matrix
      if (!load.className || !load.subjectName) return;

      const loadKey = `${load.teacherName}_${load.className}_${load.subjectName}`.toLowerCase().replace(/\s+/g, '');
      const expectedLessons = load.expectedLessons || 1;
      const foundLessons = submittedMap.has(loadKey) ? submittedMap.get(loadKey) : 0;

      // Flag if missing entirely OR partially incomplete
      if (foundLessons < expectedLessons) {
        if (!missingByTeacher[load.teacherName]) {
          missingByTeacher[load.teacherName] = [];
        }
        
        if (foundLessons === 0) {
          missingByTeacher[load.teacherName].push(`   ❌ ${load.subjectName} (${load.className})`);
        } else {
          missingByTeacher[load.teacherName].push(`   ⚠️ ${load.subjectName} (${load.className}) - Partial: ${foundLessons}/${expectedLessons} done`);
        }
      }
    });

    // 3. Build the Telegram UI Payload (No Buttons)
    let reportLines = [];
    
    Object.keys(missingByTeacher).forEach(teacher => {
      // Join the items directly since they already have ❌ or ⚠️ emojis from Step 2
      const missingItems = missingByTeacher[teacher].join("\n");
      
      // Build the text block for the teacher with the nested list
      reportLines.push(`• <b>${teacher}</b>: \n${missingItems}\n`);
    });

    // 4. Send the final report
    if (reportLines.length > 0) {
      // Send just the text report, no inline keyboard
      const report = `<b>📊 Defaulters Report (${targetWeek}):</b>\n\n${reportLines.join("\n")}`;
      sendTelegramMessage(chatId, report);
    } else {
      sendTelegramMessage(chatId, `<b>✅ 100% Compliance:</b> All rostered teachers have submitted their complete teaching load for ${targetWeek}!`);
    }
    
  } else if (text.startsWith("/status")) {
    sendTelegramMessage(chatId, "🟢 <b>St. Adelaide Ops Bot:</b> Fully operational and monitoring lesson plans.");
  }
}

/**
 * Handles Button Clicks from the leadership team.
 * SECURED: Includes an Allowlist check to ensure only authorized leadership can click buttons.
 */
function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const clickerId = String(callbackQuery.from.id); // Who actually clicked the button?

  // SECURITY: Ensure the person clicking is authorized leadership (Personal User IDs)
  const allowedIds = CONFIG.TELEGRAM.AUTHORIZED_USER_IDS;

  if (!allowedIds.includes(clickerId)) {
    // Flash a warning on the unauthorized user's screen
    const answerUrl = `https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/answerCallbackQuery`;
    UrlFetchApp.fetch(answerUrl, {
      method: "post",
      payload: { 
        callback_query_id: callbackQuery.id, 
        text: "⛔ Unauthorized: Only leadership can perform this action.", 
        show_alert: true 
      }
    });
    return; // Exit immediately
  }
  
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
      // Tell Telegram to remove the inline keyboard from the message
      const removeButtonsUrl = `https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/editMessageReplyMarkup`;
      UrlFetchApp.fetch(removeButtonsUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: { inline_keyboard: [] } 
        })
      });

      if (action === "REV") {
        sendRevisionEmail(teacher, targetSheetName, rowData.audit);
        responseText = `🚨 <b>Revision Requested:</b> ${teacher} has been notified for ${targetSheetName}.`;
      } else {
        responseText = `✅ <b>Status Updated:</b> ${teacher}'s ${shortSubj} plan is now ${fullStatus} on the ${targetSheetName} tab.`;
      }
    } else {
      responseText = `⚠️ <b>Error:</b> Could not find a matching row for ${teacher}'s ${shortSubj} plan on the ${targetSheetName} tab.`;
    }
  } else if (action === "NUDGE") {
    const teacher = parts[1];
    sendNudgeEmail(teacher, "the current week");
    responseText = `✉️ <b>Nudge Sent:</b> An urgent reminder was emailed to ${teacher}, copying their HOD.`;
  }

  sendTelegramMessage(chatId, responseText);
}
