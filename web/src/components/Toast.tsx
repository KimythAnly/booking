import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Stack } from '@mui/material';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      warning: (m) => push('warning', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Stack
        spacing={1}
        sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1400,
          width: 'max-content',
          maxWidth: 'min(92vw, 520px)',
        }}
      >
        {items.map((t) => (
          <Alert key={t.id} severity={t.type} variant="filled" onClose={() => dismiss(t.id)} sx={{ boxShadow: 3 }}>
            {t.message}
          </Alert>
        ))}
      </Stack>
    </ToastContext.Provider>
  );
}
