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
  GraduationCap,
  Activity,
  FileCheck,
  UserCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Home = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full badge-teal text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          Multi-Tenant RAG Engine with Smart Routing
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
          Welcome to <span className="text-gradient-brand">COLLAGE</span>
        </h1>

        <p className="text-lg sm:text-xl font-medium text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Bringing scattered institute knowledge into <span className="text-foreground font-semibold">one unified picture</span> with complete cost & token transparency.
        </p>

        {/* Wordplay Explanation Banner */}
        <Card className="max-w-2xl mx-auto border-border/60 bg-card/60 shadow-md text-left p-2">
          <CardContent className="p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed flex gap-3.5 items-start">
            <div className="p-2.5 rounded-xl badge-teal shrink-0">
              <Layers className="w-5 h-5 text-[#4eb2a8]" />
            </div>
            <div>
              <span className="font-semibold text-foreground block mb-1 text-base">
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
                <Button size="lg" className="font-semibold px-6 btn-gradient-brand shadow-lg">
                  <MessageSquareText className="w-4 h-4 mr-2" />
                  Query Assistant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              {isAdmin && (
                <>
                  <Link to="/ingest">
                    <Button size="lg" variant="outline" className="font-semibold px-6 border-border hover:bg-accent/60">
                      <UploadCloud className="w-4 h-4 mr-2 text-[#df7850]" />
                      PDF Ingestion
                    </Button>
                  </Link>
                  <Link to="/documents">
                    <Button size="lg" variant="outline" className="font-semibold px-6 border-border hover:bg-accent/60">
                      <FileCheck className="w-4 h-4 mr-2 text-[#e2b453]" />
                      Manage Docs
                    </Button>
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <Link to="/register">
                <Button size="lg" className="font-semibold px-6 btn-gradient-brand shadow-lg">
                  Get Started / Register
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="font-semibold px-6 border-border hover:bg-accent/60">
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature Cards Grid (Multi-Color Fold Highlights) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
        {/* Feature 1: Multi-Tenant */}
        <Card className="border-border/60 shadow-md bg-card hover:border-[#4eb2a8]/50 transition-all hover:shadow-lg">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl badge-teal flex items-center justify-center mb-2">
              <GraduationCap className="w-5 h-5 text-[#4eb2a8]" />
            </div>
            <CardTitle className="text-base">Multi-Tenant Isolation</CardTitle>
            <CardDescription className="text-xs">
              Institutes operate independently using isolated college slugs (<span className="font-mono text-[#4eb2a8]">nitjsr</span>, <span className="font-mono text-[#4eb2a8]">iitb</span>) in ChromaDB.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Feature 2: Token Auditing */}
        <Card className="border-border/60 shadow-md bg-card hover:border-[#e2b453]/50 transition-all hover:shadow-lg">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl badge-gold flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-[#e2b453]" />
            </div>
            <CardTitle className="text-base">Real-Time Token Auditing</CardTitle>
            <CardDescription className="text-xs">
              Tracks precise token consumption across Query Enhancer, Embedding search, RAG context, and LLM output streams.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Feature 3: Dual Purge Vector Store */}
        <Card className="border-border/60 shadow-md bg-card hover:border-[#3b8599]/50 transition-all hover:shadow-lg">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl badge-ocean flex items-center justify-center mb-2">
              <FileCheck className="w-5 h-5 text-[#3b8599]" />
            </div>
            <CardTitle className="text-base">Dual Vector Cleanup</CardTitle>
            <CardDescription className="text-xs">
              Admin deletions purge physical PDF files from storage while removing all matching vector chunks from ChromaDB collections.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Feature 4: Grounded Guardrails */}
        <Card className="border-border/60 shadow-md bg-card hover:border-[#df7850]/50 transition-all hover:shadow-lg">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl badge-coral flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5 text-[#df7850]" />
            </div>
            <CardTitle className="text-base">Smart Routing & Refusal</CardTitle>
            <CardDescription className="text-xs">
              Smart intent router bypasses vector lookups for general questions and enforces strict guardrail refusals for code solver requests.
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
            <div className="font-bold flex items-center gap-2 text-[#4eb2a8]">
              <span className="w-6 h-6 rounded-full badge-teal flex items-center justify-center text-xs">1</span>
              Upload PDFs (Admins)
            </div>
            <p className="text-muted-foreground">
              Institute Admins upload campus notices, syllabi, or rules. Files are safely stored with timestamped names.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="font-bold flex items-center gap-2 text-[#3b8599]">
              <span className="w-6 h-6 rounded-full badge-ocean flex items-center justify-center text-xs">2</span>
              Background Indexing
            </div>
            <p className="text-muted-foreground">
              RQ worker threads pick up jobs, parse layout & headings via Docling, chunk data, and compute embeddings into ChromaDB.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="font-bold flex items-center gap-2 text-[#df7850]">
              <span className="w-6 h-6 rounded-full badge-coral flex items-center justify-center text-xs">3</span>
              Real-Time Query & Analytics
            </div>
            <p className="text-muted-foreground">
              Students and faculty receive streamed, cite-backed answers with live token accounting and user profile analytics.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
