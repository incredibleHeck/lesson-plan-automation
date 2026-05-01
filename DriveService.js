/**
 * Services for Google Drive interactions
 */

/**
 * Core Setup: Finds the master folder. If missing, creates it and auto-shares it.
 */
function getRootFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.MASTER_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next(); // It already exists, just return it.
  } else {
    // 1. It doesn't exist! Create the Master Folder in the root of your Drive.
    const newFolder = DriveApp.createFolder(CONFIG.MASTER_FOLDER_NAME);

    // 2. Auto-Share the Folder: Give VP and HODs editor access to the files.
    newFolder.addEditor(CONFIG.EMAILS.VP_ACADEMICS);
    newFolder.addEditor(CONFIG.EMAILS.HOD_LOWER_PRIMARY);
    newFolder.addEditor(CONFIG.EMAILS.HOD_UPPER_SECONDARY);

    // 3. Auto-Share the Spreadsheet: Give them access to the database too.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.addEditor(CONFIG.EMAILS.VP_ACADEMICS);
    ss.addEditor(CONFIG.EMAILS.HOD_LOWER_PRIMARY);
    ss.addEditor(CONFIG.EMAILS.HOD_UPPER_SECONDARY);

    return newFolder;
  }
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
 * True when Drive likely denied access (vs conversion/format issues).
 */
function isDrivePermissionError(err) {
  const msg = err && err.message ? String(err.message).toLowerCase() : "";
  return (
    msg.indexOf("permission") !== -1 ||
    msg.indexOf("access denied") !== -1 ||
    msg.indexOf("not authorized") !== -1 ||
    msg.indexOf("insufficient permissions") !== -1 ||
    msg.indexOf("forbidden") !== -1
  );
}

/**
 * Moves file to chronological folder structure and standardizes the name.
 * CONVERTS TO PDF if needed.
 */
function processDriveFile(fileUrl, weekName, className, subjectName, teacherName) {
  if (!fileUrl) {
    return null;
  }

  const masterFolder = getRootFolder();
  const weekFolder = getOrCreateFolder(masterFolder, weekName);
  const classFolder = getOrCreateFolder(weekFolder, className);

  const fileIdMatch = fileUrl.match(/[-\w]{25,}/);
  const fileId = fileIdMatch ? fileIdMatch[0] : null;

  if (!fileId) {
    return null;
  }

  let originalFile;
  try {
    originalFile = DriveApp.getFileById(fileId);
    const newBaseName = `${subjectName} - ${teacherName}`;

    if (originalFile.getMimeType() === MimeType.PDF) {
      originalFile.setName(`${newBaseName}.pdf`);
      originalFile.moveTo(classFolder);
      return fileId;
    }

    const pdfBlob = originalFile.getAs(MimeType.PDF);
    pdfBlob.setName(`${newBaseName}.pdf`);

    const newPdfFile = classFolder.createFile(pdfBlob);
    originalFile.setTrashed(true);

    return newPdfFile.getId();
  } catch (e) {
    if (isDrivePermissionError(e)) {
      Logger.log("DRIVE PERMISSION ERROR: The script cannot access the file. " + e.message);
      return null;
    }

    if (!originalFile) {
      Logger.log("Drive processing error: " + e.message);
      return null;
    }

    try {
      const newBaseName = `${subjectName} - ${teacherName}`;
      const originalName = originalFile.getName();
      const extension = originalName.indexOf(".") !== -1 ? originalName.split(".").pop() : "";
      const finalName = newBaseName + (extension ? "." + extension : "");

      originalFile.setName(finalName);
      originalFile.moveTo(classFolder);
      return fileId;
    } catch (e2) {
      Logger.log("Drive fallback failed (rename/move): " + e2.message);
      return null;
    }
  }
}
