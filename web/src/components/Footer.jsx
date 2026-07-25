import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full border-t border-border/40 py-6 bg-card/30 mt-auto">
      <div className="container max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} University RAG Engine. Multi-tenant Document Ingestion.</p>
        <p className="flex items-center gap-2">
          <span>Powered by FastAPI + ChromaDB + RQ</span>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
