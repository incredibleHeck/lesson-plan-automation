/**
 * Services for Gemini AI interactions
 */

/**
 * Extracts text from a file and asks Gemini to audit it based on subject-specific Cambridge Standards.
 * @param {string} fileId The ID of the file to audit.
 * @param {string} className The class name for context (e.g., Year 1 Benjamin).
 * @param {string} subjectName The subject name for context.
 * @returns {string} The AI-generated summary and compliance check.
 */
function generateAiSummary(fileId, className, subjectName) {
  if (!fileId) return "AI Audit Skipped: No file provided.";
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
    return "AI Audit Skipped: No API Key provided.";
  }

  try {
    // 1. Extract Text using Drive OCR
    // This requires the Drive API Advanced Service (v3) to be enabled!
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    
    const resource = {
      name: "Temp_OCR_" + file.getName(), 
      mimeType: MimeType.GOOGLE_DOCS // FORCE CONVERSION to Google Doc so DocumentApp can read it
    };
    
    // Create the temporary Google Doc with OCR enabled
    const tempDocFile = Drive.Files.create(resource, blob, {ocr: true});
    
    // CRITICAL: Pause for 6 seconds to allow OCR processing time
    Utilities.sleep(6000);
    
    const tempDoc = DocumentApp.openById(tempDocFile.id);
    const documentText = tempDoc.getBody().getText();
    
    // Clean up the temporary file immediately
    DriveApp.getFileById(tempDocFile.id).setTrashed(true);

    // 2. DYNAMIC CAMBRIDGE CRITERIA: The AI adapts based on the subject
    let subjectCriteria = "";
    const subjectLower = subjectName.toLowerCase();
    
    if (subjectLower.includes("math")) {
      subjectCriteria = `
      MATHEMATICS FOCUS:
      - Look for the 'Thinking and Working Mathematically' (TWM) characteristics: Specialising, Generalising, Conjecturing, Convincing, Characterising, Classifying, Critiquing, or Improving.
      - Check if the lesson uses the three-step approach: concrete (objects), representational (pictures), and abstract (symbols/numbers).
      - Ensure there is a balance or clear focus on Number, Geometry and Measure, or Statistics and Probability.`;
    } 
    else if (subjectLower.includes("science")) {
      subjectCriteria = `
      SCIENCE FOCUS:
      - Look for 'Thinking and Working Scientifically' skills: Models and representations, Scientific enquiry (planning, carrying out, analyzing), and Practical work.
      - Check for 'Science in Context': Does the lesson link the science to the real world or the learners' local environment?
      - Ensure practical experiments prioritize safety and active learning.`;
    } 
    else if (subjectLower.includes("english") || subjectLower.includes("literacy")) {
      subjectCriteria = `
      ENGLISH FOCUS:
      - Look for cohesion between Reading, Writing, and Speaking and Listening skills.
      - If this is for lower primary (Year 1 to Year 4), check if Phonics and decoding skills are addressed.
      - Ensure grammar and punctuation are taught in context using authentic texts, rather than just isolated drills.
      - Look for opportunities that promote reading for pleasure.`;
    }
    else {
      subjectCriteria = `
      GENERAL CAMBRIDGE FOCUS:
      - Look for clear Learning Objectives, Active Learning (student-led tasks), Differentiation (catering to different abilities), Formative Assessment, and a Plenary/Conclusion.
      - Ensure the pedagogy encourages critical thinking and avoids rote memorization.`;
    }

    const systemInstruction =
      "You are a Cambridge-certified academic auditor for St. Adelaide Schools. " +
      "Review this lesson plan and provide an EXTREMELY concise audit. " +
      "CRITICAL RULES: " +
      "1. DO NOT write paragraphs. You must use short, punchy bullet points. " +
      "2. Maximum of 2 bullet points per section. " +
      "3. Structure your response exactly like this:\n\n" +
      "🏆 STRENGTHS:\n• [Point 1]\n• [Point 2]\n\n" +
      "🚨 FLAGS:\n• [Point 1]\n• [Point 2]\n\n" +
      "✅ STATUS: [Approved or Needs Revision]";

    const userPrompt =
      `Audit this ${subjectName} lesson plan for ${className}.

Context: "Year 1" is Grade 1 (approx ages 5–6), through Year 12. Expectations must match the age band for ${className}.
Apply active learning and age-appropriateness; flag passive teacher-talk or vague success criteria when relevant.

Cambridge criteria for this subject:
${subjectCriteria}

LESSON PLAN TEXT:
${documentText}`;

    // 3. Call the Gemini API
    // Upgraded to gemini-3.1-pro-preview for state-of-the-art Cambridge-style audits.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const payload = {
      "systemInstruction": {
        "parts": [{"text": systemInstruction}]
      },
      "contents": [{"parts": [{"text": userPrompt}]}],
      "generationConfig": {
        "temperature": 0.2 // Keeps the AI highly analytical and strict
      }
    };
    
    const options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true // CRITICAL FIX: Allows us to read the error body
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      Logger.log("Gemini API Error: " + responseText);
      const errorData = JSON.parse(responseText);
      const errorMessage = errorData.error ? errorData.error.message : "Unknown API Error";
      return "GEMINI REJECTED: " + errorMessage; 
    }

    const json = JSON.parse(responseText);
    if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
      return json.candidates[0].content.parts[0].text;
    } else {
      return "AI Audit Error: No response content.";
    }
    
  } catch (error) {
    Logger.log("AI Service Error: " + error);
    return "CRITICAL SCRIPT ERROR: " + error.message;
  }
}
