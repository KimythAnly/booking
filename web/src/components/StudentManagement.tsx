import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { api } from '../api';
import { useAuth } from '../auth';
import type { AdminData, Student } from '../types';

export default function StudentManagement({ data, onDone }: { data: AdminData; onDone: (msg: string) => void }) {
  const { email } = useAuth();
  const [name, setName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [error, setError] = useState('');

  async function addStudent() {
    try {
      await api.addStudent(email, name, studentEmail);
      onDone('Student added');
      setName('');
      setStudentEmail('');
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleActive(s: Student) {
    try {
      if (String(s.active).toUpperCase() === 'TRUE') {
        await api.disableStudent(email, s.student_id);
        onDone(`${s.name} disabled`);
      } else {
        await api.enableStudent(email, s.student_id);
        onDone(`${s.name} enabled`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const activeTypes = data.classTypes.filter((c) => String(c.active).toUpperCase() === 'TRUE');
  const quotaByCell: Record<string, number> = {};
  data.quotas.forEach((q) => {
    quotaByCell[`${q.student_id}|${q.class_type_id}`] = Number(q.quota) || 0;
  });

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField label="Full name" size="small" value={name} onChange={(e) => setName(e.target.value)} sx={{ width: 200 }} />
        <TextField
          label="Email"
          size="small"
          type="email"
          value={studentEmail}
          onChange={(e) => setStudentEmail(e.target.value)}
          sx={{ width: 260 }}
        />
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={addStudent}>
          Add Student
        </Button>
      </Stack>

      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Booking quota per class type
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A student can only book open slots of a class type when their quota for it is above zero. Every approved
        on-demand booking consumes 1 quota; cancelling a regular class can grant quota automatically. Edit the
        numbers below to adjust manually (changes save when you leave a field).
      </Typography>

      {activeTypes.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add a class type on the "Class types" tab to start setting quotas.
        </Alert>
      ) : (
        <TableContainer sx={{ boxShadow: 1, borderRadius: 2, bgcolor: 'background.paper', mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                {activeTypes.map((ct) => (
                  <TableCell key={ct.id} align="center">
                    {ct.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.students.map((s) => (
                <TableRow key={s.student_id} hover>
                  <TableCell>{s.name}</TableCell>
                  {activeTypes.map((ct) => (
                    <TableCell key={ct.id} align="center">
                      <QuotaCell
                        key={ct.id}
                        value={quotaByCell[`${s.student_id}|${ct.id}`] ?? 0}
                        disabled={String(s.active).toUpperCase() !== 'TRUE'}
                        onSave={(quota) => {
                          try {
                            api
                              .setStudentQuota(email, s.student_id, ct.id, quota)
                              .then(() => onDone(`Quota updated for ${s.name}`))
                              .catch((err) => setError((err as Error).message));
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TableContainer sx={{ boxShadow: 1, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.students.map((s) => (
              <TableRow key={s.student_id} hover>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={String(s.active).toUpperCase() === 'TRUE' ? 'success' : 'default'}
                    label={String(s.active).toUpperCase() === 'TRUE' ? 'Active' : 'Disabled'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" color={String(s.active).toUpperCase() === 'TRUE' ? 'error' : 'primary'} onClick={() => toggleActive(s)}>
                    {String(s.active).toUpperCase() === 'TRUE' ? 'Disable' : 'Enable'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function QuotaCell({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (quota: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  return (
    <TextField
      type="number"
      size="small"
      inputProps={{ min: 0, style: { textAlign: 'center', width: 56 } }}
      disabled={disabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Math.max(0, Math.floor(Number(draft) || 0));
        setDraft(String(n));
        if (n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
