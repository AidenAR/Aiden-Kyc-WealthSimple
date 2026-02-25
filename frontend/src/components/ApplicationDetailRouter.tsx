import { useViewMode } from '@/hooks/useViewMode';
import { ApplicationDetail } from '@/pages/ApplicationDetail';
import { ApplicantDetail } from '@/pages/ApplicantDetail';

export function ApplicationDetailRouter() {
  const { isAdmin } = useViewMode();
  return isAdmin ? <ApplicationDetail /> : <ApplicantDetail />;
}
