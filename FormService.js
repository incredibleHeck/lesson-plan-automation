/**
 * Services for Google Form interactions
 */

/**
 * COMPREHENSIVE SETUP: Updates Class, Subject, and Teacher dropdowns.
 * Run this whenever the Teaching Load matrix or Staff Roster changes.
 */
function updateAllFormDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formUrl = ss.getFormUrl();

  if (!formUrl) {
    Logger.log("❌ Error: No Google Form is linked to this spreadsheet.");
    return;
  }

  const form = FormApp.openByUrl(formUrl);
  const items = form.getItems(FormApp.ItemType.LIST);

  // 1. Data Source: Teacher Names from Staff Roster
  const rosterSheet = ss.getSheetByName("Staff Roster");
  let teacherNames = [];
  if (rosterSheet) {
    const lastRow = rosterSheet.getLastRow();
    if (lastRow >= 2) {
      teacherNames = rosterSheet.getRange(2, 1, lastRow - 1, 1).getValues()
        .map(row => row[0])
        .filter(name => name && name.toString().trim() !== "")
        .sort();
    }
  }

  // 2. Data Source: Standardized Classes (Combined Cohort Strategy)
  const classList = [
    "Year 1A", "Year 1B", "Year 1 (A & B)",
    "Year 2A", "Year 2B", "Year 2 (A & B)",
    "Year 3A", "Year 3B", "Year 3 (A & B)",
    "Year 4A", "Year 4B", "Year 4 (A & B)",
    "Year 5A", "Year 5B", "Year 5 (A & B)",
    "Year 6A", "Year 6B", "Year 6 (A & B)",
    "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"
  ];

  // 3. Data Source: Standardized Subjects
  const subjectList = [
    "Arts",
    "Bible Knowledge",
    "Biology",
    "Business Studies",
    "Chemistry",
    "Economics",
    "English Language",
    "French",
    "Geography",
    "History",
    "Humanities",
    "Computing",
    "Literature in English",
    "Mathematics",
    "Music",
    "Physics",
    "Science"
  ];

  // 4. Update the Form Items
  items.forEach(item => {
    const title = item.getTitle().trim();
    const listItem = item.asListItem();

    if (title === "Class") {
      listItem.setChoiceValues(classList);
      Logger.log("✅ Updated 'Class' dropdown.");
    } else if (title === "Subject") {
      listItem.setChoiceValues(subjectList);
      Logger.log("✅ Updated 'Subject' dropdown.");
    } else if (title.toLowerCase().includes("teacher") && title.toLowerCase().includes("name")) {
      if (teacherNames.length > 0) {
        listItem.setChoiceValues(teacherNames);
        Logger.log("✅ Updated 'Teacher Name' dropdown.");
      }
    }
  });
}

/**
 * AUTOMATION TRIGGER: Runs whenever the spreadsheet is edited.
 * If the edit happens on specific tabs, it refreshes the form dropdowns.
 */
function syncRosterToForm(e) {
  if (!e || !e.range) return;
  
  const editedSheetName = e.range.getSheet().getName();
  
  // Refresh if Staff Roster or Teaching Load is modified
  if (editedSheetName === "Staff Roster" || editedSheetName === "Teaching Load") {
    updateAllFormDropdowns();
  }
}
