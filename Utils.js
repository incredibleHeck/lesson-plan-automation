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
 * Calculates Friday at 23:59:59 GMT BEFORE the provided week string starts
 */
function calculateFridayDeadline(rangeText) {
  if (!rangeText) return null;
  
  // Extracts the exact start date from your week string 
  // (e.g., extracts "May 4, 2026" from "Week 3: May 4, 2026 - May 10, 2026")
  const dateMatch = rangeText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
  if (!dateMatch) return null;
  
  const startDate = new Date(dateMatch[1]);
  if (isNaN(startDate.getTime())) return null;

  const deadline = new Date(startDate);
  
  // Figure out what day of the week the start date is (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = startDate.getDay();
  let daysToSubtract;

  // Calculate exactly how many days to go backward to hit the preceding Friday
  if (startDayOfWeek === 1) { 
    daysToSubtract = 3; // Monday -> go back 3 days to Friday
  } else if (startDayOfWeek === 2) {
    daysToSubtract = 4; // Tuesday -> go back 4 days
  } else if (startDayOfWeek === 3) {
    daysToSubtract = 5; // Wednesday -> go back 5 days
  } else if (startDayOfWeek === 4) {
    daysToSubtract = 6; // Thursday -> go back 6 days
  } else if (startDayOfWeek === 5) {
    daysToSubtract = 7; // Friday -> go back 7 days (the previous Friday)
  } else if (startDayOfWeek === 6) {
    daysToSubtract = 1; // Saturday -> go back 1 day
  } else {
    daysToSubtract = 2; // Sunday -> go back 2 days
  }

  // Set the deadline to the previous Friday
  deadline.setDate(startDate.getDate() - daysToSubtract);
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
