import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api';
import { useAuth } from '../auth';
import type { AdminData, BookingRequest } from '../types';
import { formatDateTime } from '../utils';
import { useEffect, useState } from 'react';

export default function PendingPanel({ data, onDone }: { data: AdminData; onDone: (msg: string) => void }) {
  const { email } = useAuth();
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDone((prev) => {
      const known = new Set(data.pendingRequests.map((r) => r.request_id));
      const next = new Set([...prev].filter((id) => known.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  const pending = data.pendingRequests.filter((r) => !done.has(r.request_id));

  function fire(r: BookingRequest, action: () => Promise<{ message: string }>) {
    setProcessing((prev) => new Set(prev).add(r.request_id));
    action()
      .then((res) => {
        setDone((prev) => new Set(prev).add(r.request_id));
        onDone(res.message);
      })
      .catch((err) => onDone((err as Error).message))
      .finally(() => {
        setProcessing((prev) => {
          const next = new Set(prev);
          next.delete(r.request_id);
          return next;
        });
      });
  }

  return (
    <Card sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          Pending requests ({pending.length})
        </Typography>
        {pending.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No pending requests.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {pending.map((r) => (
              <Box key={r.request_id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    {r.student_name}
                  </Typography>
                  <Chip
                    size="small"
                    color={r.type === 'BOOK' ? 'primary' : 'secondary'}
                    label={r.type === 'BOOK' ? 'Book' : 'Cancel'}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(r.start_time)}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckIcon />}
                    disabled={processing.has(r.request_id)}
                    onClick={() => fire(r, () => api.approveRequest(email, r.request_id))}
                  >
                    {processing.has(r.request_id) ? (
                      <CircularProgress size={16} color="inherit" sx={{ mr: 0.5 }} />
                    ) : (
                      'Approve'
                    )}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    disabled={processing.has(r.request_id)}
                    onClick={() => fire(r, () => api.rejectRequest(email, r.request_id))}
                  >
                    {processing.has(r.request_id) ? (
                      <CircularProgress size={16} color="inherit" sx={{ mr: 0.5 }} />
                    ) : (
                      'Reject'
                    )}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
