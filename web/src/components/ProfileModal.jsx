import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  User as UserIcon, 
  Mail, 
  Building2, 
  Shield, 
  GraduationCap, 
  Calendar, 
  X, 
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user: initialUser, token } = useAuth();
  const [profile, setProfile] = useState(initialUser);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfile = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isAdmin = profile?.role === 'admin';

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div 
        className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-y-auto max-h-[85vh] p-5 space-y-5 animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close & Refresh */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground">
                Account Profile
              </h3>
              <p className="text-xs text-muted-foreground">
                User details & token metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={fetchProfile}
              disabled={isLoading}
              title="Refresh profile stats"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Profile Card Summary */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-accent/30 border border-border/60">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            {isAdmin ? (
              <Shield className="w-6 h-6 text-amber-500" />
            ) : (
              <GraduationCap className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-foreground text-sm truncate">
                {profile?.name || 'User'}
              </h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isAdmin 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}>
                {profile?.role || 'user'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono">
              {profile?.email}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-3 text-xs">


          {/* Institute Info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <span>Assigned Institute:</span>
            </div>
            <span className="font-mono font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              {profile?.college_slug || 'N/A'}
            </span>
          </div>

          {/* Account Created Date */}
          {profile?.created_at && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>Joined On:</span>
              </div>
              <span className="font-medium text-foreground">
                {new Date(profile.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs border-border/80 px-4"
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

