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
  
  // Safely extract the date string (e.g., "May 4, 2026")
  const dateMatch = rangeText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
  if (!dateMatch) {
    Logger.log("Warning: Could not parse deadline date from string: " + rangeText);
    return null; 
  }
  
  const startDate = new Date(dateMatch[1]);
  if (isNaN(startDate.getTime())) return null;

  const deadline = new Date(startDate);
  
  // Math Hack: Calculate days to subtract to get to the preceding Friday (Friday = 5)
  // GetDay returns 0 (Sun) to 6 (Sat).
  const startDayOfWeek = startDate.getDay();
  let daysToSubtract = (startDayOfWeek + 2) % 7; 
  if (daysToSubtract === 0) daysToSubtract = 7; // If it's a Friday, go back exactly 1 week

  // Set the deadline to the previous Friday
  deadline.setDate(startDate.getDate() - daysToSubtract);
  deadline.setHours(CONFIG.DEADLINE.HOUR, CONFIG.DEADLINE.MINUTE, CONFIG.DEADLINE.SECOND, 999);
  
  return deadline;
}

/**
 * Calculates the exact number of days late
 */
function calculateDaysLate(submissionDate, deadlineDate) {
  if (!submissionDate || !deadlineDate) return 0;

  const diffMs = submissionDate.getTime() - deadlineDate.getTime();

  // If the difference is negative or zero, it was submitted before the deadline
  if (diffMs <= 0) return 0;

  // Convert milliseconds to days and round up to the nearest whole day
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Safely parses DD/MM/YYYY HH:MM:SS strings into valid JavaScript Date objects.
 * Form timestamps as strings are interpreted in Ghanaian day/month order, not US MDY.
 */
function parseGhanaianDate(dateString) {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;
  if (typeof dateString !== "string") return new Date(dateString);

  const parts = dateString.split(" ");
  const dateParts = parts[0].split("/");

  if (dateParts.length === 3) {
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JS Months are 0-indexed
    const year = parseInt(dateParts[2], 10);

    let hours = 0, minutes = 0, seconds = 0;
    
    if (parts[1]) {
      const timeParts = parts[1].split(":");
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
      seconds = parseInt(timeParts[2] || 0, 10);
    }

    return new Date(year, month, day, hours, minutes, seconds);
  }

  return new Date(dateString);
}
