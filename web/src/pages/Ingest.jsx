import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Loader2, 
  Building2,
  Database,
  Globe,
  Link as LinkIcon,
  Compass,
  Layers
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from '@/context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_BASE_URL = `${BASE_URL}/ingest`;
const POLL_INTERVAL_MS = 5000;

const Ingest = () => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' | 'web'
  const [collegeSlug, setCollegeSlug] = useState(user?.college_slug || 'nitjsr');
  
  // PDF Upload State
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [jobs, setJobs] = useState([]);
  
  // Web Crawler State
  const [webUrl, setWebUrl] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [isWebSubmitting, setIsWebSubmitting] = useState(false);
  const [webError, setWebError] = useState(null);
  const [webSuccessMessage, setWebSuccessMessage] = useState(null);

  const pollingRef = useRef(null);

  const checkJobStatus = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/status/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed status check: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`Error polling job ${jobId}:`, err);
      return null;
    }
  };

  useEffect(() => {
    const pollAllActiveJobs = async () => {
      setJobs((prevJobs) => {
        const activeJobs = prevJobs.filter(
          (j) => j.status === 'queued' || j.status === 'processing'
        );
        
        if (activeJobs.length === 0) return prevJobs;

        Promise.all(activeJobs.map((j) => checkJobStatus(j.job_id))).then((updates) => {
          setJobs((currentJobs) =>
            currentJobs.map((j) => {
              const updated = updates.find((u) => u && u.job_id === j.job_id);
              return updated ? { ...j, ...updated } : j;
            })
          );
        });

        return prevJobs;
      });
    };

    pollAllActiveJobs();
    pollingRef.current = setInterval(pollAllActiveJobs, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).filter((file) =>
        file.name.toLowerCase().endsWith('.pdf')
      );
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!collegeSlug.trim()) {
      setUploadError('Please specify a college slug.');
      return;
    }
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one PDF file.');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('college_slug', collegeSlug.trim());
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed.');
      }

      const data = await response.json();
      
      const newJob = {
        job_id: data.job_id,
        college_slug: data.college_slug,
        files_queued: data.files_queued,
        status: data.status || 'queued',
        enqueued_at: new Date().toISOString(),
      };

      setJobs((prev) => [newJob, ...prev]);
      setSelectedFiles([]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWebIngest = async (e) => {
    e.preventDefault();
    setWebError(null);
    setWebSuccessMessage(null);

    if (!webUrl.trim()) {
      setWebError('Please enter a valid website URL.');
      return;
    }
    if (!webUrl.trim().startsWith('http://') && !webUrl.trim().startsWith('https://')) {
      setWebError('URL must start with http:// or https://');
      return;
    }

    setIsWebSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: webUrl.trim(),
          max_pages: parseInt(maxPages, 10) || 10,
          college_slug: collegeSlug.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Web crawling failed to trigger.');
      }

      setWebSuccessMessage(
        `Website crawling started for "${webUrl.trim()}"! Max pages: ${maxPages}. Check the Documents page to view ingested links.`
      );
      setWebUrl('');
    } catch (err) {
      setWebError(err.message);
    } finally {
      setIsWebSubmitting(false);
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
            <Clock className="w-3.5 h-3.5" /> Queued
          </span>
        );
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Knowledge Base Ingestion
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload PDF documents or crawl official college web pages using Crawl4AI to populate ChromaDB.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2 text-sm text-foreground">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="font-medium text-muted-foreground">Target College:</span>
          <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-md font-mono text-xs border border-primary/20">
            {collegeSlug}
          </span>
        </div>
      </div>

      {/* Tab Selection */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/50 border border-border rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pdf'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <FileText className="w-4 h-4" />
          PDF Document Upload
        </button>
        
        <button
          onClick={() => setActiveTab('web')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'web'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Globe className="w-4 h-4" />
          Website Crawler (Crawl4AI)
        </button>
      </div>

      {/* Tab 1: PDF Document Upload */}
      {activeTab === 'pdf' && (
        <Card className="bg-card border-border shadow-md">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl text-card-foreground flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" />
              Upload PDF Documents
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Upload institutional prospectuses, syllabus guides, or notices to be parsed and indexed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {uploadError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Drag and Drop Zone */}
            <div 
              className="relative border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-8 text-center bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group"
              onClick={() => document.getElementById('file-upload').click()}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              
              <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-7 h-7 text-primary" />
              </div>
              
              <h3 className="text-base font-semibold text-foreground mb-1">
                Click to upload or drag & drop PDFs
              </h3>
              <p className="text-xs text-muted-foreground">
                Multiple PDF documents supported. Max 50MB per file.
              </p>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Selected Files ({selectedFiles.length})
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl text-sm"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate text-foreground">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-accent transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-6 flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={isSubmitting || selectedFiles.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6 py-2.5 rounded-xl shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enqueuing PDFs...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Ingest {selectedFiles.length} PDF{selectedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Tab 2: Web Crawler (Crawl4AI) */}
      {activeTab === 'web' && (
        <Card className="bg-card border-border shadow-md">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl text-card-foreground flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              College Website Crawler
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Provide an official college website URL. Crawl4AI will render JavaScript, follow internal links, extract clean markdown, and store vector embeddings in ChromaDB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {webError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{webError}</span>
              </div>
            )}

            {webSuccessMessage && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-sm flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{webSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleWebIngest} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="web-url" className="text-foreground font-medium">
                  Official College Website URL
                </Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="web-url"
                    type="url"
                    placeholder="https://nitjsr.ac.in"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    className="pl-10 bg-background border-input text-foreground rounded-xl h-11"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Crawl4AI will render the site using headless Chromium with stealth mode to extract complete content.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-pages" className="text-foreground font-medium">
                  Maximum Pages to Crawl
                </Label>
                <Input
                  id="max-pages"
                  type="number"
                  min="1"
                  max="50"
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  className="bg-background border-input text-foreground rounded-xl h-11 max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  BFS crawler follows internal links up to this limit (1-50 pages).
                </p>
              </div>


              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={isWebSubmitting || !webUrl.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6 py-2.5 rounded-xl shadow-md disabled:opacity-50"
                >
                  {isWebSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initiating Crawler...
                    </>
                  ) : (
                    <>
                      <Compass className="w-4 h-4 mr-2" />
                      Start Web Crawl Ingestion
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active PDF Ingestion Jobs List */}
      {jobs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Recent PDF Ingestion Tasks
          </h2>
          
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.job_id}
                className="p-4 bg-card border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      ID: {job.job_id}
                    </span>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="text-sm text-foreground">
                    Files: {job.files_queued ? job.files_queued.join(', ') : 'PDF Documents'}
                  </p>
                </div>
                
                <div className="text-xs text-muted-foreground font-mono">
                  Enqueued: {new Date(job.enqueued_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Ingest;
