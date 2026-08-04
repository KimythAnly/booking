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
