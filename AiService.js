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
    
    // CRITICAL: Pause for 3 seconds to allow OCR processing time
    Utilities.sleep(3000);
    
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

    // 3. THE MASTER PROMPT
    const prompt = `You are a strict but constructive Cambridge Curriculum Coordinator and Academic Auditor for VP Theodora Hammond at St. Adelaide International School.
    
    You are reviewing a ${subjectName} lesson plan specifically written for ${className}. 
    
    CRITICAL CONTEXT: 
    In our system, "Year 1" is Grade 1 (approx 5-6 years old), "Year 2" is Grade 2 (approx 6-7 years old), scaling up to Year 12. Adjust your academic expectations precisely to the age group of ${className}.

    EVALUATION CRITERIA:
    1. Cambridge Standards: Review the text against these specific requirements: ${subjectCriteria}
    2. Age Appropriateness: Are the vocabulary, duration of tasks, and cognitive demands suitable for ${className}? Flag it if it is too advanced or too childish.
    3. Pedagogical Flaws: Look for Active Learning. Flag passive learning (too much teacher-talking time) or poorly defined success criteria.

    Format your response EXACTLY using this template:

    📊 EXECUTIVE SUMMARY:
    [1-2 sentences summarizing the core lesson and objective.]

    🧠 AGE & CAMBRIDGE ALIGNMENT:
    [Brief paragraph: Is it appropriate for ${className}? Are the specific Cambridge methodologies for ${subjectName} visible? Explain why or why not.]

    🚨 FLAGS & MISSING ELEMENTS:
    [Bullet points listing any missing Cambridge sections, missing safety protocols (for science), missing active learning, or pedagogical flaws. If perfect, write "None. All required sections present."]

    ✅ COMPLIANCE STATUS:
    [State ONLY "PASS" or "NEEDS REVISION"]

    LESSON PLAN TEXT:
    ${documentText}`; // Removed 15k limit for Pro model

    // 4. Call the Gemini API
    // Using gemini-1.5-pro as the official mapping for the Pro reasoning tier
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const payload = {
      "contents": [{"parts": [{"text": prompt}]}],
      "generationConfig": {
        "temperature": 0.2 // Keeps the AI highly analytical and strict
      }
    };
    
    const options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const data = JSON.parse(response.getContentText());
    
    if (data.error) {
      Logger.log("API Error: " + data.error.message);
      return "AI Audit Failed: API Error.";
    }

    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
      return data.candidates[0].content.parts[0].text;
    } else {
      return "AI Audit Error: No response content.";
    }
    
  } catch (error) {
    Logger.log("AI Service Error: " + error);
    return "CRITICAL ERROR: " + error.message;
  }
}
