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
        // Drive API v3: copy no longer converts Word → use create(blob) to force Google Doc conversion
        tempDocFile = Drive.Files.create(resource, originalFile.getBlob());

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
 * Native Google Docs: DocumentApp body, then plain-text export fallback.
 * Word/PDF: Drive.Files.create converts to Google Doc; text read via repeated Drive export (avoids DocumentApp "ghost" empty bodies).
 */
function extractTextFromFiles(rawLinkString) {
  if (!rawLinkString) return null;

  const matches = rawLinkString.match(/[-\w]{25,}/g);
  if (!matches || matches.length === 0) return null;

  function driveApiWithRetry(thunk) {
    let apiAttempt = 0;
    while (apiAttempt < 3) {
      try {
        return thunk();
      } catch (apiErr) {
        apiAttempt++;
        if (apiAttempt >= 3) throw apiErr;
        Utilities.sleep(apiAttempt * 3000);
      }
    }
  }

  /**
   * Poll converted Google Doc by exporting plain text (more reliable than DocumentApp right after upload).
   */
  function pollForText(docId) {
    let extracted = "";
    let attempts = 0;

    Utilities.sleep(3000);

    while (attempts < 5) {
      try {
        extracted = exportGoogleDocPlainText_(docId);
        if (extracted && extracted.trim().length > 0) break;
      } catch (e) {
        Logger.log("Polling attempt " + (attempts + 1) + " failed: " + e.message);
      }
      Utilities.sleep(4000);
      attempts++;
    }
    return extracted;
  }

  function exportGoogleDocPlainText_(id) {
    const url =
      "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(id) +
      "/export?mimeType=text%2Fplain";
    const options = {
      method: "get",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      },
      muteHttpExceptions: true,
    };
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      throw new Error("Direct export failed: " + response.getContentText());
    }
    return response.getContentText();
  }

  let combinedText = "";
  let errorLog = "";

  for (let i = 0; i < matches.length; i++) {
    const fileId = matches[i];
    let tempDocFile = null;

    try {
      if (i > 0) Utilities.sleep(3000);

      let file;
      try {
        file = DriveApp.getFileById(fileId);
      } catch (e) {
        throw new Error("Cannot access file (Check Drive sharing permissions)");
      }

      const mimeType = file.getMimeType();
      const fileName = file.getName();
      const isGoogleDoc = mimeType === MimeType.GOOGLE_DOCS;
      const isWord =
        mimeType === MimeType.MICROSOFT_WORD || mimeType === MimeType.MICROSOFT_WORD_LEGACY;
      const isPDF = mimeType === MimeType.PDF;

      if (!isGoogleDoc && !isWord && !isPDF) {
        throw new Error(
          `Unsupported file type (${mimeType}). Please submit a Google Doc, Word document, or PDF.`
        );
      }

      if (isGoogleDoc) {
        let text = DocumentApp.openById(fileId).getBody().getText();
        if (!text || text.trim().length === 0) {
          try {
            text = exportGoogleDocPlainText_(fileId);
          } catch (fallbackErr) {
            Logger.log("Plain text export fallback failed: " + fallbackErr.message);
          }
        }
        if (text && text.trim().length > 0) {
          combinedText += text + "\n\n";
        } else {
          errorLog +=
            `[File ${i + 1} (${fileName}): Google Doc body is completely empty. ` +
            `Ensure text is not only in floating images/shapes] `;
        }
        continue;
      }

      let text = "";
      const resource = { name: "Temp_Convert_" + fileId, mimeType: MimeType.GOOGLE_DOCS };

      if (isWord || isPDF) {
        const blob = file.getBlob();
        tempDocFile = driveApiWithRetry(function () {
          return Drive.Files.create(resource, blob);
        });
        text = pollForText(tempDocFile.id);
      }

      if (text && text.trim().length > 0) {
        combinedText += text + "\n\n";
      } else if (!isGoogleDoc) {
        errorLog +=
          `[File ${i + 1} (${fileName}): Conversion completed but text remained empty. MIME: ${mimeType}] `;
      }
    } catch (err) {
      errorLog += `[File ${i + 1} Failed: ${err.message}] `;
    } finally {
      if (tempDocFile && tempDocFile.id) {
        try {
          DriveApp.getFileById(tempDocFile.id).setTrashed(true);
        } catch (e) { /* ignore */ }
      }
    }
  }

  if (combinedText.trim().length === 0) {
    return "EXTRACTION ERROR: " + errorLog;
  }
  return combinedText;
}
