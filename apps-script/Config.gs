/**
 * Teacher Scheduler v1 - Configuration
 * -------------------------------------------------
 * This file is separate from Code.gs on purpose: when you update the
 * backend, only replace Code.gs in the Apps Script editor and leave
 * this file untouched, so your settings (teacher emails, calendar ID,
 * timezone) are never lost.
 *
 * To add/change the config, edit this file and create a new deployment
 * (Deploy -> Manage deployments -> Edit -> New version -> Deploy).
 */

var CONFIG = {
  TEACHER_EMAILS: ['YOUR-TEACHER-EMAIL@gmail.com'], // REPLACE with the teacher's email(s)
  SPREADSHEET_ID: '', // optional: leave '' if the script is bound to the spreadsheet
  CALENDAR_ID: '',    // optional: leave '' to use the teacher's default calendar
  TIME_ZONE: 'Asia/Taipei',
};
