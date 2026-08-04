import { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { api } from '../api';
import { useAuth } from '../auth';
import type { AdminData } from '../types';
import { WEEKDAYS, formatDate, formatDateTime } from '../utils';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function toInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface NewSlot {
  weekdayIndex: number;
  startInput: string;
  endInput: string;
  mode: 'single' | 'weekly';
  weekStartDate: string;
  weekEndDate: string;
}

interface SelectedEvent {
  id: string;
  kind: 'request' | 'slot' | 'booking';
}

export default function CalendarView({ data, onDone }: { data: AdminData; onDone: (msg: string) => void }) {
  const { email } = useAuth();
  const [newSlot, setNewSlot] = useState<NewSlot | null>(null);
  const [selected, setSelected] = useState<SelectedEvent | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pendingBookTimes = new Set(
    data.pendingRequests.filter((r) => r.type === 'BOOK').map((r) => r.start_time),
  );
  const pendingCancelTimes = new Set(
    data.pendingRequests.filter((r) => r.type === 'CANCEL').map((r) => r.start_time),
  );

  const events: EventInput[] = [
    ...data.pendingRequests.map((r) => ({
      id: 'req_' + r.request_id,
      title: r.type === 'BOOK' ? `Request - ${r.student_name}` : `Cancel - ${r.student_name}`,
      start: r.start_time,
      end: r.end_time,
      backgroundColor: r.type === 'BOOK' ? '#f59e0b' : '#e11d48',
      borderColor: r.type === 'BOOK' ? '#f59e0b' : '#e11d48',
      textColor: '#ffffff',
      extendedProps: { kind: 'request' as const },
    })),
    ...data.availability
      .filter(
        (s) =>
          (s.status === 'AVAILABLE' || s.status === 'BLOCKED') &&
          !(s.status === 'AVAILABLE' && pendingBookTimes.has(s.start_time)),
      )
      .map((s) => ({
        id: 'slot_' + s.slot_id,
        title: s.status === 'BLOCKED' ? 'Blocked' : 'Available',
        start: s.start_time,
        end: s.end_time,
        backgroundColor: s.status === 'BLOCKED' ? '#6b7280' : '#22c55e',
        borderColor: s.status === 'BLOCKED' ? '#6b7280' : '#22c55e',
        textColor: '#ffffff',
        extendedProps: { kind: 'slot' as const, slotStatus: s.status },
      })),
    ...data.bookings
      .filter((b) => b.status === 'ACTIVE' && !pendingCancelTimes.has(b.start_time))
      .map((b) => ({
        id: 'bk_' + b.booking_id,
        title: `Lesson - ${b.student_name}`,
        start: b.start_time,
        end: b.end_time,
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
        textColor: '#ffffff',
        extendedProps: { kind: 'booking' as const },
      })),
  ];

  const selectedRequest = data.pendingRequests.find((r) => 'req_' + r.request_id === selected?.id);
  const selectedSlot = data.availability.find((s) => 'slot_' + s.slot_id === selected?.id);
  const selectedBooking = data.bookings.find((b) => 'bk_' + b.booking_id === selected?.id);

  function handleSelect(info: DateSelectArg) {
    if (info.allDay) return;
    const start = new Date(info.startStr);
    const end = new Date(info.endStr);
    if (end.getTime() - start.getTime() < 60 * 60000) end.setTime(start.getTime() + 60 * 60000);
    setError('');
    setNewSlot({
      weekdayIndex: start.getDay(),
      startInput: toInput(start),
      endInput: toInput(end),
      mode: 'single',
      weekStartDate: toDateStr(start),
      weekEndDate: toDateStr(new Date(start.getTime() + 8 * 7 * 86400000)),
    });
  }

  function handleEventClick(info: EventClickArg) {
    const kind = (info.event.extendedProps as { kind?: string }).kind ?? 'booking';
    setError('');
    setSelected({ id: info.event.id, kind: kind as SelectedEvent['kind'] });
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      setSelected(null);
      onDone(message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSlot() {
    if (!newSlot) return;
    setBusy(true);
    try {
      const start = new Date(newSlot.startInput);
      const end = new Date(newSlot.endInput);
      if (end.getTime() <= start.getTime()) throw new Error('End time must be after start time');
      if (newSlot.mode === 'single') {
        await api.createAvailability(email, toIso(start), toIso(end));
        onDone('Availability slot created');
      } else {
        const ws = new Date(newSlot.weekStartDate);
        const we = new Date(newSlot.weekEndDate);
        if (!newSlot.weekStartDate || !newSlot.weekEndDate || we.getTime() < ws.getTime()) {
          throw new Error('End date must be after start date');
        }
        const res = await api.createWeeklyAvailability(email, {
          weekday: WEEKDAYS[newSlot.weekdayIndex].toLowerCase(),
          startTime: newSlot.startInput.split('T')[1].slice(0, 5),
          endTime: newSlot.endInput.split('T')[1].slice(0, 5),
          startDate: toDateStr(ws),
          endDate: toDateStr(we),
        });
        onDone(`Weekly availability created (${res.generated} slots)`);
      }
      setNewSlot(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Chip size="small" label="Available" sx={{ bgcolor: '#22c55e', color: '#fff' }} />
        <Chip size="small" label="Approved lesson" sx={{ bgcolor: '#4f46e5', color: '#fff' }} />
        <Chip size="small" label="Pending request" sx={{ bgcolor: '#f59e0b', color: '#fff' }} />
        <Chip size="small" label="Cancellation" sx={{ bgcolor: '#e11d48', color: '#fff' }} />
        <Chip size="small" label="Blocked" sx={{ bgcolor: '#6b7280', color: '#fff' }} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tip: click an empty time to open availability (this day or weekly); click an event to manage it.
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
          selectable
          selectMirror
          selectOverlap={false}
          unselectAuto
          select={handleSelect}
          eventClick={handleEventClick}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
        />
      </Box>

      {/* New availability dialog */}
      <Dialog open={!!newSlot} onClose={() => setNewSlot(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Set availability</DialogTitle>
        <DialogContent>
          {newSlot && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {WEEKDAYS[newSlot.weekdayIndex]} · {formatDate(newSlot.startInput)} — students can request this open slot.
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}
              <RadioGroup
                row
                value={newSlot.mode}
                onChange={(e) => setNewSlot({ ...newSlot, mode: e.target.value as 'single' | 'weekly' })}
              >
                <FormControlLabel value="single" control={<Radio />} label="This day only" />
                <FormControlLabel value="weekly" control={<Radio />} label={`Weekly (every ${WEEKDAYS[newSlot.weekdayIndex]})`} />
              </RadioGroup>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label="Start"
                  type="datetime-local"
                  value={newSlot.startInput}
                  fullWidth
                  onChange={(e) => setNewSlot({ ...newSlot, startInput: e.target.value })}
                />
                <TextField
                  label="End"
                  type="datetime-local"
                  value={newSlot.endInput}
                  fullWidth
                  onChange={(e) => setNewSlot({ ...newSlot, endInput: e.target.value })}
                />
              </Stack>
              {newSlot.mode === 'weekly' && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    label="Repeat from"
                    type="date"
                    value={newSlot.weekStartDate}
                    fullWidth
                    onChange={(e) => setNewSlot({ ...newSlot, weekStartDate: e.target.value })}
                  />
                  <TextField
                    label="Repeat until"
                    type="date"
                    value={newSlot.weekEndDate}
                    fullWidth
                    onChange={(e) => setNewSlot({ ...newSlot, weekEndDate: e.target.value })}
                  />
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Weekly creates an open slot at this time every week between the two dates.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewSlot(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitSlot} disabled={busy}>
            Create slot
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{selected?.kind === 'request' ? 'Pending request' : selected?.kind === 'slot' ? 'Availability slot' : 'Approved lesson'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {selected?.kind === 'request' && selectedRequest && (
            <>
              <Typography>
                {selectedRequest.type === 'BOOK'
                  ? `${selectedRequest.student_name} wants to book this slot.`
                  : `${selectedRequest.student_name} wants to cancel this lesson.`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {formatDateTime(selectedRequest.start_time)} – {formatDateTime(selectedRequest.end_time)}
              </Typography>
              <Typography variant="body2" color="text.secondary">{selectedRequest.student_email}</Typography>
            </>
          )}
          {selected?.kind === 'slot' && selectedSlot && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                This time is currently {selectedSlot.status === 'BLOCKED' ? 'blocked' : 'open for students'}.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(selectedSlot.start_time)} – {formatDateTime(selectedSlot.end_time)}
              </Typography>
            </>
          )}
          {selected?.kind === 'booking' && selectedBooking && (
            <>
              <Typography>Lesson with {selectedBooking.student_name}.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {formatDateTime(selectedBooking.start_time)} – {formatDateTime(selectedBooking.end_time)}
              </Typography>
              <Typography variant="body2" color="text.secondary">{selectedBooking.student_email}</Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
          {selected?.kind === 'request' && selectedRequest && (
            <>
              <Button
                variant="contained"
                color="error"
                startIcon={<CloseIcon />}
                disabled={busy}
                onClick={() => run(() => api.rejectRequest(email, selectedRequest.request_id), 'Request rejected')}
              >
                Reject
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                disabled={busy}
                onClick={() =>
                  run(() => api.approveRequest(email, selectedRequest.request_id), 'Approved — calendar updated')
                }
              >
                Approve
              </Button>
            </>
          )}
          {selected?.kind === 'slot' && selectedSlot && (
            <>
              {selectedSlot.status === 'BLOCKED' && (
                <Button
                  startIcon={<LockOpenIcon />}
                  disabled={busy}
                  onClick={() => run(() => api.unblockSlot(email, selectedSlot.slot_id), 'Slot unblocked')}
                >
                  Unblock
                </Button>
              )}
              <Button
                color="error"
                startIcon={<DeleteIcon />}
                disabled={busy}
                onClick={() => run(() => api.deleteSlot(email, selectedSlot.slot_id), 'Slot deleted')}
              >
                Delete slot
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
