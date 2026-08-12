import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Skeleton, Stack, Tabs, Tab, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import Layout from '../components/Layout';
import { useAuth } from '../auth';
import { api } from '../api';
import type { AdminData } from '../types';
import CalendarView from '../components/CalendarView';
import PendingPanel from '../components/PendingPanel';
import StudentManagement from '../components/StudentManagement';
import ClassTypesManager from '../components/ClassTypesManager';

export default function AdminDashboard() {
  const { email } = useAuth();
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await api.getAdminData(email));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (message: string) => {
    setInfo(message);
    load();
  };

  const pendingCount = data?.pendingRequests.length ?? 0;

  return (
    <Layout title="Admin Dashboard" subtitle="Set availability and handle requests right on the calendar.">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {pendingCount > 0 ? `${pendingCount} pending request(s)` : 'No pending requests'}
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

      {loading || !data ? (
        <Stack spacing={2} sx={{ py: 2 }}>
          <Skeleton variant="text" width={200} />
          <Skeleton variant="rounded" height={360} />
          <Skeleton variant="rounded" height={140} />
        </Stack>
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Calendar" />
            <Tab label="Students" />
            <Tab label="Class types" />
          </Tabs>

          {tab === 0 && (
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <CalendarView data={data} onDone={notify} />
              </Box>
              <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
                <PendingPanel data={data} onDone={notify} />
              </Box>
            </Stack>
          )}
          {tab === 1 && <StudentManagement data={data} onDone={notify} />}
          {tab === 2 && <ClassTypesManager classTypes={data.classTypes} onDone={notify} />}
        </>
      )}
    </Layout>
  );
}
