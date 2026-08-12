import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api';
import { useAuth } from '../auth';
import { useMutation } from '../hooks/useMutation';
import type { AdminData, BookingRequest } from '../types';
import { formatDateTime } from '../utils';
import { useState } from 'react';

export default function PendingPanel({
  data,
  onDone,
  onRefresh,
}: {
  data: AdminData;
  onDone: (msg: string) => void;
  onRefresh: () => void;
}) {
  const { email } = useAuth();
  const mutate = useMutation();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const pending = data.pendingRequests.filter((r) => !hidden.has(r.request_id));

  function fire(r: BookingRequest, action: () => Promise<unknown>, successMsg: string) {
    setHidden((prev) => new Set(prev).add(r.request_id));
    const unhide = () =>
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(r.request_id);
        return next;
      });
    mutate({
      action,
      rollback: unhide,
      reconcile: () => {
        unhide();
        onRefresh();
      },
      onSuccess: () => onDone(successMsg),
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
                  <Stack direction="row" spacing={0.5}>
                    {r.class_type_name && <Chip size="small" label={r.class_type_name} variant="outlined" />}
                    <Chip
                      size="small"
                      color={r.type === 'BOOK' ? 'primary' : 'secondary'}
                      label={r.type === 'BOOK' ? 'Book' : 'Cancel'}
                    />
                  </Stack>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(r.start_time)}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckIcon />}
                    onClick={() => fire(r, () => api.approveRequest(email, r.request_id), 'Approved — calendar updated')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    onClick={() => fire(r, () => api.rejectRequest(email, r.request_id), 'Request rejected')}
                  >
                    Reject
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
