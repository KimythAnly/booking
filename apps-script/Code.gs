/**
 * Teacher Scheduler v1 - Apps Script Backend
 * -------------------------------------------------
 * - Google Sheets acts as the database.
 * - Google Calendar stores approved lesson events.
 * - Only teacher-registered students can log in and book.
 *
 * SETUP:
 *   1. Create a Google Spreadsheet.
 *   2. Edit Config.gs (teacher emails). Optionally set SPREADSHEET_ID / CALENDAR_ID.
 *   3. In the spreadsheet: Extensions -> Apps Script, paste this file, Config.gs
 *      and appsscript.json.
 *   4. Deploy -> New deployment -> Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone with a Google account
 *   5. Copy the web app URL into the frontend .env as VITE_APPS_SCRIPT_URL.
 *
 * CONFIG (teacher emails, timezone, calendar) lives in Config.gs — when updating
 * this backend, replace only Code.gs and keep Config.gs untouched.
 */

var SHEET_NAMES = {
  students: 'Students',
  requests: 'BookingRequests',
  bookings: 'Bookings',
  recurring: 'RecurringClasses',
  availability: 'Availability',
};

var SHEET_HEADERS = {
  Students: ['student_id', 'name', 'email', 'active', 'created_at'],
  BookingRequests: ['request_id', 'student_id', 'student_email', 'student_name', 'type', 'slot_id', 'booking_id', 'start_time', 'end_time', 'status', 'created_at'],
  Bookings: ['booking_id', 'student_id', 'student_email', 'student_name', 'start_time', 'end_time', 'status', 'calendar_event_id', 'recurring_id', 'created_at'],
  RecurringClasses: ['id', 'student_id', 'student_email', 'student_name', 'weekday', 'start_time', 'end_time', 'start_date', 'end_date', 'active'],
  Availability: ['slot_id', 'start_time', 'end_time', 'status'],
};

var WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

// ============================================================
// Entry point
// ============================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var email = String(body.email || '').toLowerCase();

    // Apps Script validates the caller's identity when available.
    // This prevents one signed-in user from impersonating another.
    var sessionEmail = Session.getActiveUser().getEmail();
    if (sessionEmail && email && sessionEmail.toLowerCase() !== email) {
      return json_({ error: 'Signed-in account does not match the requested email' });
    }

    if (action === 'validateUser') {
      return json_({ role: getRole_(email) });
    }

    var role = getRole_(email);

    switch (action) {
      // ---- Student (and teacher) access ----
      case 'getAvailableSlots': {
        requireStudentOrTeacher_(role);
        return json_({ slots: getAvailableSlots_() });
      }
      case 'getMyBookings': {
        requireStudentOrTeacher_(role);
        return json_({ bookings: getStudentBookings_(email) });
      }
      case 'getMyRequests': {
        requireStudentOrTeacher_(role);
        return json_({ requests: getStudentRequests_(email) });
      }
      case 'getStudentData': {
        requireStudentOrTeacher_(role);
        return json_({
          slots: getAvailableSlots_(),
          bookings: getStudentBookings_(email),
          requests: getStudentRequests_(email),
        });
      }
      case 'requestBooking': {
        requireStudent_(role);
        return json_({ message: 'Booking request submitted', request: requestBooking_(email, body.slotId) });
      }

      // ---- Teacher only ----
      case 'getAdminData': {
        requireTeacher_(role);
        return json_(getAdminData_());
      }
      case 'getPendingRequests': {
        requireTeacher_(role);
        return json_({ requests: getPendingRequests_() });
      }
      case 'approveRequest': {
        requireTeacher_(role);
        return json_(approveRequest_(body.requestId));
      }
      case 'rejectRequest': {
        requireTeacher_(role);
        updateById_(SHEET_NAMES.requests, 'request_id', body.requestId, { status: 'REJECTED' });
        return json_({ message: 'Request rejected' });
      }
      case 'listStudents': {
        requireTeacher_(role);
        return json_({ students: readAll_(SHEET_NAMES.students) });
      }
      case 'addStudent': {
        requireTeacher_(role);
        addStudent_(body.name, body.studentEmail);
        return json_({ message: 'Student added' });
      }
      case 'disableStudent': {
        requireTeacher_(role);
        updateById_(SHEET_NAMES.students, 'student_id', body.studentId, { active: 'FALSE' });
        return json_({ message: 'Student disabled' });
      }
      case 'enableStudent': {
        requireTeacher_(role);
        updateById_(SHEET_NAMES.students, 'student_id', body.studentId, { active: 'TRUE' });
        return json_({ message: 'Student enabled' });
      }
      case 'createAvailability': {
        requireTeacher_(role);
        createAvailability_(body.startTime, body.endTime, body.studentId);
        return json_({ message: body.studentId ? 'Lesson scheduled' : 'Slot created' });
      }
      case 'createWeeklyAvailability': {
        requireTeacher_(role);
        return json_(createWeeklyAvailability_(body.weekday, body.startTime, body.endTime, body.startDate, body.endDate, body.studentId));
      }
      case 'cancelBooking': {
        requireTeacher_(role);
        return json_(cancelBooking_(body.bookingId));
      }
      case 'blockSlot': {
        requireTeacher_(role);
        updateById_(SHEET_NAMES.availability, 'slot_id', body.slotId, { status: 'BLOCKED' });
        return json_({ message: 'Slot blocked' });
      }
      case 'unblockSlot': {
        requireTeacher_(role);
        updateById_(SHEET_NAMES.availability, 'slot_id', body.slotId, { status: 'AVAILABLE' });
        return json_({ message: 'Slot unblocked' });
      }
      case 'deleteSlot': {
        requireTeacher_(role);
        deleteById_(SHEET_NAMES.availability, 'slot_id', body.slotId);
        return json_({ message: 'Slot deleted' });
      }
      case 'createRecurringClass': {
        requireTeacher_(role);
        return json_(createRecurringClass_(body.studentId, body.weekday, body.startTime, body.endTime, body.startDate, body.endDate));
      }
      case 'generateRecurringBookings': {
        requireTeacher_(role);
        return json_({ generated: generateRecurringBookings_(body.recurringId).length });
      }
      case 'disableRecurringClass': {
        requireTeacher_(role);
        return json_(disableRecurringClass_(body.recurringId));
      }
      case 'enableRecurringClass': {
        requireTeacher_(role);
        return json_(enableRecurringClass_(body.recurringId));
      }
      case 'deleteRecurringClass': {
        requireTeacher_(role);
        return json_(deleteRecurringClass_(body.recurringId));
      }

      default:
        return json_({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    console.error('doPost error: ' + err);
    return json_({ error: err.message || String(err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('Teacher Scheduler v1 API is running. Use POST to /exec.');
}

// ============================================================
// Sheets helpers
// ============================================================

function spreadsheet_() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEET_HEADERS[name]);
  }
  return sh;
}

function readAll_(name) {
  var values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var cell = values[i][j];
      // Sheets stores ISO datetime strings as real dates; return them as wall-clock
      // strings so the rest of the code (and the frontend) sees consistent values.
      row[headers[j]] = cell instanceof Date
        ? Utilities.formatDate(cell, CONFIG.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss")
        : cell;
    }
    rows.push(row);
  }
  return rows;
}

function appendRow_(name, obj) {
  var headers = SHEET_HEADERS[name];
  sheet_(name).appendRow(headers.map(function (h) {
    return obj[h] !== undefined ? obj[h] : '';
  }));
}

function findById_(name, col, id) {
  return readAll_(name).find(function (r) { return String(r[col]) === String(id); });
}

function updateById_(name, col, id, updateObj) {
  var sh = sheet_(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var values = sh.getDataRange().getValues();
  var idIdx = headers.indexOf(col);
  if (idIdx === -1) return false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === String(id)) {
      var row = {};
      for (var j = 0; j < headers.length; j++) row[headers[j]] = values[i][j];
      for (var k in updateObj) row[k] = updateObj[k];
      sh.getRange(i + 1, 1, 1, headers.length).setValues([headers.map(function (h) {
        return row[h] !== undefined ? row[h] : '';
      })]);
      return true;
    }
  }
  return false;
}

function deleteById_(name, col, id) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idIdx = headers.indexOf(col);
  if (idIdx === -1) return;
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][idIdx]) === String(id)) sh.deleteRow(i + 1);
  }
}

// ============================================================
// Auth & roles
// ============================================================

function getRole_(email) {
  if (!email) return 'unauthorized';
  var teacherEmails = CONFIG.TEACHER_EMAILS.map(function (e) { return String(e).toLowerCase(); });
  if (teacherEmails.indexOf(email) !== -1) return 'teacher';
  var student = getStudentByEmail_(email);
  if (student && isTrue_(student.active)) return 'student';
  return 'unauthorized';
}

function requireTeacher_(role) {
  if (role !== 'teacher') throw new Error('Teacher access required');
}
function requireStudent_(role) {
  if (role !== 'student') throw new Error('Student access required');
}
function requireStudentOrTeacher_(role) {
  if (role !== 'student' && role !== 'teacher') throw new Error('Valid account required');
}

function isTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || v === '1';
}

function getStudentByEmail_(email) {
  return readAll_(SHEET_NAMES.students).find(function (s) {
    return String(s.email).toLowerCase() === email;
  });
}

// ============================================================
// Student APIs
// ============================================================

function getAvailableSlots_() {
  var now = Date.now();
  var slots = readAll_(SHEET_NAMES.availability).filter(function (s) {
    return String(s.status).toUpperCase() === 'AVAILABLE';
  });
  var bookedTimes = {};
  readAll_(SHEET_NAMES.bookings).forEach(function (b) {
    if (b.status === 'ACTIVE') bookedTimes[b.start_time] = true;
  });
  var pendingTimes = {};
  readAll_(SHEET_NAMES.requests).forEach(function (r) {
    if (r.type === 'BOOK' && r.status === 'PENDING') pendingTimes[r.start_time] = true;
  });
  return slots
    .filter(function (s) {
      if (new Date(s.start_time).getTime() <= now) return false;
      if (bookedTimes[s.start_time]) return false;
      if (pendingTimes[s.start_time]) return false;
      return true;
    })
    .sort(function (a, b) { return a.start_time.localeCompare(b.start_time); })
    .map(function (s) {
      return { slot_id: s.slot_id, start_time: s.start_time, end_time: s.end_time };
    });
}

function getStudentBookings_(email) {
  return readAll_(SHEET_NAMES.bookings)
    .filter(function (b) { return String(b.student_email).toLowerCase() === email; })
    .sort(function (a, b) { return b.start_time.localeCompare(a.start_time); });
}

function getStudentRequests_(email) {
  return readAll_(SHEET_NAMES.requests)
    .filter(function (r) { return String(r.student_email).toLowerCase() === email; })
    .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
}

function requestBooking_(email, slotId) {
  return runLocked_(function () {
    var slot = findById_(SHEET_NAMES.availability, 'slot_id', slotId);
    if (!slot) throw new Error('Slot not found');
    if (String(slot.status).toUpperCase() !== 'AVAILABLE') throw new Error('This slot is no longer available');
    var student = getStudentByEmail_(email);
    if (!student || !isTrue_(student.active)) throw new Error('Student account is not active');

    var dup = readAll_(SHEET_NAMES.requests).find(function (r) {
      return String(r.slot_id) === String(slotId) && r.status === 'PENDING';
    });
    if (dup) throw new Error('A request for this slot is already pending');

    var request = {
      request_id: genId_('req'),
      student_id: student.student_id,
      student_email: student.email,
      student_name: student.name,
      type: 'BOOK',
      slot_id: slot.slot_id,
      booking_id: '',
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: 'PENDING',
      created_at: nowIso_(),
    };
    appendRow_(SHEET_NAMES.requests, request);
    return request;
  });
}

// ============================================================
// Teacher APIs
// ============================================================

function getPendingRequests_() {
  return readAll_(SHEET_NAMES.requests)
    .filter(function (r) { return r.status === 'PENDING'; })
    .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
}

function approveRequest_(requestId) {
  return runLocked_(function () {
    var req = findById_(SHEET_NAMES.requests, 'request_id', requestId);
    if (!req) throw new Error('Request not found');
    if (req.status !== 'PENDING') throw new Error('Request has already been processed');

    if (req.type === 'BOOK') {
      var slot = findById_(SHEET_NAMES.availability, 'slot_id', req.slot_id);
      if (!slot || String(slot.status).toUpperCase() !== 'AVAILABLE') {
        throw new Error('The requested slot is no longer available');
      }
      var eventId = createCalendarEvent_(req.start_time, req.end_time, req.student_name, req.student_email);
      appendRow_(SHEET_NAMES.bookings, {
        booking_id: genId_('bk'),
        student_id: req.student_id,
        student_email: req.student_email,
        student_name: req.student_name,
        start_time: req.start_time,
        end_time: req.end_time,
        status: 'ACTIVE',
        calendar_event_id: eventId,
        recurring_id: '',
        created_at: nowIso_(),
      });
      updateById_(SHEET_NAMES.availability, 'slot_id', slot.slot_id, { status: 'BOOKED' });
      updateById_(SHEET_NAMES.requests, 'request_id', requestId, { status: 'APPROVED' });
      return { message: 'Booking approved and added to calendar' };
    }

    if (req.type === 'CANCEL') {
      var booking = findById_(SHEET_NAMES.bookings, 'booking_id', req.booking_id);
      if (!booking || booking.status !== 'ACTIVE') throw new Error('Booking is not active');
      if (booking.calendar_event_id) deleteCalendarEvent_(booking.calendar_event_id);
      updateById_(SHEET_NAMES.bookings, 'booking_id', booking.booking_id, { status: 'CANCELLED' });
      freeSlot_(booking.start_time);
      updateById_(SHEET_NAMES.requests, 'request_id', requestId, { status: 'APPROVED' });
      return { message: 'Cancellation approved, calendar event removed' };
    }

    throw new Error('Unknown request type: ' + req.type);
  });
}

function addStudent_(name, studentEmail) {
  var email = String(studentEmail).toLowerCase();
  if (!name || !email) throw new Error('Name and email are required');
  var existing = getStudentByEmail_(email);
  if (existing) throw new Error('A student with this email already exists');
  appendRow_(SHEET_NAMES.students, {
    student_id: genId_('stu'),
    name: name,
    email: email,
    active: 'TRUE',
    created_at: nowIso_(),
  });
}

function createAvailability_(startTime, endTime, studentId) {
  if (!startTime || !endTime) throw new Error('Start and end times are required');
  if (new Date(startTime).getTime() >= new Date(endTime).getTime()) {
    throw new Error('End time must be after start time');
  }
  if (studentId) {
    createDirectBooking_(startTime, endTime, studentId, '');
    return;
  }
  appendRow_(SHEET_NAMES.availability, {
    slot_id: genId_('slot'),
    start_time: startTime,
    end_time: endTime,
    status: 'AVAILABLE',
  });
}

// Creates an ACTIVE booking (with a calendar event) and reserves the time in the
// availability sheet, so the slot disappears from students' bookable view and can
// be released again if the teacher cancels the lesson.
function createDirectBooking_(startTime, endTime, studentId, recurringId) {
  var student = findById_(SHEET_NAMES.students, 'student_id', studentId);
  if (!student || !isTrue_(student.active)) throw new Error('Student not found or inactive');

  var eventId = createCalendarEvent_(startTime, endTime, student.name, student.email);
  appendRow_(SHEET_NAMES.bookings, {
    booking_id: genId_('bk'),
    student_id: student.student_id,
    student_email: student.email,
    student_name: student.name,
    start_time: startTime,
    end_time: endTime,
    status: 'ACTIVE',
    calendar_event_id: eventId,
    recurring_id: recurringId || '',
    created_at: nowIso_(),
  });

  var slot = readAll_(SHEET_NAMES.availability).find(function (s) {
    return s.start_time === startTime;
  });
  if (slot) {
    updateById_(SHEET_NAMES.availability, 'slot_id', slot.slot_id, { status: 'BOOKED' });
  } else {
    appendRow_(SHEET_NAMES.availability, {
      slot_id: genId_('slot'),
      start_time: startTime,
      end_time: endTime,
      status: 'BOOKED',
    });
  }
}

function createWeeklyAvailability_(weekday, startTime, endTime, startDate, endDate, studentId) {
  var wd = WEEKDAYS[String(weekday).toLowerCase()];
  if (wd === undefined) throw new Error('Invalid weekday');
  if (!startTime || !endTime) throw new Error('Start and end times are required');
  if (new Date('1970-01-01T' + startTime).getTime() >= new Date('1970-01-01T' + endTime).getTime()) {
    throw new Error('End time must be after start time');
  }
  if (!startDate || !endDate) throw new Error('Start and end dates are required');
  if (String(startDate) > String(endDate)) throw new Error('End date must be after start date');

  if (studentId) {
    var student = findById_(SHEET_NAMES.students, 'student_id', studentId);
    if (!student || !isTrue_(student.active)) throw new Error('Student not found or inactive');
  }

  var startParts = String(startTime).split(':').map(Number);
  var endParts = String(endTime).split(':').map(Number);

  var existing = {};
  readAll_(SHEET_NAMES.availability).forEach(function (s) {
    existing[s.start_time] = true;
  });
  if (studentId) {
    readAll_(SHEET_NAMES.bookings).forEach(function (b) {
      if (b.status === 'ACTIVE') existing[b.start_time] = true;
    });
  }

  var cursor = new Date(String(startDate) + 'T00:00:00');
  var end = new Date(String(endDate) + 'T23:59:59');
  var created = [];
  var guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 400) {
    if (cursor.getDay() === wd) {
      var start = new Date(cursor); start.setHours(startParts[0], startParts[1], 0, 0);
      var stop = new Date(cursor); stop.setHours(endParts[0], endParts[1], 0, 0);
      var isoStart = fmt_(start);
      if (!existing[isoStart]) {
        if (studentId) {
          createDirectBooking_(isoStart, fmt_(stop), studentId, '');
        } else {
          appendRow_(SHEET_NAMES.availability, {
            slot_id: genId_('slot'),
            start_time: isoStart,
            end_time: fmt_(stop),
            status: 'AVAILABLE',
          });
        }
        created.push(isoStart);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return { message: studentId ? 'Recurring lessons scheduled' : 'Weekly availability created', generated: created.length };
}

// Teacher-directly cancels a lesson: removes the calendar event and frees the slot.
function cancelBooking_(bookingId) {
  return runLocked_(function () {
    var booking = findById_(SHEET_NAMES.bookings, 'booking_id', bookingId);
    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'ACTIVE') throw new Error('Booking is not active');
    if (booking.calendar_event_id) deleteCalendarEvent_(booking.calendar_event_id);
    updateById_(SHEET_NAMES.bookings, 'booking_id', booking.booking_id, { status: 'CANCELLED' });
    freeSlot_(booking.start_time);
    return { message: 'Lesson cancelled, calendar event removed' };
  });
}

function getAdminData_() {
  var availability = readAll_(SHEET_NAMES.availability);
  var bookings = readAll_(SHEET_NAMES.bookings);
  var requests = readAll_(SHEET_NAMES.requests);
  var bookedNames = {};
  bookings.forEach(function (b) {
    if (b.status === 'ACTIVE') bookedNames[b.start_time] = b.student_name;
  });
  availability.forEach(function (s) {
    if (String(s.status).toUpperCase() === 'BOOKED' && bookedNames[s.start_time]) {
      s.student_name = bookedNames[s.start_time];
    }
  });
  return {
    students: readAll_(SHEET_NAMES.students),
    availability: availability,
    pendingRequests: requests
      .filter(function (r) { return r.status === 'PENDING'; })
      .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); }),
    requests: requests.sort(function (a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    }),
    bookings: bookings.sort(function (a, b) { return b.start_time.localeCompare(a.start_time); }),
    recurring: readAll_(SHEET_NAMES.recurring),
  };
}

// ============================================================
// Recurring classes
// ============================================================

function createRecurringClass_(studentId, weekday, startTime, endTime, startDate, endDate) {
  var student = findById_(SHEET_NAMES.students, 'student_id', studentId);
  if (!student) throw new Error('Student not found');
  if (WEEKDAYS[String(weekday).toLowerCase()] === undefined) throw new Error('Invalid weekday');
  if (!startDate || !endDate) throw new Error('Start and end dates are required');
  if (startDate > endDate) throw new Error('End date must be after start date');

  var id = genId_('rc');
  appendRow_(SHEET_NAMES.recurring, {
    id: id,
    student_id: studentId,
    student_email: student.email,
    student_name: student.name,
    weekday: weekday,
    start_time: startTime,
    end_time: endTime,
    start_date: startDate,
    end_date: endDate,
    active: 'TRUE',
  });
  var generated = generateRecurringBookings_(id);
  return { message: 'Recurring class created', id: id, generated: generated.length };
}

function generateRecurringBookings_(recurringId) {
  var cls = findById_(SHEET_NAMES.recurring, 'id', recurringId);
  if (!cls) throw new Error('Recurring class not found');
  if (!isTrue_(cls.active)) return [];

  var wd = WEEKDAYS[String(cls.weekday).toLowerCase()];
  if (wd === undefined) throw new Error('Invalid weekday');

  var startDate = new Date(cls.start_date + 'T00:00:00');
  var endDate = new Date(cls.end_date + 'T23:59:59');
  var startParts = String(cls.start_time).split(':').map(Number);
  var endParts = String(cls.end_time).split(':').map(Number);

  var existing = {};
  readAll_(SHEET_NAMES.bookings).forEach(function (b) {
    if (String(b.recurring_id) === String(recurringId) && b.status === 'ACTIVE') {
      existing[b.start_time] = true;
    }
  });

  var created = [];
  var cursor = new Date(startDate);
  var guard = 0;
  while (cursor.getTime() <= endDate.getTime() && guard < 400) {
    if (cursor.getDay() === wd) {
      var start = new Date(cursor); start.setHours(startParts[0], startParts[1], 0, 0);
      var end = new Date(cursor); end.setHours(endParts[0], endParts[1], 0, 0);
      var isoStart = fmt_(start);
      if (!existing[isoStart]) {
        var eventId = createCalendarEvent_(fmt_(start), fmt_(end), cls.student_name, cls.student_email);
        appendRow_(SHEET_NAMES.bookings, {
          booking_id: genId_('bk'),
          student_id: cls.student_id,
          student_email: cls.student_email,
          student_name: cls.student_name,
          start_time: isoStart,
          end_time: fmt_(end),
          status: 'ACTIVE',
          calendar_event_id: eventId,
          recurring_id: String(recurringId),
          created_at: nowIso_(),
        });
        created.push(isoStart);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return created;
}

function disableRecurringClass_(recurringId) {
  var cls = findById_(SHEET_NAMES.recurring, 'id', recurringId);
  if (!cls) throw new Error('Recurring class not found');
  updateById_(SHEET_NAMES.recurring, 'id', recurringId, { active: 'FALSE' });
  var cancelled = cancelFutureOccurrences_(recurringId);
  return { message: 'Recurring class disabled', cancelled: cancelled };
}

function enableRecurringClass_(recurringId) {
  updateById_(SHEET_NAMES.recurring, 'id', recurringId, { active: 'TRUE' });
  var generated = generateRecurringBookings_(recurringId).length;
  return { message: 'Recurring class enabled', generated: generated };
}

function deleteRecurringClass_(recurringId) {
  cancelFutureOccurrences_(recurringId);
  deleteById_(SHEET_NAMES.recurring, 'id', recurringId);
  return { message: 'Recurring class deleted' };
}

function cancelFutureOccurrences_(recurringId) {
  var future = readAll_(SHEET_NAMES.bookings).filter(function (b) {
    return String(b.recurring_id) === String(recurringId) &&
      b.status === 'ACTIVE' &&
      new Date(b.start_time).getTime() > Date.now();
  });
  future.forEach(function (b) {
    if (b.calendar_event_id) deleteCalendarEvent_(b.calendar_event_id);
    updateById_(SHEET_NAMES.bookings, 'booking_id', b.booking_id, { status: 'CANCELLED' });
    freeSlot_(b.start_time);
  });
  return future.length;
}

// ============================================================
// Google Calendar
// ============================================================

function getCalendar_() {
  if (CONFIG.CALENDAR_ID) return CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  return CalendarApp.getDefaultCalendar();
}

function createCalendarEvent_(startIso, endIso, studentName, studentEmail) {
  try {
    var cal = getCalendar_();
    var event = cal.createEvent('Lesson - ' + studentName, new Date(startIso), new Date(endIso), {
      description: 'Student: ' + studentEmail,
    });
    return event.getId();
  } catch (err) {
    console.error('Calendar create failed: ' + err);
    return '';
  }
}

function deleteCalendarEvent_(eventId) {
  try {
    var cal = getCalendar_();
    var event = cal.getEventById(eventId);
    if (event) event.deleteEvent();
  } catch (err) {
    console.error('Calendar delete failed: ' + err);
  }
}

function freeSlot_(startIso) {
  var slot = readAll_(SHEET_NAMES.availability).find(function (s) {
    return s.start_time === startIso && String(s.status).toUpperCase() === 'BOOKED';
  });
  if (slot) updateById_(SHEET_NAMES.availability, 'slot_id', slot.slot_id, { status: 'AVAILABLE' });
}

// ============================================================
// Utilities
// ============================================================

// Serializes critical read-modify-write operations so two students
// (or a student and the teacher) cannot book the same slot at once.
function runLocked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function nowIso_() {
  return new Date().toISOString();
}

function fmt_(date) {
  return Utilities.formatDate(date, CONFIG.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function genId_(prefix) {
  var rand = Math.random().toString(16).slice(2, 8);
  return prefix + '_' + Date.now().toString(36) + rand;
}
