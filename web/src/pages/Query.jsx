import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Bot,
  Sparkles,
  Loader2,
  BookOpen,
  FileText,
  Trash2,
  ExternalLink,
  Globe,
  StopCircle,
  ChevronDown,
  X,
  GraduationCap,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_QUERY_URL = `${BASE_URL}/query/stream`;
const API_VIEW_DOC_URL = `${BASE_URL}/documents/view`;

/* ─── Markdown renderer ──────────────────────────────────────── */
const Markdown = ({ content }) => {
  if (!content) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-5 mb-2 text-foreground" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-foreground" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-5 my-2 space-y-1.5" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-5 my-2 space-y-1.5" {...props} />,
        li: ({ node, ...props }) => <li className="leading-relaxed text-foreground" {...props} />,
        p: ({ node, ...props }) => <p className="mb-3 last:mb-0 leading-[1.75] text-foreground" {...props} />,
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-2 border-border pl-4 my-3 text-muted-foreground italic" {...props} />
        ),
        code: ({ node, inline, ...props }) =>
          inline ? (
            <code className="bg-muted/70 px-1.5 py-0.5 rounded text-[13px] font-mono text-primary" {...props} />
          ) : (
            <pre className="bg-muted/50 border border-border rounded-xl p-4 my-3 overflow-x-auto">
              <code className="font-mono text-xs text-foreground" {...props} />
            </pre>
          ),
        a: ({ node, href, children, ...props }) => {
          const isWeb = href?.startsWith('http://') || href?.startsWith('https://');
          return (
            <a
              href={isWeb ? href : `${API_VIEW_DOC_URL}/${encodeURIComponent(href || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-0.5"
              {...props}
            >
              {children}
              <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
            </a>
          );
        },
        hr: () => <hr className="border-border my-4" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

/* ─── Source pills ───────────────────────────────────────────── */
const Sources = ({ sources }) => {
  if (!sources?.length) return null;
  return (
    <div className="mt-4 pt-3 border-t border-border/40">
      <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5" /> Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((src, i) => {
          const isWeb = src.startsWith('http://') || src.startsWith('https://');
          const isPdf = src.toLowerCase().includes('.pdf');
          const href = isWeb ? src : `${API_VIEW_DOC_URL}/${encodeURIComponent(src)}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors font-mono max-w-[260px]"
            >
              {isPdf ? <FileText className="w-3 h-3 shrink-0 text-primary" /> : <Globe className="w-3 h-3 shrink-0 text-primary" />}
              <span className="truncate">{src}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
};

const SAMPLES = [
  { label: 'How do I reach the campus?', icon: '🗺️' },
  { label: 'What are the grading criteria?', icon: '📊' },
  { label: 'Attendance policy summary', icon: '📋' },
  { label: 'Key academic notices', icon: '📌' },
];

/* ════════════════════════════════════════════════════════════ */
const Query = () => {
  const { user, token } = useAuth();
  const [collegeSlug, setCollegeSlug] = useState(user?.college_slug || 'nitjsr');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatAreaRef = useRef(null);
  const abortRef = useRef(null);
  const userScrolledUp = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  /* ── Scroll tracking ── */
  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    const handler = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      userScrolledUp.current = !nearBottom;
      setShowScrollBtn(!nearBottom);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  /* Remove automatic scroll on every token update so user can scroll freely */

  /* ── Auto-resize textarea ── */
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  /* ── Cancel stream ── */
  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  /* ── Submit ── */
  const handleAsk = async (overrideText) => {
    const queryText = (overrideText ?? question).trim();
    if (!queryText || isGenerating) return;

    // Capture existing chat history prior to adding the new query
    const chatHistoryPayload = messages
      .filter(m => m.text && !m.isStreaming && !m.isError && !m.isCancelled)
      .map(m => ({ role: m.role, content: m.text }));

    const userMsgId = Date.now();
    const botMsgId = userMsgId + 1;
    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', text: queryText },
      { id: botMsgId, role: 'assistant', text: '', sources: [], isStreaming: true },
    ]);
    setQuestion('');
    if (textareaRef.current) textareaRef.current.style.height = '52px';
    setIsGenerating(true);
    userScrolledUp.current = false;

    // Scroll down once when question is submitted
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(API_QUERY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          college_slug: collegeSlug.trim(),
          question: queryText,
          top_k: 4,
          chat_history: chatHistoryPayload,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        let text = accumulated;
        let tokenStats = null;
        let sources = [];

        if (accumulated.includes('__TOKEN_USAGE__:')) {
          const [body, meta] = accumulated.split('__TOKEN_USAGE__:');
          text = body;
          try {
            const s = JSON.parse(meta.trim());
            tokenStats = s;
            sources = s.sources || [];
          } catch {}
        }

        setMessages(prev =>
          prev.map(m =>
            m.id === botMsgId
              ? { ...m, text, tokenStats, sources: sources.length ? sources : m.sources }
              : m
          )
        );
      }

      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === botMsgId
              ? { ...m, text: m.text || '*Generation stopped.*', isStreaming: false, isCancelled: true }
              : m
          )
        );
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === botMsgId
              ? { ...m, text: `**Error:** ${err.message}`, isStreaming: false, isError: true }
              : m
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Slim top bar ─────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-2 border-b border-border/40 bg-background">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GraduationCap className="w-4 h-4 text-primary" />
          <span>COLLAGE Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Editable institute slug pill */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-full px-3 py-1">
            <Building2 className="w-3 h-3 text-primary shrink-0" />
            <input
              type="text"
              value={collegeSlug}
              onChange={e => setCollegeSlug(e.target.value)}
              className="bg-transparent font-mono text-primary text-xs w-28 focus:outline-none"
              title="Target institute slug"
            />
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear chat"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages area ────────────────────────────────── */}
      <div
        ref={chatAreaRef}
        className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {messages.length === 0 ? (
          /* ── Empty / welcome state ── */
          <div className="flex flex-col items-center justify-center h-full px-4 pb-8 text-center space-y-8">
            <div className="space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  Ask anything about&nbsp;
                  <span className="font-mono font-semibold text-primary">{collegeSlug}</span>.
                  Answers are grounded in ingested documents and web pages.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              {SAMPLES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleAsk(s.label)}
                  className="flex items-start gap-3 p-4 text-left rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <span className="text-lg leading-none shrink-0">{s.icon}</span>
                  <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors leading-snug">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Chat messages ── */
          <div className="py-8 space-y-8 max-w-3xl mx-auto px-4 md:px-6">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  /* User bubble — right aligned, compact pill */
                  <div className="flex justify-end">
                    <div className="max-w-[75%] bg-muted/70 border border-border/60 text-foreground rounded-3xl rounded-br-md px-4 py-3 text-sm leading-relaxed shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  /* AI message — no bubble, markdown flows directly */
                  <div className="flex items-start gap-3.5">
                    {/* Small bot avatar */}
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Token count badge */}
                      {msg.tokenStats?.total_tokens && !msg.isStreaming && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 border border-border/40 px-2 py-0.5 rounded-full">
                            {msg.tokenStats.total_tokens} tokens
                          </span>
                        </div>
                      )}

                      {/* Message content */}
                      {msg.text ? (
                        <div className={`text-sm ${msg.isError ? 'text-destructive' : msg.isCancelled ? 'text-muted-foreground' : 'text-foreground'}`}>
                          <Markdown content={msg.text} />
                          {/* Streaming cursor */}
                          {msg.isStreaming && (
                            <span className="inline-block w-[3px] h-4 bg-primary/80 rounded-sm animate-pulse ml-0.5 align-middle" />
                          )}
                        </div>
                      ) : (
                        /* Thinking state */
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
                          <span className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </div>
                      )}

                      {/* Sources */}
                      {!msg.isStreaming && <Sources sources={msg.sources} />}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={() => {
            userScrolledUp.current = false;
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="fixed bottom-28 right-6 z-20 w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* ── Input bar ────────────────────────────────────── */}
      <div className="shrink-0 px-4 md:px-6 py-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <div className={`relative flex items-end gap-2 bg-card border rounded-3xl shadow-sm transition-all px-4 py-3 ${
            isGenerating ? 'border-border/60' : 'border-border hover:border-border/80 focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5'
          }`}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={question}
              onChange={e => { setQuestion(e.target.value); resizeTextarea(); }}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              placeholder={`Message ${collegeSlug}…`}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[180px] overflow-y-auto [scrollbar-width:none] leading-6 disabled:opacity-60"
              style={{ height: '24px' }}
            />

            <div className="flex items-center gap-1.5 shrink-0 self-end pb-0.5">
              {question && !isGenerating && (
                <button
                  type="button"
                  onClick={() => { setQuestion(''); if (textareaRef.current) textareaRef.current.style.height = '24px'; }}
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
                  title="Stop generating"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAsk()}
                  disabled={!question.trim()}
                  className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-center text-muted-foreground mt-2">
            Answers are grounded in ingested documents only · Not official advice
          </p>
        </div>
      </div>
    </div>
  );
};

export default Query;
