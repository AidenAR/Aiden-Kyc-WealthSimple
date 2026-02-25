import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  LayoutDashboard,
  ScrollText,
  Upload,
  Moon,
  Sun,
  UserCircle,
  LogOut,
  Settings,
  Webhook,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

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
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isAdmin, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navItems = isAdmin ? adminNav : applicantNav;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground border-b border-border dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <FileText className="h-6 w-6 text-accent" />
              <span className="text-lg font-semibold tracking-tight">VeriFlow</span>
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
                          : 'text-white/70 hover:text-white hover:bg-white/10',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="ml-2 h-6 w-px bg-white/20" />

              <div className="relative ml-1" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isAdmin
                      ? 'bg-white/15 text-white'
                      : 'bg-accent/80 text-white dark:text-black',
                  )}
                >
                  <UserCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {user?.name || user?.email || 'User'}
                  </span>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user?.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                        {user?.role}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

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
