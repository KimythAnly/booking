import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4f46e5' },
    secondary: { main: '#059669' },
    background: { default: '#f6f7fb' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  },
});
