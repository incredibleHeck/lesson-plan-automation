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

  try {
    const originalFile = DriveApp.getFileById(fileId);
    const newBaseName = `${subjectName} - ${teacherName}`;
    const isPdf = originalFile.getMimeType() === MimeType.PDF;
    
    let finalFile;

    if (isPdf) {
      // If it's already a PDF, try to move it
      originalFile.setName(`${newBaseName}.pdf`);
      try {
        originalFile.moveTo(classFolder);
        finalFile = originalFile;
      } catch (e) {
        // Fallback: If move fails (permissions/org barrier), copy it
        finalFile = originalFile.makeCopy(`${newBaseName}.pdf`, classFolder);
      }
    } else {
      // Convert to PDF
      const pdfBlob = originalFile.getAs(MimeType.PDF);
      pdfBlob.setName(`${newBaseName}.pdf`);
      finalFile = classFolder.createFile(pdfBlob);
      
      // SAFETY: We no longer trash the original file automatically to prevent data loss.
    }

    return finalFile.getId();

  } catch (e) {
    Logger.log(`Drive Error for ${teacherName}: ${e.message}`);
    return null;
  }
}
