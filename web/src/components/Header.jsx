import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Database, Sparkles, UploadCloud, MessageSquareText } from 'lucide-react';

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-5xl mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Database className="w-5 h-5" />
          </div>
          <span className="text-base bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            UniRAG Portal
          </span>
        </Link>

        <nav className="flex items-center gap-2 text-sm font-medium">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 py-1.5 px-3 rounded-md transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <UploadCloud className="w-4 h-4" />
            PDF Ingestion
          </NavLink>

          <NavLink
            to="/query"
            className={({ isActive }) =>
              `flex items-center gap-1.5 py-1.5 px-3 rounded-md transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <MessageSquareText className="w-4 h-4" />
            Query Assistant
          </NavLink>
        </nav>
      </div>
    </header>
  );
};

export default Header;
