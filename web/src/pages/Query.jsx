import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Building2,
  PanelLeft,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_QUERY_URL = `${BASE_URL}/query/stream`;
const API_CHATS_URL = `${BASE_URL}/chats`;
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

  const seen = new Set();
  const uniqueSources = [];
  for (const item of sources) {
    if (!item) continue;
    const str = typeof item === 'string' ? item.trim() : String(item).trim();
    if (str && !seen.has(str.toLowerCase())) {
      seen.add(str.toLowerCase());
      uniqueSources.push(str);
    }
  }

  if (!uniqueSources.length) return null;

  return (
    <div className="mt-4 pt-3 border-t border-border/40">
      <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5" /> Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {uniqueSources.map((src, i) => {
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
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [collegeSlug, setCollegeSlug] = useState(user?.college_slug || 'nitjsr');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  
  // Track ongoing streams by chatId
  const [activeStreams, setActiveStreams] = useState({});
  const isGenerating = !!activeStreams[chatId];

  // Chat sessions state
  const [chatSessions, setChatSessions] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatAreaRef = useRef(null);
  const userScrolledUp = useRef(false);
  const isNewChatSubmissionRef = useRef(false);
  const currentViewedChatIdRef = useRef(chatId);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Sync ref with current viewed chatId
  useEffect(() => {
    currentViewedChatIdRef.current = chatId;
  }, [chatId]);

  /* ── Fetch all chat sessions for side panel ── */
  const fetchChatSessions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(API_CHATS_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data);
      }
    } catch (err) {
      console.error('Failed to fetch chat sessions:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchChatSessions();
  }, [fetchChatSessions]);

  /* ── Load active chat session messages when chatId changes ── */
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    if (!token) return;

    if (isNewChatSubmissionRef.current) {
      // Don't fetch history, we just started this chat and injected optimistic messages!
      isNewChatSubmissionRef.current = false;
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    fetch(`${API_CHATS_URL}/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Chat not found');
        return res.json();
      })
      .then(data => {
        if (!isMounted) return;
        if (data.session?.college_slug) {
          setCollegeSlug(data.session.college_slug);
        }
        const mapped = (data.messages || []).map(m => ({
          id: m.id,
          role: m.role,
          text: m.content,
          sources: m.sources || [],
          tokenStats: m.tokenStats || null
        }));
        setMessages(mapped);

        // Scroll to bottom after loading
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 50);
      })
      .catch(err => {
        console.error('Failed to load chat history:', err);
        if (isMounted) {
          navigate('/query', { replace: true });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [chatId, token, navigate]);

  /* ── Delete a chat session ── */
  const handleDeleteChat = async (e, idToDelete) => {
    e.stopPropagation();
    if (!token || deletingChatId) return;

    setDeletingChatId(idToDelete);
    try {
      const res = await fetch(`${API_CHATS_URL}/${idToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setChatSessions(prev => prev.filter(c => c.id !== idToDelete));
        if (chatId === idToDelete) {
          navigate('/query');
        }
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    } finally {
      setDeletingChatId(null);
    }
  };

  /* ── Start a new chat session ── */
  const handleNewChat = () => {
    handleCancel();
    navigate('/query');
  };

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

  /* ── Auto-resize textarea ── */
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  /* ── Cancel stream ── */
  const handleCancel = () => {
    if (chatId && activeStreams[chatId]?.controller) {
      activeStreams[chatId].controller.abort();
    }
  };

  /* ── Submit query ── */
  const handleAsk = async (overrideText) => {
    const queryText = (overrideText ?? question).trim();
    if (!queryText || isGenerating) return;

    // Use current chatId or generate a new unique session UUID
    const currentChatId = chatId || crypto.randomUUID();

    // If starting a fresh session on /query, update URL to /query/{currentChatId}
    if (!chatId) {
      isNewChatSubmissionRef.current = true;
      navigate(`/query/${currentChatId}`, { replace: true });
    }

    const userMsgId = Date.now();
    const botMsgId = userMsgId + 1;
    
    if (!chatId || chatId === currentChatId) {
      setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: queryText }]);
    }

    setQuestion('');
    if (textareaRef.current) textareaRef.current.style.height = '52px';
    userScrolledUp.current = false;

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    const controller = new AbortController();
    
    setActiveStreams(prev => ({
      ...prev,
      [currentChatId]: {
        id: botMsgId,
        role: 'assistant',
        text: '',
        sources: [],
        isStreaming: true,
        controller: controller
      }
    }));

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
          chat_id: currentChatId,
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

        setActiveStreams(prev => {
          if (!prev[currentChatId]) return prev;
          return {
            ...prev,
            [currentChatId]: {
              ...prev[currentChatId],
              text,
              tokenStats,
              sources: sources.length ? sources : prev[currentChatId].sources
            }
          };
        });
      }

      // Stream successfully finished
      setActiveStreams(prev => {
        const next = { ...prev };
        const finishedStream = next[currentChatId];
        delete next[currentChatId];
        
        // Push final message to local state if still on this chat
        if (currentViewedChatIdRef.current === currentChatId && finishedStream) {
          const { controller, ...rest } = finishedStream;
          setMessages(msgs => [...msgs, { ...rest, isStreaming: false }]);
        }
        return next;
      });

      // Re-fetch chat list so the new/updated session appears at top of sidebar
      fetchChatSessions();
    } catch (err) {
      setActiveStreams(prev => {
        const next = { ...prev };
        const erroredStream = next[currentChatId];
        delete next[currentChatId];
        
        if (currentViewedChatIdRef.current === currentChatId && erroredStream) {
          const { controller, ...rest } = erroredStream;
          const errorMsg = err.name === 'AbortError' 
            ? { ...rest, text: rest.text || '*Generation stopped.*', isStreaming: false, isCancelled: true }
            : { ...rest, text: rest.text || `**Error:** ${err.message}`, isStreaming: false, isError: true };
          setMessages(msgs => [...msgs, errorMsg]);
        }
        return next;
      });
    } finally {
      if (currentViewedChatIdRef.current === currentChatId) {
        textareaRef.current?.focus();
      }
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
  const displayMessages = [...messages];
  if (chatId && activeStreams[chatId]) {
    displayMessages.push(activeStreams[chatId]);
  }

  return (
    <div className="flex w-full" style={{ height: 'calc(100vh - 56px)' }}>
      {/* ── ChatGPT Side Panel ─────────────────────────────────── */}
      <aside
        className={`shrink-0 border-r border-border/50 bg-card/60 backdrop-blur-md transition-all duration-300 flex flex-col ${
          isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-none'
        }`}
      >
        <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          <button
            onClick={() => setIsSidebarOpen(false)}
            title="Close sidebar"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Chat History
          </p>

          {chatSessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground px-4">
              No chat history yet. Start a new conversation!
            </div>
          ) : (
            chatSessions.map((session) => {
              const isActive = session.id === chatId;
              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/query/${session.id}`)}
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'bg-muted text-foreground font-medium border border-border/80 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs leading-snug">{session.title}</p>
                    <span className="text-[10px] text-muted-foreground/70 uppercase font-mono">
                      {session.college_slug}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteChat(e, session.id)}
                    disabled={deletingChatId === session.id}
                    title="Delete chat"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-all shrink-0"
                  >
                    {deletingChatId === session.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* ── Slim top bar ─────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-border/40 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Open sidebar"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mr-1"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 px-2.5 py-1 rounded-lg border border-border/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
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
          </div>
        </div>

        {/* ── Messages area ────────────────────────────────── */}
        <div
          ref={chatAreaRef}
          className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Loading chat history…</p>
            </div>
          ) : displayMessages.length === 0 ? (
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
              {displayMessages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === 'user' ? (
                    /* User bubble — right aligned, compact pill */
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-muted/70 border border-border/60 text-foreground rounded-3xl rounded-br-md px-4 py-3 text-sm leading-relaxed shadow-sm">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    /* AI message — markdown flows directly */
                    <div className="flex items-start gap-3.5">
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
    </div>
  );
};

export default Query;
