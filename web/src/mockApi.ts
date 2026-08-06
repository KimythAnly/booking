/**
 * In-browser mock of the Apps Script backend.
 * Activated with VITE_USE_MOCK=true so the UI can be developed/tested
 * without deploying the Apps Script web app. Data lives in localStorage.
 * The teacher email below is "mock" so you can try both roles.
 */

import type {
  AdminData,
  Booking,
  BookingRequest,
  RecurringClass,
  Role,
  Slot,
  Student,
} from './types';

const PREFIX = 'ts_mock_v1_';
const TEACHER_EMAIL = 'teacher@gmail.com';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 6)}`;
}

function getStudents(): Student[] {
  return load<Student[]>('students', []);
}
function getRequests(): BookingRequest[] {
  return load<BookingRequest[]>('requests', []);
}
function getBookings(): Booking[] {
  return load<Booking[]>('bookings', []);
}
function getRecurring(): RecurringClass[] {
  return load<RecurringClass[]>('recurring', []);
}
function getSlots(): Slot[] {
  return load<Slot[]>('availability', []);
}

function getStudent(email: string): Student | undefined {
  return getStudents().find((s) => s.email.toLowerCase() === email.toLowerCase());
}

function getRole(email: string): Role {
  if (email.toLowerCase() === TEACHER_EMAIL) return 'teacher';
  const s = getStudent(email);
  return s && String(s.active).toUpperCase() === 'TRUE' ? 'student' : 'unauthorized';
}

function seed() {
  if (getSlots().length === 0) {
    const slots: Slot[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let d = 0; d < 14; d++) {
      const day = new Date(start.getTime() + d * 86400000);
      if (day.getDay() === 0) continue;
      for (const [h, m] of [[9, 0], [10, 0], [11, 0], [13, 0], [14, 0], [15, 0], [16, 0]]) {
        if (d === 0 && new Date().getTime() > new Date(day).setHours(h, m)) continue;
        const st = new Date(day);
        st.setHours(h, m, 0, 0);
        const en = new Date(st.getTime() + 3600000);
        slots.push({ slot_id: genId('slot'), start_time: st.toISOString(), end_time: en.toISOString(), status: 'AVAILABLE' });
      }
    }
    save('availability', slots);
  }
  if (getStudents().length === 0) {
    save('students', [
      { student_id: 'stu_1', name: 'Alice', email: 'alice@gmail.com', active: 'TRUE' },
      { student_id: 'stu_2', name: 'Bob', email: 'bob@gmail.com', active: 'TRUE' },
    ] as Student[]);
  }
  if (getBookings().length === 0 && getRequests().length === 0) {
    const slots = getSlots();
    const future = slots
      .filter((s) => s.status === 'AVAILABLE' && new Date(s.start_time).getTime() > Date.now())
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const alice = getStudents().find((s) => s.email === 'alice@gmail.com')!;
    const bob = getStudents().find((s) => s.email === 'bob@gmail.com')!;
    if (future.length >= 3 && alice && bob) {
      const reqs = getRequests();
      reqs.push({
        request_id: genId('req'),
        student_id: alice.student_id,
        student_email: alice.email,
        student_name: alice.name,
        type: 'BOOK',
        slot_id: future[0].slot_id,
        booking_id: '',
        start_time: future[0].start_time,
        end_time: future[0].end_time,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      });
      const bookings = getBookings();
      bookings.push({
        booking_id: genId('bk'),
        student_id: bob.student_id,
        student_email: bob.email,
        student_name: bob.name,
        start_time: future[1].start_time,
        end_time: future[1].end_time,
        status: 'ACTIVE',
        calendar_event_id: 'mock_event_seed',
        recurring_id: '',
        created_at: new Date().toISOString(),
      });
      future[1].status = 'BOOKED';
      future[2].status = 'BLOCKED';
      save('requests', reqs);
      save('bookings', bookings);
      save('availability', slots);
    }
  }
}

export default async function mock(action: string, params: Record<string, unknown>): Promise<unknown> {
  seed();
  const email = String(params.email || '');
  const role = getRole(email);

  const requireTeacher = () => {
    if (role !== 'teacher') throw new Error('Teacher access required');
  };
  const requireStudent = () => {
    if (role !== 'student') throw new Error('Student access required');
  };
  const requireAny = () => {
    if (role === 'unauthorized') throw new Error('Valid account required');
  };

  switch (action) {
    case 'validateUser':
      return { role: getRole(email) };

    case 'getAvailableSlots': {
      requireAny();
      const now = Date.now();
      const booked = new Set(getBookings().filter((b) => b.status === 'ACTIVE').map((b) => b.start_time));
      const pending = new Set(
        getRequests().filter((r) => r.type === 'BOOK' && r.status === 'PENDING').map((r) => r.start_time),
      );
      return {
        slots: getSlots()
          .filter((s) => s.status === 'AVAILABLE')
          .filter((s) => new Date(s.start_time).getTime() > now)
          .filter((s) => !booked.has(s.start_time) && !pending.has(s.start_time))
          .sort((a, b) => a.start_time.localeCompare(b.start_time)),
      };
    }

    case 'getMyBookings': {
      requireAny();
      return {
        bookings: getBookings()
          .filter((b) => b.student_email.toLowerCase() === email)
          .sort((a, b) => b.start_time.localeCompare(a.start_time)),
      };
    }

    case 'getMyRequests': {
      requireAny();
      return {
        requests: getRequests()
          .filter((r) => r.student_email.toLowerCase() === email)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      };
    }

    case 'getStudentData': {
      requireAny();
      const now = Date.now();
      const booked = new Set(getBookings().filter((b) => b.status === 'ACTIVE').map((b) => b.start_time));
      const pending = new Set(
        getRequests().filter((r) => r.type === 'BOOK' && r.status === 'PENDING').map((r) => r.start_time),
      );
      return {
        slots: getSlots()
          .filter((s) => s.status === 'AVAILABLE')
          .filter((s) => new Date(s.start_time).getTime() > now)
          .filter((s) => !booked.has(s.start_time) && !pending.has(s.start_time))
          .sort((a, b) => a.start_time.localeCompare(b.start_time)),
        bookings: getBookings()
          .filter((b) => b.student_email.toLowerCase() === email)
          .sort((a, b) => b.start_time.localeCompare(a.start_time)),
        requests: getRequests()
          .filter((r) => r.student_email.toLowerCase() === email)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      };
    }

    case 'requestBooking': {
      requireStudent();
      const slot = getSlots().find((s) => s.slot_id === params.slotId);
      if (!slot) throw new Error('Slot not found');
      if (slot.status !== 'AVAILABLE') throw new Error('This slot is no longer available');
      const student = getStudent(email)!;
      const reqs = getRequests();
      if (reqs.some((r) => r.slot_id === slot.slot_id && r.status === 'PENDING')) {
        throw new Error('A request for this slot is already pending');
      }
      const request: BookingRequest = {
        request_id: genId('req'),
        student_id: student.student_id,
        student_email: student.email,
        student_name: student.name,
        type: 'BOOK',
        slot_id: slot.slot_id,
        booking_id: '',
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      };
      reqs.push(request);
      save('requests', reqs);
      return { message: 'Booking request submitted', request };
    }

    case 'requestCancellation': {
      requireStudent();
      throw new Error('Cancellations are handled by the teacher.');
    }

    case 'getAdminData': {
      requireTeacher();
      return getAdminData();
    }

    case 'approveRequest': {
      requireTeacher();
      const reqs = getRequests();
      const req = reqs.find((r) => r.request_id === params.requestId);
      if (!req) throw new Error('Request not found');
      if (req.status !== 'PENDING') throw new Error('Request already processed');
      const slots = getSlots();
      const bookings = getBookings();
      if (req.type === 'BOOK') {
        const slot = slots.find((s) => s.slot_id === req.slot_id);
        if (!slot || slot.status !== 'AVAILABLE') throw new Error('Slot no longer available');
        bookings.push({
          booking_id: genId('bk'),
          student_id: req.student_id,
          student_email: req.student_email,
          student_name: req.student_name,
          start_time: req.start_time,
          end_time: req.end_time,
          status: 'ACTIVE',
          calendar_event_id: 'mock_event_' + genId('ev'),
          recurring_id: '',
          created_at: new Date().toISOString(),
        });
        slot.status = 'BOOKED';
        req.status = 'APPROVED';
      } else if (req.type === 'CANCEL') {
        const booking = bookings.find((b) => b.booking_id === req.booking_id);
        if (!booking || booking.status !== 'ACTIVE') throw new Error('Booking is not active');
        booking.status = 'CANCELLED';
        const slot = slots.find((s) => s.start_time === booking.start_time && s.status === 'BOOKED');
        if (slot) slot.status = 'AVAILABLE';
        req.status = 'APPROVED';
      }
      save('requests', reqs);
      save('bookings', bookings);
      save('availability', slots);
      return { message: 'Request approved' };
    }

    case 'rejectRequest': {
      requireTeacher();
      const reqs = getRequests();
      const req = reqs.find((r) => r.request_id === params.requestId);
      if (!req) throw new Error('Request not found');
      req.status = 'REJECTED';
      save('requests', reqs);
      return { message: 'Request rejected' };
    }

    case 'listStudents': {
      requireTeacher();
      return { students: getStudents() };
    }

    case 'addStudent': {
      requireTeacher();
      const name = String(params.name || '');
      const stuEmail = String(params.studentEmail || '').toLowerCase();
      if (!name || !stuEmail) throw new Error('Name and email are required');
      if (getStudents().some((s) => s.email.toLowerCase() === stuEmail)) {
        throw new Error('A student with this email already exists');
      }
      const students = getStudents();
      students.push({ student_id: genId('stu'), name, email: stuEmail, active: 'TRUE' });
      save('students', students);
      return { message: 'Student added' };
    }

    case 'disableStudent': {
      requireTeacher();
      const students = getStudents();
      const s = students.find((x) => x.student_id === params.studentId);
      if (s) s.active = 'FALSE';
      save('students', students);
      return { message: 'Student disabled' };
    }

    case 'enableStudent': {
      requireTeacher();
      const students = getStudents();
      const s = students.find((x) => x.student_id === params.studentId);
      if (s) s.active = 'TRUE';
      save('students', students);
      return { message: 'Student enabled' };
    }

    case 'cancelBooking': {
      requireTeacher();
      const bookings = getBookings();
      const booking = bookings.find((b) => b.booking_id === params.bookingId);
      if (!booking) throw new Error('Booking not found');
      if (booking.status !== 'ACTIVE') throw new Error('Booking is not active');
      booking.status = 'CANCELLED';
      save('bookings', bookings);
      const slots = getSlots();
      const slot = slots.find((s) => s.start_time === booking.start_time && s.status === 'BOOKED');
      if (slot) slot.status = 'AVAILABLE';
      save('availability', slots);
      return { message: 'Lesson cancelled' };
    }

    case 'createAvailability': {
      requireTeacher();
      const start = String(params.startTime);
      const end = String(params.endTime);
      if (!start || !end) throw new Error('Start and end times are required');
      if (new Date(start).getTime() >= new Date(end).getTime()) throw new Error('End time must be after start time');
      const studentId = String(params.studentId || '');
      const slots = getSlots();
      if (studentId) {
        createDirectBooking(start, end, studentId);
      } else {
        slots.push({ slot_id: genId('slot'), start_time: start, end_time: end, status: 'AVAILABLE' });
        save('availability', slots);
      }
      return { message: studentId ? 'Lesson scheduled' : 'Slot created' };
    }

    case 'createWeeklyAvailability': {
      requireTeacher();
      const startTime = String(params.startTime);
      const endTime = String(params.endTime);
      const weekday = String(params.weekday).toLowerCase();
      const startDate = String(params.startDate);
      const endDate = String(params.endDate);
      const studentId = String(params.studentId || '');
      if (!startTime || !endTime) throw new Error('Start and end times are required');
      const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekday);
      if (wd === -1) throw new Error('Invalid weekday');
      if (!startDate || !endDate) throw new Error('Start and end dates are required');
      if (startDate > endDate) throw new Error('End date must be after start date');
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const existing = new Set(getSlots().map((s) => s.start_time));
      if (studentId) {
        getBookings().filter((b) => b.status === 'ACTIVE').forEach((b) => existing.add(b.start_time));
      }
      const slots = getSlots();
      const cursor = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      let created = 0;
      let guard = 0;
      while (cursor.getTime() <= end.getTime() && guard < 400) {
        if (cursor.getDay() === wd) {
          const st = new Date(cursor);
          st.setHours(sh, sm, 0, 0);
          const en = new Date(cursor);
          en.setHours(eh, em, 0, 0);
          const isoStart = st.toISOString();
          if (!existing.has(isoStart)) {
            if (studentId) {
              createDirectBooking(isoStart, en.toISOString(), studentId);
            } else {
              slots.push({ slot_id: genId('slot'), start_time: isoStart, end_time: en.toISOString(), status: 'AVAILABLE' });
            }
            existing.add(isoStart);
            created++;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
        guard++;
      }
      save('availability', slots);
      return { message: studentId ? 'Recurring lessons scheduled' : 'Weekly availability created', generated: created };
    }

    case 'blockSlot':
    case 'unblockSlot': {
      requireTeacher();
      const slots = getSlots();
      const s = slots.find((x) => x.slot_id === params.slotId);
      if (s) s.status = action === 'blockSlot' ? 'BLOCKED' : 'AVAILABLE';
      save('availability', slots);
      return { message: 'Slot updated' };
    }

    case 'deleteSlot': {
      requireTeacher();
      save('availability', getSlots().filter((s) => s.slot_id !== params.slotId));
      return { message: 'Slot deleted' };
    }

    case 'createRecurringClass': {
      requireTeacher();
      const student = getStudents().find((s) => s.student_id === params.studentId);
      if (!student) throw new Error('Student not found');
      const rc: RecurringClass = {
        id: genId('rc'),
        student_id: student.student_id,
        student_email: student.email,
        student_name: student.name,
        weekday: String(params.weekday),
        start_time: String(params.startTime),
        end_time: String(params.endTime),
        start_date: String(params.startDate),
        end_date: String(params.endDate),
        active: 'TRUE',
      };
      const all = getRecurring();
      all.push(rc);
      save('recurring', all);
      const generated = generateRecurring(rc, true);
      return { message: 'Recurring class created', id: rc.id, generated };
    }

    case 'generateRecurringBookings': {
      requireTeacher();
      const rc = getRecurring().find((r) => r.id === params.recurringId);
      if (!rc) throw new Error('Recurring class not found');
      const generated = generateRecurring(rc, false);
      return { generated };
    }

    case 'disableRecurringClass': {
      requireTeacher();
      const all = getRecurring();
      const rc = all.find((r) => r.id === params.recurringId);
      if (!rc) throw new Error('Recurring class not found');
      rc.active = 'FALSE';
      save('recurring', all);
      const cancelled = cancelFuture(rc.id);
      return { message: 'Recurring class disabled', cancelled };
    }

    case 'enableRecurringClass': {
      requireTeacher();
      const all = getRecurring();
      const rc = all.find((r) => r.id === params.recurringId);
      if (!rc) throw new Error('Recurring class not found');
      rc.active = 'TRUE';
      save('recurring', all);
      const generated = generateRecurring(rc, false);
      return { message: 'Recurring class enabled', generated };
    }

    case 'deleteRecurringClass': {
      requireTeacher();
      cancelFuture(String(params.recurringId));
      save('recurring', getRecurring().filter((r) => r.id !== params.recurringId));
      return { message: 'Recurring class deleted' };
    }

    default:
      throw new Error('Unknown action: ' + action);
  }
}

function getAdminData(): AdminData {
  const availability = getSlots();
  const bookings = getBookings();
  const bookedNames: Record<string, string> = {};
  bookings.forEach((b) => {
    if (b.status === 'ACTIVE') bookedNames[b.start_time] = b.student_name;
  });
  availability.forEach((s) => {
    if (s.status === 'BOOKED' && bookedNames[s.start_time]) s.student_name = bookedNames[s.start_time];
  });
  return {
    students: getStudents(),
    availability,
    pendingRequests: getRequests().filter((r) => r.status === 'PENDING'),
    requests: getRequests().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    bookings: bookings.sort((a, b) => b.start_time.localeCompare(a.start_time)),
    recurring: getRecurring(),
  };
}

function createDirectBooking(startTime: string, endTime: string, studentId: string) {
  const student = getStudents().find((s) => s.student_id === studentId);
  if (!student) throw new Error('Student not found');
  const bookings = getBookings();
  bookings.push({
    booking_id: genId('bk'),
    student_id: student.student_id,
    student_email: student.email,
    student_name: student.name,
    start_time: startTime,
    end_time: endTime,
    status: 'ACTIVE',
    calendar_event_id: 'mock_event_' + genId('ev'),
    recurring_id: '',
    created_at: new Date().toISOString(),
  });
  save('bookings', bookings);
  const slots = getSlots();
  const slot = slots.find((s) => s.start_time === startTime);
  if (slot) {
    slot.status = 'BOOKED';
  } else {
    slots.push({ slot_id: genId('slot'), start_time: startTime, end_time: endTime, status: 'BOOKED' });
  }
  save('availability', slots);
}

function generateRecurring(rc: RecurringClass, includeAll: boolean): number {
  const startDate = new Date(rc.start_date + 'T00:00:00');
  const endDate = new Date(rc.end_date + 'T23:59:59');
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(
    rc.weekday.toLowerCase(),
  );
  const [sh, sm] = rc.start_time.split(':').map(Number);
  const [eh, em] = rc.end_time.split(':').map(Number);
  const existing = new Set(
    getBookings().filter((b) => b.recurring_id === rc.id && b.status === 'ACTIVE').map((b) => b.start_time),
  );
  let count = 0;
  const cursor = new Date(startDate);
  let guard = 0;
  while (cursor.getTime() <= endDate.getTime() && guard < 400) {
    if (cursor.getDay() === wd) {
      const st = new Date(cursor);
      st.setHours(sh, sm, 0, 0);
      const en = new Date(cursor);
      en.setHours(eh, em, 0, 0);
      const isoStart = st.toISOString();
      if (!includeAll && existing.has(isoStart)) {
        cursor.setDate(cursor.getDate() + 1);
        guard++;
        continue;
      }
      if (!existing.has(isoStart)) {
        const bookings = getBookings();
        bookings.push({
          booking_id: genId('bk'),
          student_id: rc.student_id,
          student_email: rc.student_email,
          student_name: rc.student_name,
          start_time: isoStart,
          end_time: en.toISOString(),
          status: 'ACTIVE',
          calendar_event_id: 'mock_event_' + genId('ev'),
          recurring_id: rc.id,
          created_at: new Date().toISOString(),
        });
        save('bookings', bookings);
        existing.add(isoStart);
        count++;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return count;
}

function cancelFuture(recurringId: string): number {
  const bookings = getBookings();
  const slots = getSlots();
  let cancelled = 0;
  bookings.forEach((b) => {
    if (b.recurring_id === recurringId && b.status === 'ACTIVE' && new Date(b.start_time).getTime() > Date.now()) {
      b.status = 'CANCELLED';
      cancelled++;
      const slot = slots.find((s) => s.start_time === b.start_time && s.status === 'BOOKED');
      if (slot) slot.status = 'AVAILABLE';
    }
  });
  save('bookings', bookings);
  save('availability', slots);
  return cancelled;
}
