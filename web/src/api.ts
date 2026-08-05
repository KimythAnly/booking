import type {
  AdminData,
  Booking,
  BookingRequest,
  Role,
  Slot,
  Student,
} from './types';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if (USE_MOCK) {
    const mock = (await import('./mockApi')).default;
    return mock(action, params) as Promise<T>;
  }
  if (!APPS_SCRIPT_URL) {
    throw new ApiError('Apps Script URL is not configured. Set VITE_APPS_SCRIPT_URL or VITE_USE_MOCK=true.');
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script web apps do not answer.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...params }),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError('The Apps Script backend returned a non-JSON response (did you deploy it and allow "Anyone with a Google account"?).');
  }
  if (data.error) throw new ApiError(data.error);
  return data as T;
}

export const api = {
  validateUser: (email: string) => call<{ role: Role }>('validateUser', { email }),

  // Student
  getAvailableSlots: (email: string) => call<{ slots: Slot[] }>('getAvailableSlots', { email }),
  getMyBookings: (email: string) => call<{ bookings: Booking[] }>('getMyBookings', { email }),
  getMyRequests: (email: string) => call<{ requests: BookingRequest[] }>('getMyRequests', { email }),
  requestBooking: (email: string, slotId: string) =>
    call<{ message: string }>('requestBooking', { email, slotId }),

  // Teacher
  getAdminData: (email: string) => call<AdminData>('getAdminData', { email }),
  approveRequest: (email: string, requestId: string) =>
    call<{ message: string }>('approveRequest', { email, requestId }),
  rejectRequest: (email: string, requestId: string) =>
    call<{ message: string }>('rejectRequest', { email, requestId }),
  listStudents: (email: string) => call<{ students: Student[] }>('listStudents', { email }),
  addStudent: (email: string, name: string, studentEmail: string) =>
    call<{ message: string }>('addStudent', { email, name, studentEmail }),
  disableStudent: (email: string, studentId: string) =>
    call<{ message: string }>('disableStudent', { email, studentId }),
  enableStudent: (email: string, studentId: string) =>
    call<{ message: string }>('enableStudent', { email, studentId }),
  cancelBooking: (email: string, bookingId: string) =>
    call<{ message: string }>('cancelBooking', { email, bookingId }),
  createAvailability: (email: string, startTime: string, endTime: string, studentId?: string) =>
    call<{ message: string }>('createAvailability', { email, startTime, endTime, studentId: studentId || '' }),
  createWeeklyAvailability: (
    email: string,
    data: { weekday: string; startTime: string; endTime: string; startDate: string; endDate: string; studentId?: string },
  ) =>
    call<{ message: string; generated: number }>('createWeeklyAvailability', {
      email,
      ...data,
      studentId: data.studentId || '',
    }),
  blockSlot: (email: string, slotId: string) => call<{ message: string }>('blockSlot', { email, slotId }),
  unblockSlot: (email: string, slotId: string) => call<{ message: string }>('unblockSlot', { email, slotId }),
  deleteSlot: (email: string, slotId: string) => call<{ message: string }>('deleteSlot', { email, slotId }),
  createRecurringClass: (
    email: string,
    data: {
      studentId: string;
      weekday: string;
      startTime: string;
      endTime: string;
      startDate: string;
      endDate: string;
    },
  ) => call<{ message: string; id: string; generated: number }>('createRecurringClass', { email, ...data }),
  generateRecurringBookings: (email: string, recurringId: string) =>
    call<{ generated: number }>('generateRecurringBookings', { email, recurringId }),
  disableRecurringClass: (email: string, recurringId: string) =>
    call<{ message: string; cancelled: number }>('disableRecurringClass', { email, recurringId }),
  enableRecurringClass: (email: string, recurringId: string) =>
    call<{ message: string; generated: number }>('enableRecurringClass', { email, recurringId }),
  deleteRecurringClass: (email: string, recurringId: string) =>
    call<{ message: string }>('deleteRecurringClass', { email, recurringId }),
};
