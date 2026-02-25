import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getApplications,
  getApplication,
  getReviewQueue,
  reviewApplication,
  getStats,
} from '@/lib/api';
import type { ReviewRequest } from '@/types';

export function useApplications(params?: {
  status?: string;
  risk_level?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['applications', params],
    queryFn: () => getApplications(params),
    refetchInterval: 3000,
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: ['application', id],
    queryFn: () => getApplication(id),
    refetchInterval: 3000,
    enabled: !!id,
  });
}

export function useReviewQueue(params?: { risk_level?: string; page?: number }) {
  return useQuery({
    queryKey: ['reviewQueue', params],
    queryFn: () => getReviewQueue(params),
    refetchInterval: 3000,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 3000,
  });
}

export function useReviewApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, review }: { id: string; review: ReviewRequest }) =>
      reviewApplication(id, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
    },
  });
}
