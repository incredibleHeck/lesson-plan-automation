/**
 * Services for Google Drive interactions
 */

/**
 * Core Setup: Finds the master folder. If missing, creates it and auto-shares it.
 * Verifies leadership permissions on every access.
 */
function getRootFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.MASTER_FOLDER_NAME);
  let masterFolder;

  if (folders.hasNext()) {
    masterFolder = folders.next();
  } else {
    masterFolder = DriveApp.createFolder(CONFIG.MASTER_FOLDER_NAME);
  }

  // Ensure leadership always has access (Self-healing permissions)
  try {
    const editors = [
      CONFIG.HOD_EMAILS.VP,
      CONFIG.HOD_EMAILS.LOWER,
      CONFIG.HOD_EMAILS.UPPER
    ];
    
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

/**
 * Helper: Finds a folder or creates it if missing
 */
function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

/**
 * Moves file to chronological folder structure and standardizes the name.
 * Handles "Move vs Copy" permission barriers and CONVERTS TO PDF if needed.
 */
function processDriveFile(fileUrl, weekName, className, subjectName, teacherName) {
  if (!fileUrl) return null;

  const masterFolder = getRootFolder();
  const weekFolder = getOrCreateFolder(masterFolder, weekName);
  const classFolder = getOrCreateFolder(weekFolder, className);

  const fileIdMatch = fileUrl.match(/[-\w]{25,}/);
  const fileId = fileIdMatch ? fileIdMatch[0] : null;
  if (!fileId) return null;

  let tempDocFile = null;

  try {
    const originalFile = DriveApp.getFileById(fileId);
    const mimeType = originalFile.getMimeType();
    const newBaseName = `${subjectName} - ${teacherName}`;
    
    let finalFile;

    // SCENARIO 1: It's already a PDF
    if (mimeType === MimeType.PDF) {
      finalFile = originalFile.makeCopy(`${newBaseName}.pdf`, classFolder);
    } 
    // SCENARIO 2: It's a Word Doc or Google Doc (The "Bridge" Logic)
    else {
      // 1. Convert to a temporary Google Doc to stabilize formatting
      const resource = {
        name: "Temp_Conversion_" + newBaseName,
        mimeType: MimeType.GOOGLE_DOCS
      };
      
      // Use the Advanced Drive Service to create the conversion
      tempDocFile = Drive.Files.create(resource, originalFile.getBlob());
      
      // 2. Now export that stable Google Doc to a PDF in the destination folder
      const pdfBlob = DriveApp.getFileById(tempDocFile.id).getAs(MimeType.PDF);
      pdfBlob.setName(`${newBaseName}.pdf`);
      finalFile = classFolder.createFile(pdfBlob);
    }

    return finalFile.getId();

  } catch (e) {
    Logger.log(`Drive Error for ${teacherName}: ${e.message}`);
    return null;
  } finally {
    // 3. CLEANUP: Delete the temporary conversion file so your Drive stays clean
    if (tempDocFile) {
      try {
        DriveApp.getFileById(tempDocFile.id).setTrashed(true);
      } catch (cleanupErr) {
        Logger.log("Cleanup failed: " + cleanupErr.message);
      }
    }
  }
}
