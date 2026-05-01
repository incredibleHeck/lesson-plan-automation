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
 * Moves file to chronological folder, standardizes the name, and CONVERTS TO PDF.
 */
function processDriveFile(fileUrl, weekName, className, subjectName, teacherName) {
  const masterFolder = getRootFolder(); 
  const weekFolder = getOrCreateFolder(masterFolder, weekName);
  const classFolder = getOrCreateFolder(weekFolder, className);
  
  const fileId = fileUrl.indexOf("id=") !== -1 ? fileUrl.split("id=")[1] : null;
  
  if (fileId) {
    const originalFile = DriveApp.getFileById(fileId);
    const newBaseName = `${subjectName} - ${teacherName}`; 
    
    try {
      // THE MAGIC: Ask Google Drive to convert the file into a PDF blob
      const pdfBlob = originalFile.getAs(MimeType.PDF);
      pdfBlob.setName(`${newBaseName}.pdf`);
      
      // Create the new lightweight PDF inside the correct Class folder
      classFolder.createFile(pdfBlob);
      
      // Optional but recommended: Trash the heavy original Word/Doc file to keep Drive clean
      originalFile.setTrashed(true);
      
    } catch (e) {
      // FALLBACK: If conversion fails (e.g., file type not supported), rename and move normally
      const originalName = originalFile.getName();
      const extension = originalName.indexOf('.') !== -1 ? originalName.split('.').pop() : "";
      const finalName = newBaseName + (extension ? "." + extension : "");
      originalFile.setName(finalName);
      originalFile.moveTo(classFolder);
    }
  }
}
