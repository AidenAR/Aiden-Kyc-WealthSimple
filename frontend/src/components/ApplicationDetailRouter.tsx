import { useAuth } from '@/hooks/useAuth';
import { ApplicationDetail } from '@/pages/ApplicationDetail';
import { ApplicantDetail } from '@/pages/ApplicantDetail';

export function ApplicationDetailRouter() {
  const { isAdmin } = useAuth();
  return isAdmin ? <ApplicationDetail /> : <ApplicantDetail />;
}
