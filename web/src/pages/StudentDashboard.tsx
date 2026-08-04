import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import Layout from '../components/Layout';
import StudentCalendar from '../components/StudentCalendar';
import { useAuth } from '../auth';
import { api } from '../api';
import type { Booking, BookingRequest, Slot } from '../types';
import { formatDateTime, isFuture } from '../utils';

const REFRESH_MS = 30000;

export default function StudentDashboard() {
  const { email } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [slotsRes, bookingsRes, requestsRes] = await Promise.all([
        api.getAvailableSlots(email),
        api.getMyBookings(email),
        api.getMyRequests(email),
      ]);
      setSlots(slotsRes.slots);
      setBookings(bookingsRes.bookings);
      setRequests(requestsRes.requests);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function requestCancellation(booking: Booking) {
    try {
      await api.requestCancellation(email, booking.booking_id);
      setInfo(`Cancellation requested for ${formatDateTime(booking.start_time)}. Waiting for approval.`);
      setError('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const upcoming = bookings.filter((b) => b.status === 'ACTIVE' && isFuture(b.start_time));
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <Layout
      title="Student Dashboard"
      subtitle="Book a lesson or request a cancellation right on the calendar."
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {pendingCount > 0
            ? `${pendingCount} request(s) waiting for teacher approval`
            : 'No pending requests'}
        </Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo('')}>
          {info}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <StudentCalendar
              slots={slots}
              bookings={bookings}
              requests={requests}
              onDone={(msg) => {
                setInfo(msg);
                setError('');
                load();
              }}
              onError={(msg) => setError(msg)}
            />
          </Box>
          <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
            <Stack spacing={2}>
              <UpcomingLessons bookings={upcoming} onCancel={requestCancellation} />
              <MyRequests requests={requests} />
            </Stack>
          </Box>
        </Stack>
      )}
    </Layout>
  );
}

function UpcomingLessons({
  bookings,
  onCancel,
}: {
  bookings: Booking[];
  onCancel: (b: Booking) => void;
}) {
  if (bookings.length === 0) {
    return <Empty text="No upcoming lessons." />;
  }
  return (
    <Card sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          My lessons ({bookings.length})
        </Typography>
        <List disablePadding dense>
          {bookings.map((b) => (
            <ListItem
              key={b.booking_id}
              divider
              secondaryAction={
                <Button size="small" color="error" variant="outlined" onClick={() => onCancel(b)}>
                  Cancel
                </Button>
              }
            >
              <ListItemText
                primary={formatDateTime(b.start_time)}
                secondary={`${formatDateTime(b.start_time)} – ${formatDateTime(b.end_time)}`}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

const REQUEST_BADGES: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'default' }> = {
  PENDING: { label: 'Pending', color: 'warning' },
  APPROVED: { label: 'Approved', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
};

function MyRequests({ requests }: { requests: BookingRequest[] }) {
  if (requests.length === 0) {
    return <Empty text="No requests yet." />;
  }
  return (
    <Card sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          My requests ({requests.length})
        </Typography>
        <List disablePadding dense>
          {requests.map((r) => {
            const badge = REQUEST_BADGES[r.status] ?? REQUEST_BADGES.PENDING;
            return (
              <ListItem key={r.request_id} divider>
                <ListItemText
                  primary={`${r.type === 'BOOK' ? 'Booking' : 'Cancellation'} request`}
                  secondary={formatDateTime(r.start_time)}
                />
                <Chip label={badge.label} color={badge.color} size="small" />
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card sx={{ borderRadius: 2 }}>
      <CardContent sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">{text}</Typography>
      </CardContent>
    </Card>
  );
}
