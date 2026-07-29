import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  UploadCloud, 
  MessageSquareText, 
  LogOut, 
  Home as HomeIcon,
  Shield, 
  GraduationCap,
  LogIn,
  UserPlus,
  FileCheck,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileModal } from '@/components/ProfileModal';

const Header = () => {
  const { isAuthenticated, user, isAdmin, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity shrink-0">
          <img src="/fav.svg" alt="COLLAGE Logo" className="w-7 h-7 object-contain" />
          <span className="text-lg tracking-wide font-extrabold text-gradient-brand">
            COLLAGE
          </span>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 text-sm font-medium overflow-x-auto no-scrollbar py-1 shrink">
          {/* Home Link */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 py-1 px-2.5 rounded-md transition-colors text-xs font-medium whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <HomeIcon className="w-3.5 h-3.5" />
            Home
          </NavLink>

          {/* Logged-in Links */}
          {isAuthenticated && (
            <>
              {/* Ingestion & Documents are for Admins only */}
              {isAdmin && (
                <>
                  <NavLink
                    to="/ingest"
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 py-1 px-2.5 rounded-md transition-colors text-xs font-medium whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'badge-coral font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      }`
                    }
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Data Ingestion
                  </NavLink>

                  <NavLink
                    to="/documents"
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 py-1 px-2.5 rounded-md transition-colors text-xs font-medium whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'badge-gold font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      }`
                    }
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    Manage Docs
                  </NavLink>
                </>
              )}

              {/* Query Assistant is for logged-in users and admins */}
              <NavLink
                to="/query"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 py-1 px-2.5 rounded-md transition-colors text-xs font-medium whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'badge-teal font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`
                }
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                Query Assistant
              </NavLink>
            </>
          )}
        </nav>

        {/* Controls & Auth section */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Light / Dark Theme Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all shrink-0"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-brand-gold transition-transform hover:rotate-45 duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-brand-ocean transition-transform hover:-rotate-12 duration-300" />
            )}
          </Button>

          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* User profile badge - Clickable */}
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                title="Click to view profile details & token metrics"
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-card hover:bg-accent border border-border/70 text-xs transition-colors cursor-pointer shrink-0"
              >
                {isAdmin ? (
                  <Shield className="w-3.5 h-3.5 text-brand-coral shrink-0" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                )}
                <div className="flex flex-col text-left leading-none space-y-0.5">
                  <span className="font-semibold text-foreground max-w-[100px] sm:max-w-[130px] truncate text-xs">
                    {user?.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {user?.college_slug}
                  </span>
                </div>
              </button>

              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                title="Sign Out"
                className="h-8 text-xs px-2.5 gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="h-8 text-xs gap-1.5 btn-gradient-brand font-medium">
                  <UserPlus className="w-3.5 h-3.5" />
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Account Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </header>
  );
};

export default Header;
