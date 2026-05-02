/**
 * Services for Gemini AI interactions
 * NOTE: This service requires the "Drive API" Advanced Service (v3) to be enabled
 * in the Apps Script Editor (Services > + > Drive API).
 */

/**
 * Orchestrates the extraction of text and calls the Gemini AI to generate an audit.
 * @param {string} fileId The ID of the current file to audit.
 * @param {string} className The class name for context (e.g., Year 1 Benjamin).
 * @param {string} subjectName The subject name for context.
 * @param {string} previousFileId The ID of the previous week's file (optional).
 * @returns {string} The AI-generated summary and compliance check.
 */
function generateAiSummary(fileId, className, subjectName, previousFileId) {
  if (!fileId) return "AI Audit Skipped: No file provided.";
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
    return "AI Audit Skipped: No API Key provided.";
  }

  try {
    // 1. Extract Text from Current File
    const currentText = extractTextFromPdf(fileId);
    if (!currentText) return "AI Audit Error: Could not extract text from current file.";

    // 2. Extract Text from Previous File (if provided)
    const previousText = previousFileId ? extractTextFromPdf(previousFileId) : null;

    // 3. DYNAMIC CAMBRIDGE CRITERIA: Stack Core Pedagogy + Subject Focus
    
    // BASELINE: This applies to ALL subjects
    let subjectCriteria = `
    CORE PEDAGOGY & AGE-APPROPRIATENESS:
    - Context: "Year 1" is Grade 1 (approx ages 5-6), scaling up to Year 12. Expectations must strictly match the cognitive age band for ${className}.
    - Apply active learning and age-appropriateness.
    - Explicitly flag passive learning (too much teacher-talk time) or vague success criteria when relevant.
    `;

    // SUBJECT SPECIFIC: Add the extra layer based on what class it is
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
    return generateAudit(currentText, previousText, subjectCriteria, className, subjectName);

  } catch (error) {
    Logger.log("AI Service Error: " + error);
    return "CRITICAL ERROR: " + error.message;
  }
}

/**
 * Core function to call Gemini 3.1 Pro Preview with strict formatting and context.
 */
function generateAudit(currentText, previousText, subjectCriteria, gradeLevel, subjectName) {
  // SECURED: API key moved to Header
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent`;
  
  const systemInstruction = 
    "You are a Cambridge-certified academic auditor for St. Adelaide International Schools. " +
    "Review this lesson plan and provide an EXTREMELY concise audit. " +
    "CRITICAL RULES: " +
    "1. DO NOT write paragraphs. You must use short, punchy bullet points. " +
    "2. MAXIMUM of 3 bullet points per section (Strengths & Flags). " +
    "3. Provide a strict quantitative rating out of 10, formatted as a float (e.g., 7.5/10). " +
    "4. Structure your response EXACTLY like this:\n\n" +
    "📖 TOPIC: [Extract the main topic of this lesson]\n" +
    "🎯 OBJECTIVES: [Extract 1-2 core Learning Objectives]\n\n" +
    "🏆 STRENGTHS:\n• [Point 1]\n• [Point 2]\n• [Point 3]\n\n" +
    "🚨 FLAGS:\n• [Point 1]\n• [Point 2]\n• [Point 3]\n\n" +
    "📊 RATING: [Float]/10\n" +
    "✅ STATUS: [Approved or Needs Revision]";

  // Apply a 15,000 character safety cap to prevent payload/token crashes
  const safeCurrentText = currentText ? currentText.substring(0, 15000) : "No text found.";
  let userPrompt = `Audit this ${subjectName} lesson plan for ${gradeLevel}.\n\nCURRENT LESSON PLAN TEXT:\n${safeCurrentText}`;

  // Inject the previous week's context if it exists (capped at 3,000 chars)
  if (previousText) {
    userPrompt = "CONTEXT: The teacher taught the following in the PREVIOUS week's lesson:\n" + 
                 previousText.substring(0, 3000) + 
                 "\n\n---\n\n" + userPrompt + 
                 "\n\nCRITICAL AUDIT REQUIREMENT: Evaluate if the current lesson accurately builds upon the previous lesson's context (Subject Continuity). If continuity is broken, mention it in the FLAGS section.";
  }

  const payload = {
    "systemInstruction": {
      "parts": [{"text": systemInstruction}]
    },
    "contents": [
      {
        "parts": [
          { "text": userPrompt },
          { "text": `Ensure the audit aligns with these standards: ${subjectCriteria}` }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.2, 
      "topK": 32,
      "topP": 0.95
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "x-goog-api-key": CONFIG.GEMINI_API_KEY
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true 
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    // SECURED: Safe JSON parsing
    let json;
    try {
      json = JSON.parse(responseText);
    } catch (parseErr) {
      Logger.log("Gemini API Error (Invalid JSON): " + responseText);
      return "GEMINI REJECTED: Invalid JSON response from server.";
    }

    if (responseCode !== 200) {
      Logger.log("Gemini API Error: " + responseText);
      return "GEMINI REJECTED: " + (json.error ? json.error.message : "Unknown API Error"); 
    }

    if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
      return json.candidates[0].content.parts[0].text;
    } else {
      return "AI Audit Error: No response content.";
    }

  } catch (err) {
    return "CRITICAL SCRIPT ERROR: " + err.message;
  }
}

/**
 * Extracts text from a PDF file using Drive OCR (Requires Advanced Drive Service enabled)
 * @param {string} fileId The ID of the file to extract text from.
 * @returns {string} The extracted text.
 */
function extractTextFromPdf(fileId) {
  if (!fileId) return null;
  
  let tempDocFile = null;
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    
    const resource = {
      title: "Temp_OCR_" + file.getName(), // Compatibility for Drive API v2
      name: "Temp_OCR_" + file.getName(),  // Compatibility for Drive API v3
      mimeType: MimeType.GOOGLE_DOCS // FORCE CONVERSION to Google Doc so DocumentApp can read it
    };
    
    // Create the temporary Google Doc with OCR enabled
    tempDocFile = Drive.Files.create(resource, blob, {ocr: true});
    
    let text = "";
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      Utilities.sleep(4000); 
      try {
        const tempDoc = DocumentApp.openById(tempDocFile.id);
        text = tempDoc.getBody().getText();
        if (text && text.trim().length > 0) break; 
      } catch (e) {
      }
      attempts++;
    }
    
    return text;
    
  } catch (err) {
    Logger.log("OCR Error: " + err.message);
    return null;
  } finally {
    if (tempDocFile && tempDocFile.id) {
      try {
        DriveApp.getFileById(tempDocFile.id).setTrashed(true);
      } catch (cleanupErr) {
        Logger.log("Failed to trash temp OCR file: " + cleanupErr.message);
      }
    }
  }
}
