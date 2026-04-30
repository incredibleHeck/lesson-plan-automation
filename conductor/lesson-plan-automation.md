# Implementation Plan - Automated Lesson Plan Verification

Implement a Google Apps Script to automatically flag late lesson plan submissions and notify the respective Head of Department (HOD).

## Objective
- Automatically calculate a Friday 23:59:59 GMT deadline based on the "Week Starting" field.
- Compare the submission timestamp with the deadline.
- Mark submissions as "LATE" in the "HOD Check" column (Column L).
- Send email alerts to the appropriate HOD for late submissions.

## Key Files & Context
- `Code.js`: Main logic implementation.
- `appsscript.json`: Timezone set to `Africa/Abidjan` (GMT).

## Proposed Logic

### 1. `onFormSubmit(e)`
- Triggered automatically on form submission.
- Extracts `timestamp`, `weekRangeString`, `hodSelection`, `teacherName`, and `subject` from the event object.
- Updates the spreadsheet's "HOD Check" column.

### 2. `calculateFridayDeadline(rangeText)`
- Extracts the start date (e.g., "May 4, 2026") from a string like "Week 3: May 4, 2026 – May 10, 2026".
- Calculates the Friday of that week.
- Returns a `Date` object set to 23:59:59.

### 3. `getHodEmail(hodSelection)`
- Maps the HOD selection (from Column C) to an email address.
- Defaults for:
    - **Mr. Alfred Ashia** (Upper/Secondary)
    - **Mrs. Abigail Sackey** (Lower Primary)

### 4. `sendLateAlert(email, teacher, subject)`
- Uses `MailApp.sendEmail` to notify the HOD.

## Implementation Steps
1. **Update `Code.js`**:
    - Implement the helper functions (`calculateFridayDeadline`, `getHodEmail`, `sendLateAlert`).
    - Implement the `onFormSubmit` handler.
    - Add a `testSubmission` function for manual verification.
2. **Setup Trigger**:
    - Instructions for the user to set up the "Installable Trigger" in the Apps Script editor (since triggers cannot be created purely via code push without specific permissions/scopes, but I can provide a `createTrigger` function).

## Verification & Testing
- Run `testSubmission` with mock data representing:
    - An "On Time" submission (e.g., Thursday).
    - a "LATE" submission (e.g., Saturday).
    - Edge case: Friday 23:59:00 (On Time).
    - Edge case: Friday 23:59:59 (On Time).
    - Edge case: Saturday 00:00:01 (LATE).
