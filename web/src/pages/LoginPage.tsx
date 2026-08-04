import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Typography,
  Alert,
  Stack,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useAuth, decodeJwt } from '../auth';
import { api } from '../api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { role: currentRole, setAuth } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const useMock = import.meta.env.VITE_USE_MOCK === 'true';

  useEffect(() => {
    if (currentRole !== 'unauthorized') {
      navigate(currentRole === 'teacher' ? '/admin' : '/student', { replace: true });
      return;
    }
    if (useMock) return;
    if (!clientId) {
      setError('VITE_GOOGLE_CLIENT_ID is not configured. See README for setup.');
      return;
    }
    let cancelled = false;
    const init = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        setTimeout(init, 200);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(document.getElementById('gsi-btn')!, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
      });
    };
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, useMock, currentRole]);

  async function handleCredential(response: { credential: string }) {
    try {
      setLoading(true);
      setError('');
      const profile = decodeJwt(response.credential);
      const email = String(profile.email);
      const { role } = await api.validateUser(email);
      if (role === 'unauthorized') {
        navigate('/denied', { replace: true });
        return;
      }
      setAuth({ role, email, name: String(profile.name || email) });
      navigate(role === 'teacher' ? '/admin' : '/student', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMockRole(role: 'teacher' | 'student') {
    try {
      setLoading(true);
      setError('');
      const email = role === 'teacher' ? 'teacher@gmail.com' : 'alice@gmail.com';
      const { role: detected } = await api.validateUser(email);
      if (detected === 'unauthorized') {
        setError('Account not recognized. Seed data may be missing.');
        return;
      }
      setAuth({ role: detected, email, name: role === 'teacher' ? 'Teacher' : 'Alice' });
      navigate(detected === 'teacher' ? '/admin' : '/student', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card sx={{ width: '100%', boxShadow: 6 }}>
          <CardContent sx={{ p: 5, textAlign: 'center' }}>
            <CalendarMonthIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Teacher Scheduler
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Sign in with your Google account to manage or book lessons.
            </Typography>

            {loading && (
              <Stack alignItems="center" sx={{ my: 3 }}>
                <CircularProgress size={28} />
              </Stack>
            )}

            {!loading && !useMock && <div id="gsi-btn" />}

            {!loading && useMock && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Demo mode (VITE_USE_MOCK=true) — pick a role to explore the UI.
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button variant="contained" onClick={() => handleMockRole('teacher')}>
                    Teacher (admin)
                  </Button>
                  <Button variant="outlined" onClick={() => handleMockRole('student')}>
                    Student (Alice)
                  </Button>
                </Stack>
              </Stack>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 3, textAlign: 'left' }}>
                {error}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
