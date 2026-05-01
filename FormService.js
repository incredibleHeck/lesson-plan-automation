/**
 * Services for Google Form interactions
 */

/**
 * Automatically updates the "Teachers Name" dropdown in the Google Form
 * using the list from the "Staff Roster" sheet.
 */
function updateTeacherDropdown() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName("Staff Roster");
  
  if (!rosterSheet) {
    Logger.log("Error: Please create a 'Staff Roster' tab.");
    return;
  }

  const lastRow = rosterSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("Error: Staff Roster is empty.");
    return;
  }

  // 1. Get the names from Column A (starting from row 2 to skip header)
  const rosterData = rosterSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const teacherNames = rosterData
    .map(row => row[0])
    .filter(name => name && name.toString().trim() !== "")
    .sort(); // Sort alphabetically for a professional look

  // 2. Connect to the Google Form linked to this sheet
  const formUrl = ss.getFormUrl();
  if (!formUrl) {
    Logger.log("Error: No form linked to this spreadsheet.");
    return;
  }
  
  try {
    const form = FormApp.openByUrl(formUrl);

    // 3. Find the "Teachers Name" question
    const items = form.getItems();
    let teacherQuestion;

    for (let i = 0; i < items.length; i++) {
      if (items[i].getTitle() === "Teachers Name") {
        teacherQuestion = items[i];
        break;
      }
    }

    // 4. Update the choices
    if (teacherQuestion) {
      // Ensure the question is a dropdown (asListItem)
      teacherQuestion.asListItem().setChoiceValues(teacherNames);
      Logger.log("Form dropdown updated with " + teacherNames.length + " teachers.");
    } else {
      Logger.log("Error: Could not find a question titled 'Teachers Name'.");
    }
  } catch (err) {
    Logger.log("Error updating form: " + err.message);
  }
}
