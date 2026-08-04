import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api';
import { useAuth } from '../auth';
import type { AdminData, BookingRequest } from '../types';
import { formatDateTime } from '../utils';

export default function PendingPanel({ data, onDone }: { data: AdminData; onDone: (msg: string) => void }) {
  const { email } = useAuth();
  const pending = data.pendingRequests;

  async function approve(r: BookingRequest) {
    try {
      onDone((await api.approveRequest(email, r.request_id)).message);
    } catch (err) {
      onDone((err as Error).message);
    }
  }

  async function reject(r: BookingRequest) {
    try {
      await api.rejectRequest(email, r.request_id);
      onDone('Request rejected');
    } catch (err) {
      onDone((err as Error).message);
    }
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
                  <Button size="small" variant="contained" startIcon={<CheckIcon />} onClick={() => approve(r)}>
                    Approve
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    onClick={() => reject(r)}
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
