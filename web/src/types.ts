export type Role = 'teacher' | 'student' | 'unauthorized';

export interface ClassType {
  id: string;
  name: string;
  active: string | boolean;
}

export interface StudentQuota {
  id: string;
  student_id: string;
  student_name: string;
  class_type_id: string;
  class_type_name: string;
  quota: number | string;
}

export interface Student {
  student_id: string;
  name: string;
  email: string;
  active: string | boolean;
  created_at?: string;
}

export type SlotStatus = 'AVAILABLE' | 'BLOCKED' | 'BOOKED';

export interface Slot {
  slot_id: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  student_name?: string;
  class_type_id?: string;
  class_type_name?: string;
}

export type BookingStatus = 'ACTIVE' | 'CANCELLED';

export interface Booking {
  booking_id: string;
  student_id: string;
  student_email: string;
  student_name: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  calendar_event_id?: string;
  created_at?: string;
  class_type_id?: string;
  class_type_name?: string;
  quota_consumed?: string | boolean;
}

export type RequestType = 'BOOK' | 'CANCEL';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface BookingRequest {
  request_id: string;
  student_id: string;
  student_email: string;
  student_name: string;
  type: RequestType;
  slot_id?: string;
  booking_id?: string;
  start_time: string;
  end_time: string;
  status: RequestStatus;
  created_at?: string;
  class_type_id?: string;
  class_type_name?: string;
}

export interface AdminData {
  students: Student[];
  availability: Slot[];
  pendingRequests: BookingRequest[];
  requests: BookingRequest[];
  bookings: Booking[];
  classTypes: ClassType[];
  quotas: StudentQuota[];
}

export interface StudentData {
  slots: Slot[];
  bookings: Booking[];
  requests: BookingRequest[];
  classTypes: ClassType[];
  quotas: StudentQuota[];
}
