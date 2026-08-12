import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
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
  studentId: string;
  classTypeId: string;
  weekStartDate: string;
  weekEndDate: string;
}

interface SelectedEvent {
  id: string;
  kind: 'request' | 'slot' | 'booking';
}

interface CreatingSlot {
  id: string;
  start: string;
  end: string;
  resolved?: boolean;
}

export default function CalendarView({ data, onDone }: { data: AdminData; onDone: (msg: string) => void }) {
  const { email } = useAuth();
  const [newSlot, setNewSlot] = useState<NewSlot | null>(null);
  const [selected, setSelected] = useState<SelectedEvent | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<CreatingSlot[]>([]);
  const [giveQuota, setGiveQuota] = useState(true);
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    const known = new Set([
      ...data.pendingRequests.map((r) => 'req_' + r.request_id),
      ...data.availability.map((s) => 'slot_' + s.slot_id),
      ...data.bookings.map((b) => 'bk_' + b.booking_id),
    ]);
    setDone((prev) => {
      const next = new Set([...prev].filter((k) => known.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  useEffect(() => {
    if (creating.length === 0) return;
    const byTime = new Set(data.availability.map((s) => s.start_time + '|' + s.end_time));
    setCreating((prev) => prev.filter((c) => !(c.resolved && byTime.has(c.start + '|' + c.end))));
  }, [data, creating.length]);

  const pendingBookTimes = new Set(
    data.pendingRequests.filter((r) => r.type === 'BOOK').map((r) => r.start_time),
  );
  const pendingCancelTimes = new Set(
    data.pendingRequests.filter((r) => r.type === 'CANCEL').map((r) => r.start_time),
  );

  const events: EventInput[] = [
    ...data.pendingRequests
      .filter((r) => !done.has('req_' + r.request_id))
      .map((r) => {
        const label = processing['req_' + r.request_id];
        return {
          id: 'req_' + r.request_id,
          title: label
            ? `${label} - ${r.student_name}`
            : r.type === 'BOOK'
              ? `Request - ${r.student_name} (${r.class_type_name || 'General'})`
              : `Cancel - ${r.student_name} (${r.class_type_name || 'General'})`,
          start: r.start_time,
          end: r.end_time,
          backgroundColor: label ? '#94a3b8' : r.type === 'BOOK' ? '#f59e0b' : '#e11d48',
          borderColor: label ? '#94a3b8' : r.type === 'BOOK' ? '#f59e0b' : '#e11d48',
          textColor: '#ffffff',
          extendedProps: { kind: 'request' as const },
        };
      }),
    ...data.availability
      .filter(
        (s) =>
          (s.status === 'AVAILABLE' || s.status === 'BLOCKED') &&
          !(s.status === 'AVAILABLE' && pendingBookTimes.has(s.start_time)) &&
          !done.has('slot_' + s.slot_id),
      )
      .map((s) => {
        const label = processing['slot_' + s.slot_id];
        return {
          id: 'slot_' + s.slot_id,
          title: label || (s.status === 'BLOCKED' ? 'Blocked' : `Available (${s.class_type_name || 'General'})`),
          start: s.start_time,
          end: s.end_time,
          backgroundColor: label ? '#94a3b8' : s.status === 'BLOCKED' ? '#6b7280' : '#22c55e',
          borderColor: label ? '#94a3b8' : s.status === 'BLOCKED' ? '#6b7280' : '#22c55e',
          textColor: '#ffffff',
          extendedProps: { kind: 'slot' as const, slotStatus: s.status },
        };
      }),
    ...data.bookings
      .filter((b) => b.status === 'ACTIVE' && !pendingCancelTimes.has(b.start_time) && !done.has('bk_' + b.booking_id))
      .map((b) => {
        const label = processing['bk_' + b.booking_id];
        return {
          id: 'bk_' + b.booking_id,
          title: label || `Lesson - ${b.student_name} (${b.class_type_name || 'General'})`,
          start: b.start_time,
          end: b.end_time,
          backgroundColor: label ? '#94a3b8' : '#4f46e5',
          borderColor: label ? '#94a3b8' : '#4f46e5',
          textColor: '#ffffff',
          extendedProps: { kind: 'booking' as const },
        };
      }),
    ...creating.map((c) => ({
      id: 'creating_' + c.id,
      title: c.resolved ? 'Available…' : 'Creating…',
      start: c.start,
      end: c.end,
      backgroundColor: c.resolved ? '#22c55e' : '#94a3b8',
      borderColor: c.resolved ? '#22c55e' : '#94a3b8',
      textColor: '#ffffff',
      extendedProps: { kind: 'creating' as const },
    })),
  ];

  const selectedRequest = data.pendingRequests.find((r) => 'req_' + r.request_id === selected?.id);
  const selectedSlot = data.availability.find((s) => 'slot_' + s.slot_id === selected?.id);
  const selectedBooking = data.bookings.find((b) => 'bk_' + b.booking_id === selected?.id);
  const activeStudents = data.students.filter((s) => String(s.active).toUpperCase() === 'TRUE');
  const activeTypes = data.classTypes.filter((c) => String(c.active).toUpperCase() === 'TRUE');

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
      studentId: '',
      classTypeId: activeTypes[0]?.id ?? '',
      weekStartDate: toDateStr(start),
      weekEndDate: toDateStr(new Date(start.getTime() + 8 * 7 * 86400000)),
    });
  }

  function handleEventClick(info: EventClickArg) {
    const kind = (info.event.extendedProps as { kind?: string }).kind ?? 'booking';
    if (kind === 'creating') return;
    setError('');
    if (kind === 'booking') setGiveQuota(true);
    setSelected({ id: info.event.id, kind: kind as SelectedEvent['kind'] });
  }

  function fire(action: () => Promise<unknown>, message: string, key?: string, label?: string) {
    if (key && inFlight.current.has(key)) return;
    if (key) inFlight.current.add(key);
    setSelected(null);
    if (key) setProcessing((prev) => ({ ...prev, [key]: label ?? 'Processing…' }));
    action()
      .then(() => {
        if (key) setDone((prev) => new Set(prev).add(key));
        onDone(message);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => {
        if (key) {
          inFlight.current.delete(key);
          setProcessing((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      });
  }

  function createSlot() {
    if (!newSlot) return;
    let start: Date;
    let end: Date;
    try {
      start = new Date(newSlot.startInput);
      end = new Date(newSlot.endInput);
      if (end.getTime() <= start.getTime()) throw new Error('End time must be after start time');
      if (newSlot.mode === 'weekly') {
        const ws = new Date(newSlot.weekStartDate);
        const we = new Date(newSlot.weekEndDate);
        if (!newSlot.weekStartDate || !newSlot.weekEndDate || we.getTime() < ws.getTime()) {
          throw new Error('End date must be after start date');
        }
      }
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const slot = newSlot;
    const placeholder: CreatingSlot = { id: 'tmp_' + Date.now(), start: toIso(start), end: toIso(end) };
    setCreating((prev) => [...prev, placeholder]);
    setNewSlot(null);
    setError('');

    const action = (): Promise<{ generated?: number }> => {
      if (slot.mode === 'single') {
        return api
          .createAvailability(email, toIso(start), toIso(end), slot.classTypeId, slot.studentId || undefined)
          .then(() => ({ generated: 0 }));
      }
      const ws = new Date(slot.weekStartDate);
      const we = new Date(slot.weekEndDate);
      return api
        .createWeeklyAvailability(email, {
          weekday: WEEKDAYS[slot.weekdayIndex].toLowerCase(),
          startTime: slot.startInput.split('T')[1].slice(0, 5),
          endTime: slot.endInput.split('T')[1].slice(0, 5),
          startDate: toDateStr(ws),
          endDate: toDateStr(we),
          classTypeId: slot.classTypeId,
          studentId: slot.studentId || undefined,
        })
        .then((res) => ({ generated: res.generated }));
    };

    action()
      .then((res) => {
        setCreating((prev) => prev.map((c) => (c.id === placeholder.id ? { ...c, resolved: true } : c)));
        onDone(
          slot.mode === 'single'
            ? slot.studentId
              ? 'Lesson scheduled'
              : 'Availability slot created'
            : slot.studentId
              ? `Weekly lessons scheduled (${res.generated ?? 0})`
              : `Weekly availability created (${res.generated ?? 0} slots)`,
        );
      })
      .catch((err) => {
        setCreating((prev) => prev.filter((c) => c.id !== placeholder.id));
        setError((err as Error).message);
      });
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
                {WEEKDAYS[newSlot.weekdayIndex]} · {formatDate(newSlot.startInput)}
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
              <TextField
                select
                label="Assign to"
                size="small"
                value={newSlot.studentId}
                fullWidth
                sx={{ mt: 2 }}
                onChange={(e) => setNewSlot({ ...newSlot, studentId: e.target.value })}
                helperText={
                  newSlot.studentId
                    ? 'Schedules a lesson for this student (added to your calendar).'
                    : 'Open slot that students can request.'
                }
              >
                <MenuItem value="">Open slot (students can request)</MenuItem>
                {activeStudents.map((s) => (
                  <MenuItem key={s.student_id} value={s.student_id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Class type"
                size="small"
                value={newSlot.classTypeId}
                fullWidth
                sx={{ mt: 2 }}
                onChange={(e) => setNewSlot({ ...newSlot, classTypeId: e.target.value })}
                helperText="The subject of this class. Students can only book types they have quota for."
              >
                {activeTypes.map((ct) => (
                  <MenuItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </MenuItem>
                ))}
              </TextField>
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
          <Button variant="contained" onClick={createSlot}>
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
              <Typography variant="body2" color="text.secondary">
                {selectedBooking.class_type_name || 'General'} · {selectedBooking.student_email}
              </Typography>
              {selectedBooking.recurring_id && (
                <FormControlLabel
                  control={<Checkbox checked={giveQuota} onChange={(e) => setGiveQuota(e.target.checked)} />}
                  label="Give the student 1 quota for this cancelled class"
                  sx={{ mt: 2 }}
                />
              )}
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
                onClick={() =>
                  fire(
                    () => api.rejectRequest(email, selectedRequest.request_id),
                    'Request rejected',
                    'req_' + selectedRequest.request_id,
                    'Rejecting…',
                  )
                }
              >
                Reject
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={() =>
                  fire(
                    () => api.approveRequest(email, selectedRequest.request_id),
                    'Approved — calendar updated',
                    'req_' + selectedRequest.request_id,
                    'Approving…',
                  )
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
                  onClick={() =>
                    fire(
                      () => api.unblockSlot(email, selectedSlot.slot_id),
                      'Slot unblocked',
                      'slot_' + selectedSlot.slot_id,
                      'Unblocking…',
                    )
                  }
                >
                  Unblock
                </Button>
              )}
              <Button
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() =>
                  fire(
                    () => api.deleteSlot(email, selectedSlot.slot_id),
                    'Slot deleted',
                    'slot_' + selectedSlot.slot_id,
                    'Deleting…',
                  )
                }
              >
                Delete slot
              </Button>
            </>
          )}
          {selected?.kind === 'booking' && selectedBooking && (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() =>
                fire(
                  () => api.cancelBooking(email, selectedBooking.booking_id, giveQuota),
                  'Lesson cancelled — calendar updated',
                  'bk_' + selectedBooking.booking_id,
                  'Cancelling…',
                )
              }
            >
              Cancel lesson
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
