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

  // 2 & 3. Data Source: Dynamic Classes and Subjects from Teaching Load
  const loadSheet = ss.getSheetByName("Teaching Load");
  let classList = [];
  let subjectList = [];
  
  if (loadSheet) {
    const loadData = loadSheet.getDataRange().getValues();
    const classSet = new Set();
    const subjectSet = new Set();
    
    for (let i = 1; i < loadData.length; i++) {
      const cls = loadData[i][1]; // Assuming Class is Column B (Index 1)
      const subj = loadData[i][2]; // Assuming Subject is Column C (Index 2)
      
      if (cls && cls.toString().trim() !== "") classSet.add(cls.toString().trim());
      if (subj && subj.toString().trim() !== "") subjectSet.add(subj.toString().trim());
    }
    
    // Convert Sets to sorted arrays
    classList = Array.from(classSet).sort();
    subjectList = Array.from(subjectSet).sort();
  }

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
