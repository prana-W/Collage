import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  Layers, 
  UploadCloud, 
  MessageSquareText, 
  LogOut, 
  Home as HomeIcon,
  Shield, 
  GraduationCap,
  LogIn,
  UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const Header = () => {
  const { isAuthenticated, user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-5xl mx-auto flex h-14 items-center justify-between px-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-lg tracking-wide font-extrabold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            COLLAGE
          </span>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1.5 text-sm font-medium">
          {/* Home Link */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 py-1.5 px-3 rounded-md transition-colors text-xs font-medium ${
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
              {/* Ingestion is for Admins only */}
              {isAdmin && (
                <NavLink
                  to="/ingest"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 py-1.5 px-3 rounded-md transition-colors text-xs font-medium ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`
                  }
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  PDF Ingestion
                </NavLink>
              )}

              {/* Query Assistant is for logged-in users and admins */}
              <NavLink
                to="/query"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 py-1.5 px-3 rounded-md transition-colors text-xs font-medium ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
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

        {/* Auth section */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {/* User badge */}
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-card border border-border/60 text-xs">
                {isAdmin ? (
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-primary" />
                )}
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-foreground max-w-[120px] truncate">{user?.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{user?.college_slug}</span>
                </div>
              </div>

              {/* Logout button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="h-8 text-xs gap-1.5 border-border hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
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
                <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-medium">
                  <UserPlus className="w-3.5 h-3.5" />
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
