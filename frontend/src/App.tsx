import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { ToastProvider } from '@/components/Toast';
import { ViewModeProvider } from '@/hooks/useViewMode';
import { SubmitApplication } from '@/pages/SubmitApplication';
import { Dashboard } from '@/pages/Dashboard';
import { ApplicantDashboard } from '@/pages/ApplicantDashboard';
import { AuditLog } from '@/pages/AuditLog';
import { Settings } from '@/pages/Settings';
import { VoiceReverify } from '@/pages/VoiceReverify';
import { Webhooks } from '@/pages/Webhooks';
import { ApplicationDetailRouter } from './components/ApplicationDetailRouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ViewModeProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<SubmitApplication />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/application/:id" element={<ApplicationDetailRouter />} />
                <Route path="/my-applications" element={<ApplicantDashboard />} />
                <Route path="/audit-log" element={<AuditLog />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/voice-verify" element={<VoiceReverify />} />
                <Route path="/webhooks" element={<Webhooks />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </ViewModeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
