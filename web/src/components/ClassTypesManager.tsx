import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import { api } from '../api';
import { useAuth } from '../auth';
import type { ClassType } from '../types';

export default function ClassTypesManager({
  classTypes,
  onDone,
}: {
  classTypes: ClassType[];
  onDone: (msg: string) => void;
}) {
  const { email } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<ClassType | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      await api.addClassType(email, name);
      onDone(`Class type "${name.trim()}" added`);
      setName('');
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteClassType(email, toDelete.id);
      onDone(`Class type "${toDelete.name}" deleted`);
      setToDelete(null);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const active = classTypes.filter((c) => String(c.active).toUpperCase() === 'TRUE');

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Class types define the subjects students can book (e.g. Math, English). Each class you create on the
        calendar belongs to a type, and each student's booking quota is tracked per type.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="New class type"
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) add();
          }}
          sx={{ width: 260 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={add}
          disabled={busy || !name.trim()}
        >
          Add type
        </Button>
      </Stack>

      {active.length === 0 ? (
        <Alert severity="info">No class types yet. Add one above — a default "General" type is used until then.</Alert>
      ) : (
        <TableContainer sx={{ boxShadow: 1, borderRadius: 2, bgcolor: 'background.paper', maxWidth: 520 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {classTypes.map((ct) => (
                <TableRow key={ct.id} hover>
                  <TableCell>{ct.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={String(ct.active).toUpperCase() === 'TRUE' ? 'success' : 'default'}
                      label={String(ct.active).toUpperCase() === 'TRUE' ? 'Active' : 'Inactive'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      disabled={busy}
                      onClick={() => setToDelete(ct)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete class type?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{toDelete?.name}"? Existing lessons keep their type name, but you won't be able to create new
            bookings of this type, and the student quotas for it are removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={remove} disabled={busy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
