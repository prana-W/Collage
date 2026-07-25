import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  Database, 
  Sparkles, 
  Layers, 
  UploadCloud, 
  MessageSquareText, 
  ShieldCheck, 
  Zap, 
  BookOpen, 
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Home = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          Multi-Tenant RAG Knowledge Engine
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
          Welcome to <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/50 bg-clip-text text-transparent">COLLAGE</span>
        </h1>

        <p className="text-lg sm:text-xl font-medium text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Bringing scattered institute knowledge into <span className="text-foreground font-semibold">one unified picture</span>.
        </p>

        {/* Wordplay Explanation Banner */}
        <Card className="max-w-2xl mx-auto border-border/60 bg-card/60 shadow-md text-left p-2">
          <CardContent className="p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed flex gap-3.5 items-start">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-foreground block mb-1">
                The Story Behind the Name
              </span>
              <strong className="text-foreground font-semibold">COLLAGE</strong> is a clever wordplay on <em>"College"</em>. 
              In academic institutions, essential information—syllabi, grading rules, exam timetables, and campus notices—is scattered across dozens of disconnected PDFs. 
              <strong> COLLAGE</strong> brings all those fragmented pieces together into one single, coherent RAG picture for instant AI retrieval.
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {isAuthenticated ? (
            <>
              <Link to="/query">
                <Button size="lg" className="font-semibold px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                  <MessageSquareText className="w-4 h-4 mr-2" />
                  Query Assistant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              {isAdmin && (
                <Link to="/ingest">
                  <Button size="lg" variant="outline" className="font-semibold px-6 border-border hover:bg-accent">
                    <UploadCloud className="w-4 h-4 mr-2" />
                    PDF Ingestion
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/register">
                <Button size="lg" className="font-semibold px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                  Get Started / Register
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="font-semibold px-6 border-border hover:bg-accent">
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Feature 1 */}
        <Card className="border-border/60 shadow-md bg-card hover:border-primary/40 transition-colors">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <GraduationCap className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Multi-Tenant Isolation</CardTitle>
            <CardDescription className="text-xs">
              Every college operates independently using isolated college slugs (<span className="font-mono text-primary">nitjsr</span>, <span className="font-mono text-primary">iitb</span>) in ChromaDB.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Feature 2 */}
        <Card className="border-border/60 shadow-md bg-card hover:border-primary/40 transition-colors">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Zap className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Async Processing Queue</CardTitle>
            <CardDescription className="text-xs">
              Heavy PDF parsing and RapidOCR text extraction run asynchronously via Redis Queue (RQ) worker processes without blocking the main API thread.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Feature 3 */}
        <Card className="border-border/60 shadow-md bg-card hover:border-primary/40 transition-colors">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Zero-Hallucination Answers</CardTitle>
            <CardDescription className="text-xs">
              Strict context-grounded prompts force the LLM to answer using only ingested documents, complete with precise source and page citations.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* Workflow Section */}
      <section className="p-8 rounded-2xl bg-card border border-border/60 shadow-md space-y-6">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            How COLLAGE Works
          </h2>
          <p className="text-xs text-muted-foreground">
            From raw, scattered PDFs to instantaneous, cite-backed answers in 3 simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-xs">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="font-bold text-primary flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">1</span>
              Upload PDFs (Admins)
            </div>
            <p className="text-muted-foreground">
              Institute Admins upload campus notices, syllabi, or rules. Files are safely stored with timestamped names.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="font-bold text-primary flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">2</span>
              Background Indexing
            </div>
            <p className="text-muted-foreground">
              RQ worker threads pick up jobs, parse text & images via RapidOCR, chunk data, and compute embeddings into ChromaDB.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="font-bold text-primary flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">3</span>
              Real-Time Query Assistant
            </div>
            <p className="text-muted-foreground">
              Students and faculty ask questions and receive streamed, token-by-token answers backed by page-level document citations.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
