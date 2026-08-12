import { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventInput } from '@fullcalendar/core';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { api } from '../api';
import { useAuth } from '../auth';
import { useMutation } from '../hooks/useMutation';
import type { Booking, BookingRequest, Slot, StudentQuota } from '../types';
import { formatDateTime } from '../utils';

interface Props {
  slots: Slot[];
  bookings: Booking[];
  requests: BookingRequest[];
  quotas: StudentQuota[];
  onRequesting: (slot: Slot) => void;
  onRequestFailed: (slot: Slot) => void;
  onDone: (msg: string, request?: BookingRequest) => void;
}

export default function StudentCalendar({
  slots,
  bookings,
  requests,
  quotas,
  onRequesting,
  onRequestFailed,
  onDone,
}: Props) {
  const { email } = useAuth();
  const mutate = useMutation();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);

  const quotaByType = new Map(quotas.map((q) => [q.class_type_id, Number(q.quota) || 0]));
  const hasQuota = (s: Slot) => (quotaByType.get(s.class_type_id || '') ?? 0) > 0;

  const events: EventInput[] = [
    ...slots.map((s) => {
      const blocked = !hasQuota(s);
      const typeName = s.class_type_name || 'General';
      return {
        id: 'av_' + s.slot_id,
        title: blocked ? `${typeName} — no quota` : `${typeName} · Available`,
        start: s.start_time,
        end: s.end_time,
        backgroundColor: blocked ? '#9ca3af' : '#22c55e',
        borderColor: blocked ? '#9ca3af' : '#22c55e',
        textColor: '#ffffff',
        extendedProps: { kind: 'available' as const, blocked },
      };
    }),
    ...bookings
      .filter((b) => b.status === 'ACTIVE')
      .map((b) => ({
        id: 'bk_' + b.booking_id,
        title: b.class_type_name ? `${b.class_type_name} · My lesson` : 'My lesson',
        start: b.start_time,
        end: b.end_time,
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
        textColor: '#ffffff',
        extendedProps: { kind: 'booking' as const },
      })),
    ...requests
      .filter((r) => r.status === 'PENDING')
      .map((r) => {
        const requesting = r.request_id.startsWith('tmp_');
        return {
          id: 'req_' + r.request_id,
          title: requesting
            ? 'Requesting booking…'
            : r.type === 'CANCEL'
              ? `Cancellation request${r.class_type_name ? ` · ${r.class_type_name}` : ''}`
              : `Booking request${r.class_type_name ? ` · ${r.class_type_name}` : ''}`,
          start: r.start_time,
          end: r.end_time,
          backgroundColor: requesting ? '#94a3b8' : r.type === 'CANCEL' ? '#e11d48' : '#f59e0b',
          borderColor: requesting ? '#94a3b8' : r.type === 'CANCEL' ? '#e11d48' : '#f59e0b',
          textColor: '#ffffff',
          extendedProps: { kind: 'request' as const },
        };
      }),
  ];

  function handleEventClick(info: EventClickArg) {
    const kind = (info.event.extendedProps as { kind?: string }).kind;
    if (kind === 'available') {
      setSelectedSlot(slots.find((s) => 'av_' + s.slot_id === info.event.id) ?? null);
    } else if (kind === 'booking') {
      setSelectedBooking(bookings.find((b) => 'bk_' + b.booking_id === info.event.id) ?? null);
    } else {
      setSelectedRequest(requests.find((r) => 'req_' + r.request_id === info.event.id) ?? null);
    }
  }

  function requestBooking(slot: Slot) {
    setSelectedSlot(null);
    mutate({
      optimistic: () => onRequesting(slot),
      rollback: () => onRequestFailed(slot),
      action: () => api.requestBooking(email, slot.slot_id),
      onSuccess: (res) =>
        onDone(`Booking requested for ${formatDateTime(slot.start_time)}. Waiting for approval.`, res.request),
    });
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Chip size="small" label="Available to book" sx={{ bgcolor: '#22c55e', color: '#fff' }} />
        <Chip size="small" label="My lesson" sx={{ bgcolor: '#4f46e5', color: '#fff' }} />
        <Chip size="small" label="Pending request" sx={{ bgcolor: '#f59e0b', color: '#fff' }} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tip: click a green slot to request a booking.
      </Typography>
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, p: 1 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          height="auto"
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          nowIndicator
          eventClick={handleEventClick}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
        />
      </Box>

      {/* Book slot dialog */}
      <Dialog open={!!selectedSlot} onClose={() => setSelectedSlot(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Request booking</DialogTitle>
        <DialogContent>
          {selectedSlot && (() => {
            const blocked = !hasQuota(selectedSlot);
            return (
              <>
                <Typography>{blocked ? 'You have no quota for this class type.' : 'Book this open slot?'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedSlot.class_type_name || 'General'} · {formatDateTime(selectedSlot.start_time)} –{' '}
                  {formatDateTime(selectedSlot.end_time)}
                </Typography>
                {blocked ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Your teacher adds quota, or you may receive one when a regular class is cancelled.
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    The teacher must approve your request before the lesson is confirmed.
                  </Typography>
                )}
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedSlot(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!!selectedSlot && !hasQuota(selectedSlot)}
            onClick={() => selectedSlot && requestBooking(selectedSlot)}
          >
            Send request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lesson info dialog */}
      <Dialog open={!!selectedBooking} onClose={() => setSelectedBooking(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Your lesson</DialogTitle>
        <DialogContent>
          {selectedBooking && (
            <>
              <Typography variant="body2" color="text.secondary">
                {selectedBooking.class_type_name || 'General'} · {formatDateTime(selectedBooking.start_time)} –{' '}
                {formatDateTime(selectedBooking.end_time)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Cancellations are handled by the teacher.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedBooking(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Request info dialog */}
      <Dialog open={!!selectedRequest} onClose={() => setSelectedRequest(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Request status</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography>
                  {selectedRequest.type === 'BOOK' ? 'Booking request' : 'Cancellation request'}
                  {selectedRequest.class_type_name ? ` · ${selectedRequest.class_type_name}` : ''}
                </Typography>
                <Chip size="small" color="warning" label="Pending approval" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(selectedRequest.start_time)} – {formatDateTime(selectedRequest.end_time)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                You'll see the result here once the teacher reviews it.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRequest(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
