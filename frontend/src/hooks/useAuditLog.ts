import { useQuery } from '@tanstack/react-query';
import { getAuditLog } from '@/lib/api';

export function useAuditLog(params?: {
  application_id?: string;
  action?: string;
  actor?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['auditLog', params],
    queryFn: () => getAuditLog(params),
    refetchInterval: 5000,
  });
}
