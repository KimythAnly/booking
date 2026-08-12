import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { api } from '../api';
import { useAuth } from '../auth';
import type { ClassType, RecurringClass, Student } from '../types';
import { WEEKDAYS, formatShortTime } from '../utils';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CancelAction {
  rc: RecurringClass;
  action: 'disable' | 'delete';
}

export default function RecurringClasses({
  recurring,
  students,
  classTypes,
  onDone,
}: {
  recurring: RecurringClass[];
  students: Student[];
  classTypes: ClassType[];
  onDone: (msg: string) => void;
}) {
  const { email } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [classTypeId, setClassTypeId] = useState('');
  const [weekday, setWeekday] = useState('Monday');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [startDate, setStartDate] = useState(toDateStr(new Date()));
  const [endDate, setEndDate] = useState(toDateStr(new Date(Date.now() + 8 * 7 * 86400000)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelAction, setCancelAction] = useState<CancelAction | null>(null);
  const [giveQuota, setGiveQuota] = useState(true);

  const activeStudents = students.filter((s) => String(s.active).toUpperCase() === 'TRUE');
  const activeTypes = classTypes.filter((c) => String(c.active).toUpperCase() === 'TRUE');

  async function create() {
    if (!studentId) {
      setError('Choose a student');
      return;
    }
    if (!startTime || !endTime || startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      setError('End date must be after start date');
      return;
    }
    setBusy(true);
    try {
      await api.createRecurringClass(email, {
        studentId,
        classTypeId,
        weekday,
        startTime,
        endTime,
        startDate,
        endDate,
      });
      onDone('Regular class created');
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(rc: RecurringClass) {
    setBusy(true);
    try {
      if (String(rc.active).toUpperCase() === 'TRUE') {
        setCancelAction({ rc, action: 'disable' });
      } else {
        const res = await api.enableRecurringClass(email, rc.id);
        onDone(`Regular class enabled (${res.generated} upcoming lesson(s) added)`);
        setError('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    if (!cancelAction) return;
    const { rc, action } = cancelAction;
    setBusy(true);
    try {
      if (action === 'disable') {
        const res = await api.disableRecurringClass(email, rc.id, giveQuota);
        onDone(
          `Regular class disabled — ${res.cancelled} upcoming lesson(s) cancelled${giveQuota ? ', student(s) received 1 quota each' : ''}`,
        );
      } else {
        await api.deleteRecurringClass(email, rc.id, giveQuota);
        onDone(`Regular class deleted${giveQuota ? ', students received 1 quota per cancelled lesson' : ''}`);
      }
      setCancelAction(null);
      setGiveQuota(true);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...recurring].sort((a, b) => {
    if (String(a.active) !== String(b.active)) return String(a.active) === 'TRUE' ? -1 : 1;
    return a.student_name.localeCompare(b.student_name);
  });

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        New regular class
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A regular class repeats weekly for one student. It is added straight to the calendar — it does not use the
        student's booking quota. If you later cancel it, you can compensate the student with quota.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <TextField
          select
          label="Student"
          size="small"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          sx={{ width: 180 }}
        >
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
          value={classTypeId}
          onChange={(e) => setClassTypeId(e.target.value)}
          sx={{ width: 160 }}
        >
          {activeTypes.map((ct) => (
            <MenuItem key={ct.id} value={ct.id}>
              {ct.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Weekday"
          size="small"
          value={weekday}
          onChange={(e) => setWeekday(e.target.value)}
          sx={{ width: 140 }}
        >
          {WEEKDAYS.map((w) => (
            <MenuItem key={w} value={w}>
              {w}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Start"
          size="small"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <TextField
          label="End"
          size="small"
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
        <TextField
          label="From"
          size="small"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <TextField
          label="Until"
          size="small"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={create} disabled={busy}>
          Create
        </Button>
      </Stack>

      <TableContainer sx={{ boxShadow: 1, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((rc) => {
              const isActive = String(rc.active).toUpperCase() === 'TRUE';
              return (
                <TableRow key={rc.id} hover>
                  <TableCell>{rc.student_name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={rc.class_type_name || 'General'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {WEEKDAYS[weekdayIndexOf(rc.weekday)]} · {formatShortTime(rc.start_time)} –{' '}
                    {formatShortTime(rc.end_time)}
                  </TableCell>
                  <TableCell>
                    {rc.start_date} → {rc.end_date}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={isActive ? 'success' : 'default'} label={isActive ? 'Active' : 'Paused'} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={isActive ? <PauseIcon /> : <PlayArrowIcon />}
                      onClick={() => toggleActive(rc)}
                      disabled={busy}
                    >
                      {isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => {
                        setCancelAction({ rc, action: 'delete' });
                        setGiveQuota(true);
                      }}
                      disabled={busy}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!cancelAction} onClose={() => setCancelAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{cancelAction?.action === 'disable' ? 'Disable regular class?' : 'Delete regular class?'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {cancelAction?.action === 'disable'
              ? `This pauses the class for ${cancelAction.rc.student_name} and cancels its upcoming lessons.`
              : `This permanently deletes the regular class for ${cancelAction?.rc.student_name} and cancels its upcoming lessons.`}
          </DialogContentText>
          <FormControlLabel
            control={
              <Checkbox checked={giveQuota} onChange={(e) => setGiveQuota(e.target.checked)} />
            }
            label="Give the student 1 quota per cancelled lesson (so they can book a replacement)"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelAction(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmCancel} disabled={busy}>
            {cancelAction?.action === 'disable' ? 'Disable' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function weekdayIndexOf(name: string): number {
  const idx = WEEKDAYS.map((w) => w.toLowerCase()).indexOf(name.toLowerCase());
  return idx === -1 ? 0 : idx;
}
