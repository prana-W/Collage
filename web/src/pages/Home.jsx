import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Loader2, 
  RefreshCw,
  Building2,
  Database
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'http://localhost:8000/api/v1/ingest';
const POLL_INTERVAL_MS = 5000;

const Home = () => {
  const { user } = useAuth();
  const [collegeSlug, setCollegeSlug] = useState(user?.college_slug || 'nitjsr');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  // Tracked jobs: list of job objects
  const [jobs, setJobs] = useState([]);
  
  // Ref to hold polling interval timer
  const pollingRef = useRef(null);

  // Function to fetch status of a single job
  const checkJobStatus = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/status/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed status check: ${res.statusText}`);
      }
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`Error polling job ${jobId}:`, err);
      return null;
    }
  };

  // Poll active (queued or processing) jobs every 5 seconds
  useEffect(() => {
    const pollAllActiveJobs = async () => {
      setJobs((prevJobs) => {
        const activeJobs = prevJobs.filter(
          (j) => j.status === 'queued' || j.status === 'processing'
        );
        
        if (activeJobs.length === 0) return prevJobs;

        // Fetch updates for all active jobs
        Promise.all(activeJobs.map((j) => checkJobStatus(j.job_id))).then((updates) => {
          setJobs((currentJobs) =>
            currentJobs.map((j) => {
              const updated = updates.find((u) => u && u.job_id === j.job_id);
              if (updated) {
                return { ...j, ...updated };
              }
              return j;
            })
          );
        });

        return prevJobs;
      });
    };

    // Run poll immediately then every 5s
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
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // Construct new job object and add to job state list
      const newJob = {
        job_id: data.job_id,
        college_slug: data.college_slug,
        file_names: data.files_queued || selectedFiles.map((f) => f.name),
        status: data.status || 'queued',
        enqueued_at: new Date().toISOString(),
        created_at: Date.now() / 1000,
        result: null,
        error: null,
      };

      setJobs((prev) => [newJob, ...prev]);
      setSelectedFiles([]);
    } catch (err) {
      setUploadError(err.message || 'An error occurred while sending files.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            Queued
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Processing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Database className="w-8 h-8 text-primary" />
          PDF Knowledge Base Ingestion
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Upload PDF documents for background OCR, chunking, and ChromaDB vector indexing. 
          Jobs are processed asynchronously with automatic status updates polled every 5 seconds.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Upload Form */}
        <div className="md:col-span-6">
          <Card className="border-border/60 shadow-lg bg-card">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-primary" />
                Upload PDF Files
              </CardTitle>
              <CardDescription>
                Specify the college slug and upload PDF files for ingestion.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleUpload}>
              <CardContent className="space-y-5">
                {/* College Slug */}
                <div className="space-y-2">
                  <Label htmlFor="college-slug" className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    College Slug / Institute ID
                  </Label>
                  <Input
                    id="college-slug"
                    type="text"
                    placeholder="e.g. nitjsr, iitb, stanford"
                    value={collegeSlug}
                    onChange={(e) => setCollegeSlug(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Determines which ChromaDB multi-tenant collection the data is stored in.
                  </p>
                </div>

                {/* File Dropzone */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">PDF Documents</Label>
                  <div className="relative border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-6 text-center cursor-pointer bg-muted/20 hover:bg-muted/30">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      Click to choose or drag & drop PDFs
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only .pdf files are supported
                    </p>
                  </div>
                </div>

                {/* Selected File List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Selected Files ({selectedFiles.length})
                    </Label>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border/50 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate font-medium">{file.name}</span>
                            <span className="text-muted-foreground text-[10px]">
                              ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {uploadError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting || selectedFiles.length === 0}
                  className="w-full font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enqueuing Files...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 mr-2" />
                      Submit for Ingestion
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Jobs & Status Polling Panel */}
        <div className="md:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              Ingestion Job Tracker
            </h2>
            <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1" />
              Polling every 5s
            </span>
          </div>

          {jobs.length === 0 ? (
            <Card className="border-border/60 bg-card/50 p-8 text-center">
              <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No ingestion jobs yet.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Upload a PDF file using the form on the left to queue a background ingestion job.
              </p>
            </Card>
          ) : (
            <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
              {jobs.map((job) => (
                <Card
                  key={job.job_id}
                  className="border-border/60 shadow-sm bg-card hover:border-border transition-colors"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-primary px-2 py-0.5 rounded bg-primary/10">
                            {job.college_slug}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                            ID: {job.job_id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 text-xs space-y-3">
                    {/* Files list */}
                    <div>
                      <span className="text-muted-foreground font-medium">Files:</span>
                      <ul className="mt-1 space-y-1">
                        {(job.file_names || job.files_queued || []).map((fname, fidx) => (
                          <li
                            key={fidx}
                            className="truncate text-foreground font-mono bg-muted/30 px-2 py-1 rounded"
                          >
                            📄 {fname}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Progress / Results */}
                    {job.status === 'completed' && job.result && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Successfully Ingested
                        </div>
                        <div className="text-[11px] text-emerald-400/90">
                          Total Chunks Indexing: {job.result.chunks_ingested}
                        </div>
                      </div>
                    )}

                    {job.status === 'failed' && job.error && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Ingestion Error
                        </div>
                        <div className="text-[11px] font-mono break-all text-rose-400/90">
                          {job.error}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="p-4 pt-0 text-[11px] text-muted-foreground flex justify-between">
                    <span>
                      Enqueued:{' '}
                      {job.enqueued_at
                        ? new Date(job.enqueued_at).toLocaleTimeString()
                        : 'Just now'}
                    </span>
                    {job.ended_at && (
                      <span>
                        Finished: {new Date(job.ended_at).toLocaleTimeString()}
                      </span>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
