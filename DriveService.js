/**
 * Services for Google Drive interactions
 * Handles folder structure, file conversion, and OCR Text Extraction.
 */

function getRootFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.MASTER_FOLDER_NAME);
  let masterFolder;

  if (folders.hasNext()) {
    masterFolder = folders.next();
  } else {
    masterFolder = DriveApp.createFolder(CONFIG.MASTER_FOLDER_NAME);
  }

  try {
    const editors = [CONFIG.HOD_EMAILS.VP, CONFIG.HOD_EMAILS.LOWER, CONFIG.HOD_EMAILS.UPPER];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    editors.forEach(email => {
      if (email) {
        masterFolder.addEditor(email);
        ss.addEditor(email);
      }
    });
  } catch (err) {
    Logger.log("Permission sync failed: " + err.message);
  }
  return masterFolder;
}

function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
}

/**
 * Moves file(s) to chronological folder structure and standardizes the name.
 * Handles Multiple Files, protects against Memory limits using Copy, and converts Word to PDF.
 */
function processDriveFile(fileUrl, weekName, className, subjectName, teacherName) {
  if (!fileUrl) return null;

  const masterFolder = getRootFolder();
  const weekFolder = getOrCreateFolder(masterFolder, weekName);
  const classFolder = getOrCreateFolder(weekFolder, className);

  // DYNAMIC FIX: Find ALL comma-separated file IDs
  const fileIds = fileUrl.match(/[-\w]{25,}/g);
  if (!fileIds || fileIds.length === 0) return null;

  let processedIds = [];

  for (let i = 0; i < fileIds.length; i++) {
    const fileId = fileIds[i];
    let tempDocFile = null;

    try {
      const originalFile = DriveApp.getFileById(fileId);
      const mimeType = originalFile.getMimeType();

      const suffix = fileIds.length > 1 ? ` (Part ${i + 1})` : "";
      const newBaseName = `${subjectName} - ${teacherName}${suffix}`;

      let finalFile;

      if (mimeType === MimeType.PDF) {
        finalFile = originalFile.makeCopy(`${newBaseName}.pdf`, classFolder);
      }
      else if (mimeType === MimeType.GOOGLE_DOCS) {
        const pdfBlob = originalFile.getAs(MimeType.PDF);
        pdfBlob.setName(`${newBaseName}.pdf`);
        finalFile = classFolder.createFile(pdfBlob);
      }
      else if (mimeType === MimeType.MICROSOFT_WORD || mimeType === MimeType.MICROSOFT_WORD_LEGACY) {
        const resource = { name: "Temp_Conversion_" + newBaseName, mimeType: MimeType.GOOGLE_DOCS };
        // CRITICAL FIX: Memory Safe conversion
        tempDocFile = Drive.Files.copy(resource, fileId);

        const pdfBlob = DriveApp.getFileById(tempDocFile.id).getAs(MimeType.PDF);
        pdfBlob.setName(`${newBaseName}.pdf`);
        finalFile = classFolder.createFile(pdfBlob);
      }
      else {
        finalFile = originalFile.makeCopy(newBaseName, classFolder);
      }

      processedIds.push(finalFile.getId());

    } catch (e) {
      Logger.log(`Drive Filing Error for ${teacherName} (File ${i+1}): ${e.message}`);
      if (e.message.includes("permission") || e.message.includes("Access denied")) {
        throw new Error(`FILE LOCKED: Tell teacher to change Google Drive link to 'Anyone with the link can view'.`);
      }
    } finally {
      if (tempDocFile && tempDocFile.id) {
        try { DriveApp.getFileById(tempDocFile.id).setTrashed(true); } catch (err) {}
      }
    }
  }
  return processedIds.join(",");
}

/**
 * Extracts text from one or multiple file links.
 * Uses a HYBRID approach: Copy for Word Docs, Blob+OCR for PDFs/Images.
 */
function extractTextFromFiles(rawLinkString) {
  if (!rawLinkString) return null;

  const matches = rawLinkString.match(/[-\w]{25,}/g);
  if (!matches || matches.length === 0) return null;

  let combinedText = "";
  let errorLog = "";

  for (let i = 0; i < matches.length; i++) {
    const fileId = matches[i];
    let tempDocFile = null;

    try {
      // 🛡️ ANTI-RATE-LIMIT: Pause for 3 seconds before processing multiple files
      if (i > 0) Utilities.sleep(3000);

      let file;
      try {
        file = DriveApp.getFileById(fileId);
      } catch(e) {
        throw new Error("Cannot access file (Check Drive sharing permissions)");
      }

      const mimeType = file.getMimeType();

      // SCENARIO 1: ALREADY A GOOGLE DOC
      if (mimeType === MimeType.GOOGLE_DOCS) {
        combinedText += DocumentApp.openById(fileId).getBody().getText() + "\n\n";
        continue;
      }

      let text = "";
      let resource = { name: "Temp_OCR_" + fileId, mimeType: MimeType.GOOGLE_DOCS };

      // 🛡️ API RETRY LOOP
      let apiAttempt = 0;
      let apiSuccess = false;

      while (apiAttempt < 3 && !apiSuccess) {
        try {
          // SCENARIO 2: WORD DOC (Memory limit bypass)
          if (mimeType === MimeType.MICROSOFT_WORD || mimeType === MimeType.MICROSOFT_WORD_LEGACY) {
            tempDocFile = Drive.Files.copy(resource, fileId);
          }
          // SCENARIO 3: PDF OR IMAGE (Force OCR)
          else {
            const blob = file.getBlob();
            resource.name = "Temp_OCR_" + file.getName();
            tempDocFile = Drive.Files.create(resource, blob, {ocr: true});
          }
          apiSuccess = true;
        } catch (apiErr) {
          apiAttempt++;
          if (apiAttempt >= 3) throw apiErr;
          Utilities.sleep(apiAttempt * 3000);
        }
      }

      // ⏱️ WAIT FOR GOOGLE TO FINISH THE TEXT CONVERSION
      let readAttempts = 0;
      const maxReadAttempts = 6;

      while (readAttempts < maxReadAttempts) {
        Utilities.sleep(5000);
        try {
          const tempDoc = DocumentApp.openById(tempDocFile.id);
          text = tempDoc.getBody().getText();
          if (text && text.trim().length > 0) break;
        } catch (e) { }
        readAttempts++;
      }

      if (text && text.trim().length > 0) {
        combinedText += text + "\n\n";
      } else {
        if (mimeType.includes("image")) {
           errorLog += `[File ${i+1} is an image but Google OCR couldn't read the handwriting/text] `;
        } else {
           errorLog += `[File ${i+1} converted but text remained empty] `;
        }
      }

    } catch (err) {
      errorLog += `[File ${i+1} Failed: ${err.message}] `;
    } finally {
      if (tempDocFile && tempDocFile.id) {
        try { DriveApp.getFileById(tempDocFile.id).setTrashed(true); } catch(e){}
      }
    }
  }

  if (combinedText.trim().length === 0) {
    return "EXTRACTION ERROR: Google converted the files but found zero text. " + errorLog;
  }
  return combinedText;
}
