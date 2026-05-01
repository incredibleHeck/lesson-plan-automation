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
 * Moves file to chronological folder structure and standardizes the name
 */
function processDriveFile(fileUrl, weekName, className, subjectName, teacherName) {
  // Use our new self-creating root folder function
  const masterFolder = getRootFolder(); 
  
  // Chronological path: Week -> Class
  const weekFolder = getOrCreateFolder(masterFolder, weekName);
  const classFolder = getOrCreateFolder(weekFolder, className);
  
  const fileId = fileUrl.indexOf("id=") !== -1 ? fileUrl.split("id=")[1] : null;

  if (fileId) {
    const file = DriveApp.getFileById(fileId);
    
    // Auto-Rename: [Subject] - [Teacher Name]
    const originalName = file.getName();
    const extension = originalName.indexOf('.') !== -1 ? originalName.split('.').pop() : "";
    const newName = subjectName + " - " + teacherName + (extension ? "." + extension : "");
    file.setName(newName);
    
    file.moveTo(classFolder);
  }
}
