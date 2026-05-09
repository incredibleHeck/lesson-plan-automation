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
      teacherNames = rosterSheet.getRange(2, 1, lastRow, 1).getValues()
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

  // 4. Update the Form Items with Resilient Matching and Safety Checks
  items.forEach(item => {
    const title = item.getTitle().toLowerCase();
    const listItem = item.asListItem();

    if (title.includes("class")) {
      if (classList.length > 0) {
        listItem.setChoiceValues(classList);
        Logger.log("✅ Updated 'Class' dropdown.");
      } else {
        Logger.log("⚠️ Skipped 'Class' dropdown: No data found in Teaching Load.");
      }
    } else if (title.includes("subject")) {
      if (subjectList.length > 0) {
        listItem.setChoiceValues(subjectList);
        Logger.log("✅ Updated 'Subject' dropdown.");
      } else {
        Logger.log("⚠️ Skipped 'Subject' dropdown: No data found in Teaching Load.");
      }
    } else if (title.includes("teacher") && title.includes("name")) {
      if (teacherNames.length > 0) {
        listItem.setChoiceValues(teacherNames);
        Logger.log("✅ Updated 'Teacher Name' dropdown.");
      } else {
        Logger.log("⚠️ Skipped 'Teacher Name' dropdown: No data found in Staff Roster.");
      }
    }
  });
}

/**
 * UI TRIGGER: Creates a custom menu in the Google Sheet for manual syncing.
 * Replaces the dangerous onEdit trigger to protect API quotas.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("HecTech Tools")
    .addItem("🔄 Sync Form Dropdowns", "updateAllFormDropdowns")
    .addToUi();
}
