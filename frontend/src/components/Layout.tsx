import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, LayoutDashboard, ScrollText, Upload, Moon, Sun, Eye, UserCircle, LogOut, Settings, Mic, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useViewMode, type Profile } from '@/hooks/useViewMode';

const adminNav = [
  { to: '/', label: 'Submit', icon: Upload },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/webhooks', label: 'Webhooks', icon: Webhook },
];

const applicantNav = [
  { to: '/', label: 'Submit', icon: Upload },
  { to: '/my-applications', label: 'My Applications', icon: FileText },
  { to: '/voice-verify', label: 'Voice ID', icon: Mic },
];

function ProfileSetup({ onSave }: { onSave: (p: Profile) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-full bg-accent/10">
            <UserCircle className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Your Profile</h2>
            <p className="text-xs text-muted-foreground">Set up your applicant identity</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) onSave({ email: email.trim().toLowerCase(), name: name.trim() || email.trim().split('@')[0] });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="John Doe (optional)"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-accent text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            Continue as Applicant
          </button>
        </form>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { setMode, isAdmin, profile, setProfile } = useViewMode();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navItems = isAdmin ? adminNav : applicantNav;

  function handleSwitchToApplicant() {
    if (!profile) {
      setShowProfileSetup(true);
    } else {
      setMode('applicant');
    }
  }

  function handleProfileSave(p: Profile) {
    setProfile(p);
    setShowProfileSetup(false);
    setMode('applicant');
  }

  function handleLogout() {
    setProfile(null);
    setMode('admin');
    setShowProfileMenu(false);
  }

  return (
    <div className="min-h-screen bg-background">
      {showProfileSetup && <ProfileSetup onSave={handleProfileSave} />}

      <header className="bg-primary text-primary-foreground border-b border-border dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <FileText className="h-6 w-6 text-accent" />
              <span className="text-lg font-semibold tracking-tight">KYC Review</span>
            </Link>
            <div className="flex items-center gap-1">
              <nav className="flex items-center gap-1">
                {navItems.map(({ to, label, icon: Icon }) => {
                  const isActive =
                    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-white/15 text-white dark:bg-white/10'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="ml-2 h-6 w-px bg-white/20" />

              {isAdmin ? (
                <button
                  onClick={handleSwitchToApplicant}
                  className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-white/15 text-white"
                  title="Switch to applicant view"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              ) : (
                <div className="relative ml-1" ref={menuRef}>
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-accent/80 text-white dark:text-black"
                    title="Profile"
                  >
                    <UserCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline max-w-[120px] truncate">
                      {profile?.name || profile?.email || 'Applicant'}
                    </span>
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                      {profile && (
                        <div className="px-3 py-2.5 border-b border-border">
                          <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowProfileSetup(true);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        Switch Profile
                      </button>
                      <button
                        onClick={() => { setShowProfileMenu(false); setMode('admin'); }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        Switch to Admin
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={toggleTheme}
                className="ml-1 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
