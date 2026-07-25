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
  FileCheck,
  Globe,
  Loader2,
  Layers
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_BASE_URL = `${BASE_URL}/documents`;
const WEB_API_BASE_URL = `${BASE_URL}/ingest/web`;

const Documents = () => {
  const { user, token } = useAuth();
  const collegeSlug = user?.college_slug || '';
  
  const [activeTab, setActiveTab] = useState('pdfs'); // 'pdfs' | 'weblinks'
  const [documents, setDocuments] = useState([]);
  const [webLinks, setWebLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWebLoading, setIsWebLoading] = useState(false);
  
  // Deletion modals
  const [deletingFile, setDeletingFile] = useState(null);
  const [documentToDelete, setDocumentToDelete] = useState(null);

  const [deletingWebLink, setDeletingWebLink] = useState(null);
  const [webLinkToDelete, setWebLinkToDelete] = useState(null);

  const [message, setMessage] = useState(null);

  const fetchDocuments = async () => {
    if (!collegeSlug) return;
    setIsLoading(true);

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

  const fetchWebLinks = async () => {
    if (!collegeSlug) return;
    setIsWebLoading(true);

    try {
      const response = await fetch(`${WEB_API_BASE_URL}/links/${collegeSlug}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to fetch web links.');
      }

      const data = await response.json();
      setWebLinks(data.links || []);
    } catch (err) {
      console.error('Error fetching web links:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsWebLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchWebLinks();
  }, [collegeSlug]);

  const confirmDeleteDocument = async () => {
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

      setDocuments((prev) => prev.filter((doc) => doc.stored_name !== storedName));
    } catch (err) {
      console.error('Error deleting document:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setDeletingFile(null);
      setDocumentToDelete(null);
    }
  };

  const confirmDeleteWebLink = async () => {
    if (!webLinkToDelete) return;

    const linkId = webLinkToDelete.id;
    const url = webLinkToDelete.url;
    setDeletingWebLink(linkId);
    setMessage(null);

    try {
      const response = await fetch(`${WEB_API_BASE_URL}/links/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete web link.');
      }

      const data = await response.json();
      setMessage({ 
        type: 'success', 
        text: `Deleted web link "${url}" (${data.chunks_purged} vector chunks purged from ChromaDB & MySQL).` 
      });

      setWebLinks((prev) => prev.filter((link) => link.id !== linkId));
    } catch (err) {
      console.error('Error deleting web link:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setDeletingWebLink(null);
      setWebLinkToDelete(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Knowledge Base Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View uploaded PDFs and crawled website links. Deleting items purges both metadata and vector store embeddings.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2 text-sm text-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs text-primary">{collegeSlug || 'No College'}</span>
          </div>
          
          <Button
            onClick={() => {
              fetchDocuments();
              fetchWebLinks();
            }}
            variant="outline"
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isWebLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Global Notifications */}
      {message && (
        <div className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${
          message.type === 'error' 
            ? 'bg-destructive/10 border-destructive/20 text-destructive' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
        }`}>
          {message.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/50 border border-border rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('pdfs')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pdfs'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <FileText className="w-4 h-4" />
          PDF Documents ({documents.length})
        </button>
        
        <button
          onClick={() => setActiveTab('weblinks')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'weblinks'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Globe className="w-4 h-4" />
          Crawled Web Links ({webLinks.length})
        </button>
      </div>

      {/* Tab 1: PDF Documents List */}
      {activeTab === 'pdfs' && (
        <Card className="bg-card border-border shadow-md">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl text-card-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Uploaded PDF Documents
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              PDF files ingested into ChromaDB for {collegeSlug}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span>Loading PDF documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <FileCheck className="w-10 h-10 text-muted-foreground/40" />
                <span>No PDF documents ingested yet for {collegeSlug}.</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc) => (
                  <div
                    key={doc.stored_name}
                    className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-base">{doc.display_name}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1 font-mono">
                            <HardDrive className="w-3.5 h-3.5" />
                            {doc.formatted_size}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(doc.uploaded_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <a
                        href={`${BASE_URL}/documents/view/${doc.stored_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border bg-card text-foreground hover:bg-accent text-xs gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View PDF
                        </Button>
                      </a>

                      {user?.role === 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingFile === doc.stored_name}
                          onClick={() => setDocumentToDelete(doc)}
                          className="border-destructive/20 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs gap-1.5"
                        >
                          {deletingFile === doc.stored_name ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Ingested Web Links List */}
      {activeTab === 'weblinks' && (
        <Card className="bg-card border-border shadow-md">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl text-card-foreground flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Ingested Website Links
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Official college website URLs crawled and indexed in MySQL and ChromaDB.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isWebLoading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span>Loading web links...</span>
              </div>
            ) : webLinks.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <Globe className="w-10 h-10 text-muted-foreground/40" />
                <span>No website links ingested yet for {collegeSlug}.</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {webLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <Globe className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-foreground hover:text-primary text-base flex items-center gap-1.5 transition-colors"
                        >
                          {link.url}
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                        
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1.5">
                          {getStatusBadge(link.status)}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-primary" />
                            Pages: {link.pages_crawled} / {link.max_pages}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-emerald-500">
                            <Database className="w-3.5 h-3.5" />
                            {link.chunks_stored} Chunks
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(link.created_at).toLocaleString()}
                          </span>
                        </div>

                        {link.error_message && (
                          <p className="text-xs text-destructive mt-1">
                            Error: {link.error_message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      {user?.role === 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingWebLink === link.id}
                          onClick={() => setWebLinkToDelete(link)}
                          className="border-destructive/20 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs gap-1.5"
                        >
                          {deletingWebLink === link.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete Link & Purge Embeddings
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete PDF Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!documentToDelete}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={confirmDeleteDocument}
        title="Delete PDF Document?"
        description={`Are you sure you want to delete "${documentToDelete?.display_name}"? This action will purge the file from disk and delete all associated vector embeddings in ChromaDB.`}
        confirmText="Yes, Delete Document"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Delete Web Link Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!webLinkToDelete}
        onClose={() => setWebLinkToDelete(null)}
        onConfirm={confirmDeleteWebLink}
        title="Delete Web Link & Vector Embeddings?"
        description={`Are you sure you want to delete the web link "${webLinkToDelete?.url}"? This action will remove the link record from MySQL and purge all associated vector embeddings from ChromaDB for college ${collegeSlug}.`}
        confirmText="Yes, Delete Link & Embeddings"
        cancelText="Cancel"
        variant="destructive"
      />

    </div>
  );
};

export default Documents;
