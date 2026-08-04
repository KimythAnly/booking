import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../api';
import { useAuth } from '../auth';
import type { AdminData, RecurringClass } from '../types';
import { WEEKDAYS, formatShortTime } from '../utils';

export default function RecurringClassManagement({
  data,
  onDone,
}: {
  data: AdminData;
  onDone: (msg: string) => void;
}) {
  const { email } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [weekday, setWeekday] = useState('Friday');
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('14:00');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const activeStudents = data.students.filter((s) => String(s.active).toUpperCase() === 'TRUE');

  async function createClass() {
    if (!studentId || !endDate) {
      setError('Student, start date, and end date are required.');
      return;
    }
    if (startDate > endDate) {
      setError('End date must be after start date.');
      return;
    }
    try {
      const res = await api.createRecurringClass(email, {
        studentId,
        weekday,
        startTime,
        endTime,
        startDate,
        endDate,
      });
      onDone(`Recurring class created with ${res.generated} bookings generated`);
      setStudentId('');
      setEndDate('');
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function regenerate(rc: RecurringClass) {
    try {
      const res = await api.generateRecurringBookings(email, rc.id);
      onDone(`Generated ${res.generated} additional bookings`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(rc: RecurringClass) {
    try {
      if (String(rc.active).toUpperCase() === 'TRUE') {
        const res = await api.disableRecurringClass(email, rc.id);
        onDone(`Recurring class paused (cancelled ${res.cancelled} future lessons)`);
      } else {
        const res = await api.enableRecurringClass(email, rc.id);
        onDone(`Recurring class resumed (generated ${res.generated})`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(rc: RecurringClass) {
    try {
      await api.deleteRecurringClass(email, rc.id);
      onDone('Recurring class deleted');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems="flex-start">
        <TextField select size="small" label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)} sx={{ width: 180 }}>
          {activeStudents.map((s) => (
            <MenuItem key={s.student_id} value={s.student_id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Weekday" value={weekday} onChange={(e) => setWeekday(e.target.value)} sx={{ width: 140 }}>
          {WEEKDAYS.map((w) => (
            <MenuItem key={w} value={w}>
              {w}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Start"
          type="time"
          size="small"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End"
          type="time"
          size="small"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Start date"
          type="date"
          size="small"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End date"
          type="date"
          size="small"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="contained" startIcon={<AddCircleIcon />} onClick={createClass}>
          Create
        </Button>
      </Stack>

      <TableContainer sx={{ boxShadow: 1, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Range</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.recurring.map((rc) => {
              const active = String(rc.active).toUpperCase() === 'TRUE';
              return (
                <TableRow key={rc.id} hover>
                  <TableCell>{rc.student_name}</TableCell>
                  <TableCell>
                    {rc.weekday} {formatShortTime(rc.start_time)} - {formatShortTime(rc.end_time)}
                  </TableCell>
                  <TableCell>
                    {rc.start_date} to {rc.end_date}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={active ? 'success' : 'default'} label={active ? 'Active' : 'Paused'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={() => regenerate(rc)}>
                        Regenerate
                      </Button>
                      <Button size="small" color={active ? 'warning' : 'success'} startIcon={active ? <PauseIcon /> : <PlayArrowIcon />} onClick={() => toggle(rc)}>
                        {active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => remove(rc)}>
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {data.recurring.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  No recurring classes yet. Set one above (e.g. every Friday 13:00-14:00 for a student).
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
