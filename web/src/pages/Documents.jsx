import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  Building2, 
  Database, 
  HardDrive, 
  Clock,
  AlertCircle,
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_BASE_URL = `${BASE_URL}/documents`;

const Documents = () => {
  const { user, token } = useAuth();
  const collegeSlug = user?.college_slug || '';
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchDocuments = async () => {
    if (!collegeSlug) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/list/${collegeSlug}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to fetch documents.');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [collegeSlug]);

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    const storedName = documentToDelete.stored_name;
    setDeletingFile(storedName);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/${collegeSlug}/${storedName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete document.');
      }

      const data = await response.json();
      setMessage({ 
        type: 'success', 
        text: `Deleted "${documentToDelete.display_name}" (${data.chunks_purged} vector chunks purged).` 
      });

      // Refresh list
      setDocuments((prev) => prev.filter((doc) => doc.stored_name !== storedName));
    } catch (err) {
      console.error('Error deleting document:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setDeletingFile(null);
      setDocumentToDelete(null);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <FileCheck className="w-6 h-6 text-primary" />
            Uploaded Knowledge Base Documents
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Manage ingested PDF files and purge vector embeddings from ChromaDB for your institute.
          </p>
        </div>

        {/* Institute Info Badge & Refresh Button */}
        <div className="flex items-center gap-2.5 bg-card px-3 py-1.5 rounded-xl border border-border/60 shadow-sm">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground">Institute:</span>
          <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
            {collegeSlug || 'Not Assigned'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchDocuments}
            disabled={isLoading}
            title="Refresh List"
            className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alert / Notification Message */}
      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 border ${
          message.type === 'error' 
            ? 'bg-destructive/10 border-destructive/30 text-destructive' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          {message.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Document List Card */}
      <Card className="border-border/60 shadow-lg bg-card/50 overflow-hidden">
        <CardHeader className="border-b border-border/40 bg-card/80 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              Document Storage & Knowledge Base Index
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              Total Files: <strong className="text-foreground">{documents.length}</strong>
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p>Scanning storage for documents matching "{collegeSlug}"...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-xs space-y-3">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No Documents Found</p>
              <p className="max-w-md mx-auto">
                No PDF files have been uploaded yet for institute <span className="font-mono text-primary font-semibold">"{collegeSlug}"</span>.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {documents.map((doc) => (
                <div 
                  key={doc.stored_name}
                  className="p-4 hover:bg-accent/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <h4 className="text-xs font-semibold text-foreground truncate flex items-center gap-2">
                        <span>{doc.display_name}</span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        Stored as: {doc.stored_name}
                      </p>
                      
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-primary/70" />
                          {doc.formatted_size}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary/70" />
                          {new Date(doc.uploaded_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`${API_BASE_URL}/view/${doc.stored_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/80 bg-background hover:bg-accent hover:border-primary/50 text-foreground transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-primary" />
                      <span>View PDF</span>
                    </a>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDocumentToDelete(doc)}
                      disabled={deletingFile === doc.stored_name}
                      className="h-8 text-xs px-3"
                    >
                      {deletingFile === doc.stored_name ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          <span>Delete</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Shadcn Confirm Dialog Modal */}
      <ConfirmDialog
        isOpen={Boolean(documentToDelete)}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete "${documentToDelete?.display_name || 'Document'}"?`}
        description={`Are you sure you want to permanently delete this document? This will remove the PDF file from server storage and purge all ${collegeSlug}'s vector embeddings from ChromaDB.`}
        confirmText="Delete Document"
        cancelText="Cancel"
        isLoading={Boolean(deletingFile)}
      />
    </div>
  );
};

export default Documents;
