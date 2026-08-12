import type {
  AdminData,
  Booking,
  BookingRequest,
  ClassType,
  Role,
  Slot,
  Student,
  StudentData,
} from './types';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const REQUEST_TIMEOUT_MS = 45000;

async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if (USE_MOCK) {
    const mock = (await import('./mockApi')).default;
    return mock(action, params) as Promise<T>;
  }
  if (!APPS_SCRIPT_URL) {
    throw new ApiError('Apps Script URL is not configured. Set VITE_APPS_SCRIPT_URL or VITE_USE_MOCK=true.');
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // text/plain avoids a CORS preflight, which Apps Script web apps do not answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...params }),
      signal: controller.signal,
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
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  validateUser: (email: string) => call<{ role: Role }>('validateUser', { email }),

  // Student
  getAvailableSlots: (email: string) => call<{ slots: Slot[] }>('getAvailableSlots', { email }),
  getMyBookings: (email: string) => call<{ bookings: Booking[] }>('getMyBookings', { email }),
  getMyRequests: (email: string) => call<{ requests: BookingRequest[] }>('getMyRequests', { email }),
  getStudentData: (email: string) => call<StudentData>('getStudentData', { email }),
  requestBooking: (email: string, slotId: string) =>
    call<{ message: string; request: BookingRequest }>('requestBooking', { email, slotId }),

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
  cancelBooking: (email: string, bookingId: string, giveQuota = true) =>
    call<{ message: string }>('cancelBooking', { email, bookingId, giveQuota }),
  createAvailability: (email: string, startTime: string, endTime: string, classTypeId: string, studentId?: string) =>
    call<{ message: string }>('createAvailability', {
      email,
      startTime,
      endTime,
      classTypeId,
      studentId: studentId || '',
    }),
  createWeeklyAvailability: (
    email: string,
    data: {
      weekday: string;
      startTime: string;
      endTime: string;
      startDate: string;
      endDate: string;
      classTypeId: string;
      studentId?: string;
    },
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
      classTypeId: string;
      weekday: string;
      startTime: string;
      endTime: string;
      startDate: string;
      endDate: string;
    },
  ) => call<{ message: string; id: string; generated: number }>('createRecurringClass', { email, ...data }),
  generateRecurringBookings: (email: string, recurringId: string) =>
    call<{ generated: number }>('generateRecurringBookings', { email, recurringId }),
  disableRecurringClass: (email: string, recurringId: string, giveQuota = true) =>
    call<{ message: string; cancelled: number }>('disableRecurringClass', { email, recurringId, giveQuota }),
  enableRecurringClass: (email: string, recurringId: string) =>
    call<{ message: string; generated: number }>('enableRecurringClass', { email, recurringId }),
  deleteRecurringClass: (email: string, recurringId: string, giveQuota = true) =>
    call<{ message: string }>('deleteRecurringClass', { email, recurringId, giveQuota }),

  // Class types & quotas
  listClassTypes: (email: string) => call<{ classTypes: ClassType[] }>('listClassTypes', { email }),
  addClassType: (email: string, name: string) => call<{ message: string }>('addClassType', { email, name }),
  deleteClassType: (email: string, classTypeId: string) =>
    call<{ message: string }>('deleteClassType', { email, classTypeId }),
  setStudentQuota: (email: string, studentId: string, classTypeId: string, quota: number) =>
    call<{ message: string }>('setStudentQuota', { email, studentId, classTypeId, quota }),
};
