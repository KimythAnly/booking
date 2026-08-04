import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth';
import type { Role } from './types';
import LoginPage from './pages/LoginPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { role: currentRole } = useAuth();
  if (currentRole === 'unauthorized') return <Navigate to="/" replace />;
  if (currentRole !== role) return <Navigate to="/denied" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/student"
            element={
              <RequireRole role="student">
                <StudentDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole role="teacher">
                <AdminDashboard />
              </RequireRole>
            }
          />
          <Route path="/denied" element={<AccessDeniedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
