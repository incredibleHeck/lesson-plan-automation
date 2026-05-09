/**
 * Services for Gemini AI interactions
 * Clean Architecture: Delegates all file extraction to DriveService.js
 */

/**
 * Orchestrates the AI Audit generation process.
 */
function generateAiSummary(fileLink, className, subjectName, previousFileId, resubmissionData, expectedLessons = 1) {
  if (!fileLink) return "AI Audit Skipped: No file provided.";
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
    return "AI Audit Skipped: No API Key provided.";
  }

  try {
    // 1. Delegate Extraction to DriveService
    const currentText = extractTextFromFiles(fileLink);
    if (!currentText) return "AI Audit Error: Could not extract text from current file.";
    if (currentText.startsWith("EXTRACTION ERROR")) return "AI Audit Error: " + currentText;

    // 2. Delegate Previous Text Extraction (skip bad reads so continuity isn't poisoned)
    let previousText = previousFileId ? extractTextFromFiles(previousFileId) : null;
    if (previousText && previousText.startsWith("EXTRACTION ERROR")) previousText = null;

    // 3. DYNAMIC CAMBRIDGE CRITERIA: Stack Core Pedagogy + Subject Focus
    let subjectCriteria = `
    CORE PEDAGOGY & AGE-APPROPRIATENESS:
    - Context: "Year 1" is Grade 1 (approx ages 5-6), scaling up to Year 12. Expectations must strictly match the cognitive age band for ${className}.
    - Apply active learning and age-appropriateness.
    - Explicitly flag passive learning (too much teacher-talk time) or vague success criteria when relevant.
    `;

    const subjectLower = subjectName.toLowerCase();

    if (subjectLower.includes("math")) {
      subjectCriteria += `
      MATHEMATICS FOCUS:
      - Look for the 'Thinking and Working Mathematically' (TWM) characteristics: Specialising, Generalising, Conjecturing, Convincing, Characterising, Classifying, Critiquing, or Improving.
      - Check if the lesson uses the three-step approach: concrete (objects), representational (pictures), and abstract (symbols/numbers).
      - Ensure there is a balance or clear focus on Number, Geometry and Measure, or Statistics and Probability.`;
    }
    else if (subjectLower.includes("science")) {
      subjectCriteria += `
      SCIENCE FOCUS:
      - Look for 'Thinking and Working Scientifically' skills: Models and representations, Scientific enquiry (planning, carrying out, analyzing), and Practical work.
      - Check for 'Science in Context': Does the lesson link the science to the real world or the learners' local environment?
      - Ensure practical experiments prioritize safety and active learning.`;
    }
    else if (subjectLower.includes("english") || subjectLower.includes("literacy")) {
      subjectCriteria += `
      ENGLISH FOCUS:
      - Look for cohesion between Reading, Writing, and Speaking and Listening skills.
      - If this is for lower primary (Year 1 to Year 4), check if Phonics and decoding skills are addressed.
      - Ensure grammar and punctuation are taught in context using authentic texts, rather than just isolated drills.
      - Look for opportunities that promote reading for pleasure.`;
    }
    else {
      subjectCriteria += `
      GENERAL CAMBRIDGE FOCUS:
      - Look for clear Learning Objectives, Differentiation (catering to different abilities), Formative Assessment, and a Plenary/Conclusion.
      - Ensure the pedagogy encourages critical thinking and avoids rote memorization.`;
    }

    // 4. Generate the Audit
    return generateAudit(currentText, previousText, subjectCriteria, className, subjectName, resubmissionData, expectedLessons);

  } catch (error) {
    Logger.log("AI Service Error: " + error);
    return "CRITICAL ERROR: " + error.message;
  }
}

/**
 * Core function to call Gemini API with strict formatting and context.
 */
function generateAudit(currentText, previousText, subjectCriteria, gradeLevel, subjectName, resubmissionData, expectedLessons = 1) {
  // Maintaining the advanced preview model for maximum reasoning capabilities
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent`;

  const systemInstruction =
    "You are a Cambridge-certified academic auditor for St. Adelaide International Schools. " +
    `CRITICAL TASK: The teacher is expected to submit plans for ${expectedLessons} Lessons/WK for this subject. ` +
    "You must count the distinct lesson plans/periods within the provided text. " +
    "CRITICAL RULES: " +
    "1. DO NOT write paragraphs. You must use short, punchy bullet points. " +
    "2. MAXIMUM of 3 bullet points per section (Strengths & Flags). " +
    "3. Provide a strict quantitative rating out of 10, formatted as a float (e.g., 7.5/10). " +
    "4. AUTOMATED DECISION ENGINE: A rating of 7.0 or higher is an automatic PASS. Anything 6.9 or lower is an automatic FAIL/REVISION. Be objective but firm.\n\n" +
    "Structure your response EXACTLY like this:\n\n" +
    "📖 TOPIC: [Extract the main topic of this lesson]\n" +
    "🎯 OBJECTIVES: [Extract 1-2 core Learning Objectives]\n" +
    // CRITICAL: Enforce "Lessons" / "Periods" wording so downstream Regex (Email/Telegram) parses counts reliably
    "⏱️ LESSONS DETECTED: [Found Count] Lessons / [Expected Count] Lessons\n\n" +
    "🏆 STRENGTHS:\n• [Point 1]\n• [Point 2]\n• [Point 3]\n\n" +
    "🚨 FLAGS:\n• [Point 1]\n• [Point 2]\n• [Point 3]\n\n" +
    "📊 RATING: [Float]/10\n" +
    "✅ STATUS: [If RATING is 7.0 or higher, output '✅ APPROVED'. If RATING is 6.9 or lower, output '🚨 REVISION NEEDED']";

  const safeCurrentText = currentText ? currentText.substring(0, 15000) : "No text found.";
  let userPrompt = `Audit this ${subjectName} lesson plan for ${gradeLevel}.\n\nCURRENT LESSON PLAN TEXT:\n${safeCurrentText}`;

  if (resubmissionData && resubmissionData.isResubmission && resubmissionData.previousAudit) {
    userPrompt += `\n\n⚠️ REVISION CONTEXT: This is a resubmitted lesson plan (Revision ${resubmissionData.revisionCount}). The previous draft was rejected/flagged with the following AI feedback:\n${resubmissionData.previousAudit}\n\nCRITICAL RE-AUDIT REQUIREMENT: Verify if the teacher actually fixed these specific flags. If they ignored the feedback, call it out aggressively in the FLAGS section.`;
  }

  if (previousText) {
    userPrompt = "CONTEXT: The teacher taught the following in the PREVIOUS week's lesson:\n" +
                 previousText.substring(0, 3000) +
                 "\n\n---\n\n" + userPrompt +
                 "\n\nCRITICAL AUDIT REQUIREMENT: Evaluate if the current lesson accurately builds upon the previous lesson's context (Subject Continuity). If continuity is broken, mention it in the FLAGS section.";
  }

  const payload = {
    "systemInstruction": { "parts": [{"text": systemInstruction}] },
    "contents": [
      {
        "parts": [
          { "text": userPrompt },
          { "text": `Ensure the audit aligns with these standards: ${subjectCriteria}` }
        ]
      }
    ],
    "generationConfig": { "temperature": 0.2, "topK": 32, "topP": 0.95 }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "headers": { "x-goog-api-key": CONFIG.GEMINI_API_KEY },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  let response;
  let maxRetries = 3;
  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
    try {
      response = UrlFetchApp.fetch(apiUrl, options);
      const responseCode = response.getResponseCode();
      if (responseCode === 503 || responseCode === 429) throw new Error("High Demand / Rate Limit");
      success = true;
    } catch (e) {
      attempt++;
      Logger.log(`Gemini API Error (Attempt ${attempt}/${maxRetries}): ${e.message}`);
      if (attempt >= maxRetries) return "⚠️ PENDING API RETRY: Gemini API is currently overloaded.";
      Utilities.sleep(Math.pow(2, attempt) * 1000);
    }
  }

  try {
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    let json;
    try { json = JSON.parse(responseText); } catch (parseErr) { return "GEMINI REJECTED: Invalid JSON response from server."; }
    if (responseCode !== 200) return "GEMINI REJECTED: " + (json.error ? json.error.message : "Unknown API Error");
    if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
      return json.candidates[0].content.parts[0].text;
    } else {
      return "AI Audit Error: No response content.";
    }
  } catch (err) {
    return "CRITICAL SCRIPT ERROR: " + err.message;
  }
}
