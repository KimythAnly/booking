import { useState } from 'react';
import {
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
import { useMutation, isAmbiguousFailure } from '../hooks/useMutation';
import { useToast } from './Toast';
import type { AdminData, Student } from '../types';

export default function StudentManagement({
  data,
  onDone,
  onRefresh,
}: {
  data: AdminData;
  onDone: (msg: string) => void;
  onRefresh: () => void;
}) {
  const { email } = useAuth();
  const toast = useToast();
  const mutate = useMutation();
  const [name, setName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [tempStudents, setTempStudents] = useState<Student[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  const isActive = (s: Student) => String(statusOverrides[s.student_id] ?? s.active).toUpperCase() === 'TRUE';
  const students = [...tempStudents, ...data.students];

  function addStudent() {
    const trimmedName = name.trim();
    const trimmedEmail = studentEmail.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      toast.error('Name and email are required');
      return;
    }
    const temp: Student = { student_id: 'tmp_' + Date.now(), name: trimmedName, email: trimmedEmail, active: 'TRUE' };
    setName('');
    setStudentEmail('');
    const cleanup = () => setTempStudents((prev) => prev.filter((s) => s.student_id !== temp.student_id));
    mutate({
      optimistic: () => setTempStudents((prev) => [...prev, temp]),
      rollback: cleanup,
      reconcile: () => {
        cleanup();
        onRefresh();
      },
      action: () => api.addStudent(email, trimmedName, trimmedEmail),
      onSuccess: () => {
        cleanup();
        onDone('Student added');
      },
    });
  }

  function toggleActive(s: Student) {
    const next = isActive(s) ? 'FALSE' : 'TRUE';
    setStatusOverrides((prev) => ({ ...prev, [s.student_id]: next }));
    const clearOverride = () =>
      setStatusOverrides((prev) => {
        const rest = { ...prev };
        delete rest[s.student_id];
        return rest;
      });
    mutate({
      action: () => (next === 'TRUE' ? api.enableStudent(email, s.student_id) : api.disableStudent(email, s.student_id)),
      rollback: clearOverride,
      reconcile: () => {
        clearOverride();
        onRefresh();
      },
      onSuccess: () => onDone(`${s.name} ${next === 'TRUE' ? 'enabled' : 'disabled'}`),
    });
  }

  const activeTypes = data.classTypes.filter((c) => String(c.active).toUpperCase() === 'TRUE');
  const quotaByCell: Record<string, number> = {};
  data.quotas.forEach((q) => {
    quotaByCell[`${q.student_id}|${q.class_type_id}`] = Number(q.quota) || 0;
  });

  return (
    <Box>
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add a class type on the "Class types" tab to start setting quotas.
        </Typography>
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
              {students.map((s) => (
                <TableRow key={s.student_id} hover>
                  <TableCell>{s.name}</TableCell>
                  {activeTypes.map((ct) => (
                    <TableCell key={ct.id} align="center">
                      <QuotaCell
                        key={ct.id}
                        value={quotaByCell[`${s.student_id}|${ct.id}`] ?? 0}
                        disabled={!isActive(s)}
                        onRefresh={onRefresh}
                        onSave={(quota) =>
                          api.setStudentQuota(email, s.student_id, ct.id, quota).then(() => onDone(`Quota updated for ${s.name}`))
                        }
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
            {students.map((s) => (
              <TableRow key={s.student_id} hover>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={isActive(s) ? 'success' : 'default'}
                    label={isActive(s) ? 'Active' : 'Disabled'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" color={isActive(s) ? 'error' : 'primary'} onClick={() => toggleActive(s)}>
                    {isActive(s) ? 'Disable' : 'Enable'}
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
  onRefresh,
}: {
  value: number;
  disabled: boolean;
  onSave: (quota: number) => Promise<void>;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const toast = useToast();
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
        if (n !== value) {
          const prev = String(value);
          onSave(n).catch((err) => {
            setDraft(prev);
            if (isAmbiguousFailure(err)) {
              onRefresh();
              toast.warning('連線不穩定或回應逾時 — 已重新同步，請確認操作結果');
            } else {
              toast.error(`操作失敗 — ${(err as Error).message}`);
            }
          });
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
