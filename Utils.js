/**
 * Utility functions for logic and string manipulation
 */

/**
 * Extracts the specific week name from the full string
 * @param {string} fullWeekString e.g., "Week 3: May 4, 2026 – May 10, 2026"
 * @returns {string} e.g., "Week 3"
 */
function extractWeekName(fullWeekString) {
  if (!fullWeekString) return "Unknown Week";
  return fullWeekString.split(":")[0].trim();
}

/**
 * Calculates Friday at 23:59:59 GMT from the provided week string
 */
function calculateFridayDeadline(rangeText) {
  if (!rangeText) return null;
  const dateMatch = rangeText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
  if (!dateMatch) return null;
  
  const startDate = new Date(dateMatch[1]);
  if (isNaN(startDate.getTime())) return null;

  const deadline = new Date(startDate);
  deadline.setDate(startDate.getDate() + 4);
  deadline.setHours(CONFIG.DEADLINE.HOUR, CONFIG.DEADLINE.MINUTE, CONFIG.DEADLINE.SECOND, 999);
  
  return deadline;
}

/**
 * Calculates how many days late a submission is
 */
function calculateDaysLate(timestamp, deadline) {
  if (deadline && timestamp > deadline) {
    const diffTime = Math.abs(timestamp - deadline);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
}

/**
 * Returns the email for the selected HOD
 */
function getHodEmail(hodSelection) {
  if (!hodSelection) return null;
  const selectionLower = hodSelection.toLowerCase();
  for (let name in CONFIG.HOD_EMAILS) {
    if (selectionLower.indexOf(name.toLowerCase()) !== -1 || name.toLowerCase().indexOf(selectionLower) !== -1) {
      return CONFIG.HOD_EMAILS[name];
    }
  }
  return null;
}
