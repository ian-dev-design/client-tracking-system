/**
 * FOR LATER — only useful once the app is deployed (Apps Script can't reach localhost).
 * Pings the app whenever someone submits the survey, so it syncs instantly instead of
 * waiting for the 5-minute poll.
 *
 * Setup: open the Form → ⋮ → Script editor → paste this → set the two values below →
 * Triggers (clock icon) → Add trigger → onSubmit, "From form", "On form submit".
 * SYNC_SECRET must equal SURVEY_SYNC_SECRET in the app's environment variables.
 */
var APP_URL = 'https://YOUR-APP.vercel.app';
var SYNC_SECRET = 'same-long-random-string-as-SURVEY_SYNC_SECRET';

function onSubmit() {
  UrlFetchApp.fetch(APP_URL + '/api/surveys/sync', {
    method: 'post',
    headers: { 'x-sync-secret': SYNC_SECRET },
    muteHttpExceptions: true,
  });
}
