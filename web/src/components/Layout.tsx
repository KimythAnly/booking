import type { ReactNode } from 'react';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth';

interface LayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function Layout({ title, subtitle, children }: LayoutProps) {
  const { name, clear } = useAuth();
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar>
          <CalendarMonthIcon sx={{ color: 'primary.main', mr: 1 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, color: 'primary.main' }}>
            Teacher Scheduler
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
            {name}
          </Typography>
          <Button
            startIcon={<LogoutIcon />}
            color="inherit"
            onClick={() => {
              clear();
              window.location.hash = '#/';
            }}
          >
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </Container>
    </Box>
  );
}
