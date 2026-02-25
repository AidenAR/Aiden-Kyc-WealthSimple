import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/pages/AuthPage';
import { SubmitApplication } from '@/pages/SubmitApplication';
import { Dashboard } from '@/pages/Dashboard';
import { ApplicantDashboard } from '@/pages/ApplicantDashboard';
import { AuditLog } from '@/pages/AuditLog';
import { Settings } from '@/pages/Settings';
import { Webhooks } from '@/pages/Webhooks';
import { ApplicationDetailRouter } from './components/ApplicationDetailRouter';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000,
      retry: 1,
    },
  },
});

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<SubmitApplication />} />
          <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/application/:id" element={<ApplicationDetailRouter />} />
          <Route path="/my-applications" element={<ApplicantDashboard />} />
          <Route path="/audit-log" element={<AdminRoute><AuditLog /></AdminRoute>} />
          <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="/webhooks" element={<AdminRoute><Webhooks /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
