import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';

export default function AccessDeniedPage() {
  const navigate = useNavigate();
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
        <Card sx={{ width: '100%', boxShadow: 6, textAlign: 'center' }}>
          <CardContent sx={{ p: 5 }}>
            <BlockIcon sx={{ fontSize: 56, color: 'error.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Access Denied
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Your Google account is not registered as a student or teacher.
              Ask the teacher to add you before continuing.
            </Typography>
            <Button variant="contained" onClick={() => navigate('/')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
