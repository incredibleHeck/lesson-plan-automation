/**
 * Services for Google Form interactions
 */

/**
 * Automatically updates the teacher dropdown in the Google Form
 * using the list from the "Staff Roster" sheet.
 */
function updateTeacherDropdown() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName("Staff Roster");
  
  if (!rosterSheet) {
    Logger.log("Error: Could not find the 'Staff Roster' tab.");
    return;
  }

  const lastRow = rosterSheet.getLastRow();
  if (lastRow < 2) return;

  // 1. Get and sanitize names
  const rosterData = rosterSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const teacherNames = rosterData
    .map(row => row[0])
    .filter(name => name && name.toString().trim() !== "")
    .sort(); 

  const formUrl = ss.getFormUrl();
  if (!formUrl) {
    Logger.log("Error: No form linked to this spreadsheet.");
    return;
  }
  
  try {
    const form = FormApp.openByUrl(formUrl);
    const items = form.getItems();
    let teacherQuestion = null;

    // 2. Safer Question Targeting (Case-insensitive, substring match)
    for (let i = 0; i < items.length; i++) {
      const title = items[i].getTitle().toLowerCase();
      if (title.includes("teacher") && title.includes("name")) {
        teacherQuestion = items[i];
        break;
      }
    }

    if (teacherQuestion) {
      // 3. Safe Type Casting
      const itemType = teacherQuestion.getType();
      
      if (itemType === FormApp.ItemType.LIST) {
        teacherQuestion.asListItem().setChoiceValues(teacherNames);
        Logger.log(`Form dropdown updated with ${teacherNames.length} teachers.`);
      } else if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
        teacherQuestion.asMultipleChoiceItem().setChoiceValues(teacherNames);
        Logger.log(`Form multiple-choice updated with ${teacherNames.length} teachers.`);
      } else {
        Logger.log(`Error: The Teacher Name question is the wrong type (${itemType}). Please change it to a Dropdown.`);
      }
    } else {
      Logger.log("Error: Could not find a question containing 'Teacher Name'.");
    }
  } catch (err) {
    Logger.log("Error updating form: " + err.message);
  }
}

/**
 * AUTOMATION TRIGGER: Runs instantly whenever the spreadsheet is edited.
 * If the edit happens on the "Staff Roster" tab, it updates the form.
 * This must be set up as an Installable Trigger.
 */
function syncRosterToForm(e) {
  if (!e || !e.range) return;
  
  const editedSheet = e.range.getSheet();
  
  // Only trigger the form update if they are actively modifying the Staff Roster
  if (editedSheet.getName() === "Staff Roster") {
    updateTeacherDropdown();
  }
}
