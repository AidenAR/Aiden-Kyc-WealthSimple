import { useCallback, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApplication } from '@/lib/api';
import type { Application } from '@/types';

const STORAGE_KEY = 'my_application_ids';

function getIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener('my-apps-changed', cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener('my-apps-changed', cb);
  };
}

export function addMyApplicationId(id: string) {
  const ids = getIds();
  if (!ids.includes(id)) {
    ids.unshift(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event('my-apps-changed'));
  }
}

export function useMyApplicationIds(): string[] {
  return useSyncExternalStore(subscribe, getIds, getIds);
}

export function useMyApplications() {
  const ids = useMyApplicationIds();

  return useQuery({
    queryKey: ['myApplications', ids],
    queryFn: async (): Promise<Application[]> => {
      if (ids.length === 0) return [];
      const results = await Promise.all(
        ids.map((id) => getApplication(id).catch(() => null)),
      );
      return results.filter((a): a is Application => a !== null);
    },
    refetchInterval: 3000,
    enabled: ids.length > 0,
  });
}

export function isMyApplication(id: string): boolean {
  return getIds().includes(id);
}
