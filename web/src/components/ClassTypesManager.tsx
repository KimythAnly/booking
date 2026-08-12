import { useState } from 'react';
import {
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
import { useMutation } from '../hooks/useMutation';
import { useToast } from './Toast';
import type { ClassType } from '../types';

export default function ClassTypesManager({
  classTypes,
  onDone,
  onRefresh,
}: {
  classTypes: ClassType[];
  onDone: (msg: string) => void;
  onRefresh: () => void;
}) {
  const { email } = useAuth();
  const toast = useToast();
  const mutate = useMutation();
  const [name, setName] = useState('');
  const [tempTypes, setTempTypes] = useState<ClassType[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<ClassType | null>(null);

  const visible = [...tempTypes, ...classTypes].filter((ct) => !hidden.has(ct.id));

  function add() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Class type name is required');
      return;
    }
    const temp: ClassType = { id: 'tmp_' + Date.now(), name: trimmed, active: 'TRUE' };
    setName('');
    const cleanup = () => setTempTypes((prev) => prev.filter((t) => t.id !== temp.id));
    mutate({
      optimistic: () => setTempTypes((prev) => [...prev, temp]),
      rollback: cleanup,
      reconcile: () => {
        cleanup();
        onRefresh();
      },
      action: () => api.addClassType(email, trimmed),
      onSuccess: () => {
        cleanup();
        onDone(`Class type "${trimmed}" added`);
      },
    });
  }

  function remove() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    setHidden((prev) => new Set(prev).add(target.id));
    const unhide = () =>
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
    mutate({
      action: () => api.deleteClassType(email, target.id),
      rollback: unhide,
      reconcile: () => {
        unhide();
        onRefresh();
      },
      onSuccess: () => onDone(`Class type "${target.name}" deleted`),
    });
  }

  return (
    <Box>
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={add} disabled={!name.trim()}>
          Add type
        </Button>
      </Stack>

      {visible.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No class types yet. Add one above — a default "General" type is used until then.
        </Typography>
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
              {visible.map((ct) => (
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
                    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => setToDelete(ct)}>
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
          <Button color="error" variant="contained" onClick={remove}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
