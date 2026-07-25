import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Send, 
  Bot, 
  User, 
  Building2, 
  Sparkles, 
  Loader2, 
  BookOpen, 
  HelpCircle,
  FileText,
  Trash2,
  ExternalLink,
  Zap,
  Globe,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from '@/context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_QUERY_URL = `${BASE_URL}/query/stream`;
const API_VIEW_DOC_URL = `${BASE_URL}/documents/view`;

const FormattedMarkdown = ({ content }) => {
  if (!content) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        strong: ({ node, ...props }) => (
          <strong className="font-bold text-foreground bg-primary/10 px-1 py-0.5 rounded" {...props} />
        ),
        h1: ({ node, ...props }) => (
          <h1 className="text-xl font-bold mt-4 mb-2 text-foreground border-b border-border pb-1" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="text-lg font-bold mt-3 mb-2 text-foreground" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="text-base font-semibold mt-3 mb-1.5 text-foreground" {...props} />
        ),
        ul: ({ node, ...props }) => (
          <ul className="list-disc list-inside my-2 space-y-1 text-foreground" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal list-inside my-2 space-y-1 text-foreground" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="my-0.5 leading-relaxed" {...props} />
        ),
        p: ({ node, ...props }) => (
          <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
        ),
        code: ({ node, inline, ...props }) => 
          inline ? (
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-primary" {...props} />
          ) : (
            <code className="block bg-muted/60 p-3 rounded-lg font-mono text-xs overflow-x-auto my-2 border border-border" {...props} />
          ),
        a: ({ node, href, children, ...props }) => {
          const isWebUrl = href?.startsWith('http://') || href?.startsWith('https://');
          const targetUrl = isWebUrl ? href : `${API_VIEW_DOC_URL}/${encodeURIComponent(href || '')}`;
          return (
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline inline-flex items-center gap-1"
              {...props}
            >
              {children}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const Query = () => {
  const { user, token } = useAuth();
  const [collegeSlug, setCollegeSlug] = useState(user?.college_slug || 'nitjsr');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAsk = async (e) => {
    e.preventDefault();
    const queryText = question.trim();
    if (!queryText || !collegeSlug.trim() || isGenerating) return;

    // Add user message to conversation list
    const userMsg = { id: Date.now(), role: 'user', text: queryText };
    const botMsgId = Date.now() + 1;
    const initialBotMsg = { id: botMsgId, role: 'assistant', text: '', sources: [], isStreaming: true };

    setMessages((prev) => [...prev, userMsg, initialBotMsg]);
    setQuestion('');
    setIsGenerating(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_QUERY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          college_slug: collegeSlug.trim(),
          question: queryText,
          top_k: 4,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Query failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        accumulatedText += chunkText;

        let cleanText = accumulatedText;
        let tokenStats = null;
        let sourcesList = [];

        if (accumulatedText.includes('__TOKEN_USAGE__:')) {
          const parts = accumulatedText.split('__TOKEN_USAGE__:');
          cleanText = parts[0];
          try {
            const statsObj = JSON.parse(parts[1].trim());
            tokenStats = statsObj;
            if (statsObj.sources && Array.isArray(statsObj.sources)) {
              sourcesList = statsObj.sources;
            }
          } catch (e) {
            console.error('Failed to parse token usage JSON:', e);
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? { 
                  ...msg, 
                  text: cleanText, 
                  tokenStats,
                  sources: sourcesList.length > 0 ? sourcesList : msg.sources 
                }
              : msg
          )
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (err) {
      console.error('Error querying backend:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? { 
                ...msg, 
                text: `❌ Error: ${err.message || 'Failed to get response from server.'}`,
                isStreaming: false,
                isError: true 
              }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5 text-foreground">
            <Sparkles className="w-6 h-6 text-primary" />
            Institute Knowledge Assistant
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Ask questions grounded strictly in your institute's ingested documents and web pages.
          </p>
        </div>

        {/* Institute Selector */}
        <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border/60 shadow-sm">
          <Building2 className="w-4 h-4 text-primary shrink-0 ml-1" />
          <Label htmlFor="slug" className="text-xs font-semibold whitespace-nowrap text-foreground">
            Target Institute:
          </Label>
          <Input
            id="slug"
            type="text"
            value={collegeSlug}
            onChange={(e) => setCollegeSlug(e.target.value)}
            className="h-8 text-xs font-mono w-32 bg-background text-foreground"
            placeholder="e.g. nitjsr"
          />
          {messages.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={clearChat}
              title="Clear Conversation"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <Card className="flex-1 flex flex-col border-border/60 shadow-lg bg-card/50 overflow-hidden min-h-[450px]">
        <CardContent className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-4 my-auto">
              <div className="p-4 rounded-full bg-primary/10 text-primary">
                <BookOpen className="w-10 h-10" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-semibold text-foreground">
                  Ask Anything About Your Institute Docs
                </h3>
                <p className="text-xs text-muted-foreground">
                  Make sure you have ingested documents for institute <span className="font-mono text-primary font-medium">"{collegeSlug}"</span> first.
                </p>
              </div>

              {/* Sample Queries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 w-full max-w-lg">
                {[
                  "What is the best way to reach the institute?",
                  "Summarize the grading criteria",
                  "What are the attendance requirements?",
                  "List the key academic notices"
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuestion(sample);
                    }}
                    className="p-3 text-left rounded-lg bg-card border border-border/60 hover:border-primary/50 hover:bg-accent/40 transition-colors text-xs text-foreground flex items-center gap-2"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{sample}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 text-sm ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] md:max-w-[78%] rounded-2xl p-4 shadow-sm space-y-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground font-medium rounded-tr-none'
                        : msg.isError
                        ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-none'
                        : 'bg-card border border-border/70 text-foreground rounded-tl-none'
                    }`}
                  >
                    {/* Role Header */}
                    <div className="text-[11px] font-semibold opacity-70 flex items-center justify-between gap-1.5 border-b border-border/30 pb-1.5">
                      <span>{msg.role === 'user' ? 'You' : `AI Assistant (${collegeSlug})`}</span>
                      {msg.tokenStats?.total_tokens && (
                        <span className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                          {msg.tokenStats.total_tokens} tokens
                        </span>
                      )}
                    </div>

                    {/* Message Body with Markdown Rendering */}
                    <div className="leading-relaxed text-sm">
                      {msg.role === 'user' ? (
                        <span>{msg.text}</span>
                      ) : msg.text ? (
                        <FormattedMarkdown content={msg.text} />
                      ) : (
                        <span className="inline-flex items-center gap-2 text-muted-foreground italic text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Retrieving information...
                        </span>
                      )}
                    </div>

                    {/* Rendered Sources List */}
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="pt-3 border-t border-border/40 space-y-2">
                        <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          <span>Sources Referenced:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src, idx) => {
                            const isWebUrl = src.startsWith('http://') || src.startsWith('https://');
                            const href = isWebUrl 
                              ? src 
                              : `${API_VIEW_DOC_URL}/${encodeURIComponent(src)}`;
                            const isPdf = src.toLowerCase().endsWith('.pdf') || src.toLowerCase().includes('.pdf');

                            return (
                              <a
                                key={idx}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open ${isWebUrl ? 'website' : 'PDF document'}: ${src}`}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all font-mono"
                              >
                                {isPdf ? (
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <Globe className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="max-w-[280px] truncate">{src}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>

        {/* Input Footer */}
        <div className="p-4 border-t border-border/60 bg-card">
          <form onSubmit={handleAsk} className="flex items-center gap-2">
            <Input
              type="text"
              placeholder={`Ask a question for ${collegeSlug}...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isGenerating}
              className="flex-1 bg-background border-input text-foreground h-11 rounded-xl"
            />
            <Button 
              type="submit" 
              disabled={isGenerating || !question.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-5 rounded-xl gap-2 font-medium"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default Query;
