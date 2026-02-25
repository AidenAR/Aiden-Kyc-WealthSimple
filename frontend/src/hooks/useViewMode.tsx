import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ViewMode = 'admin' | 'applicant';

export interface Profile {
  email: string;
  name: string;
}

interface ViewModeContext {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  isAdmin: boolean;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
}

const PROFILE_KEY = 'applicant_profile';

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && p.email ? p : null;
  } catch {
    return null;
  }
}

const Ctx = createContext<ViewModeContext>({
  mode: 'admin',
  setMode: () => {},
  isAdmin: true,
  profile: null,
  setProfile: () => {},
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<ViewMode>(
    () => (localStorage.getItem('viewMode') as ViewMode) || 'admin',
  );
  const [profile, setProfileRaw] = useState<Profile | null>(loadProfile);

  const setMode = useCallback((m: ViewMode) => {
    setModeRaw(m);
    localStorage.setItem('viewMode', m);
  }, []);

  const setProfile = useCallback((p: Profile | null) => {
    setProfileRaw(p);
    if (p) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(PROFILE_KEY);
    }
  }, []);

  return (
    <Ctx.Provider value={{ mode, setMode, isAdmin: mode === 'admin', profile, setProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useViewMode() {
  return useContext(Ctx);
}
