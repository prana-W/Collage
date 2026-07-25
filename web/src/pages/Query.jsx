import React, { useState, useRef, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from '@/context/AuthContext';

const API_VIEW_DOC_URL = 'http://localhost:8000/api/v1/documents/view';

const renderFormattedMessage = (text) => {
  if (!text) return null;

  // Regex matches any filename ending in .pdf
  const pdfRegex = /\b([a-zA-Z0-9_\-]+\.pdf)\b/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = pdfRegex.exec(text)) !== null) {
    const pdfName = match[1];
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    parts.push(
      <a
        key={`${pdfName}-${matchIndex}`}
        href={`${API_VIEW_DOC_URL}/${encodeURIComponent(pdfName)}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`View document: ${pdfName}`}
        className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 border border-primary/30 text-primary hover:underline hover:bg-primary/20 transition-colors"
      >
        <FileText className="w-3 h-3 shrink-0" />
        <span>{pdfName}</span>
        <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
      </a>
    );

    lastIndex = matchIndex + pdfName.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
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
    const initialBotMsg = { id: botMsgId, role: 'assistant', text: '', isStreaming: true };

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

      // Stream response reading
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        accumulatedText += chunkText;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? { ...msg, text: accumulatedText }
              : msg
          )
        );
      }

      // Mark streaming as complete
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-primary" />
            Institute Knowledge Assistant
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Ask questions grounded strictly in your institute's ingested PDF documents with citations.
          </p>
        </div>

        {/* Institute Selector */}
        <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border/60 shadow-sm">
          <Building2 className="w-4 h-4 text-primary shrink-0 ml-1" />
          <Label htmlFor="slug" className="text-xs font-semibold whitespace-nowrap">
            Target Institute:
          </Label>
          <Input
            id="slug"
            type="text"
            value={collegeSlug}
            onChange={(e) => setCollegeSlug(e.target.value)}
            className="h-8 text-xs font-mono w-32 bg-background"
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
                  Make sure you have ingested PDFs for institute <span className="font-mono text-primary font-medium">"{collegeSlug}"</span> first.
                </p>
              </div>

              {/* Sample Queries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 w-full max-w-lg">
                {[
                  "What are the major syllabus topics?",
                  "Summarize the grading criteria",
                  "What is mentioned on page 1?",
                  "What are the attendance requirements?"
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
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm space-y-2 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground font-medium rounded-tr-none'
                        : msg.isError
                        ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-none'
                        : 'bg-card border border-border/70 text-foreground rounded-tl-none'
                    }`}
                  >
                    {/* Role Header */}
                    <div className="text-[11px] font-semibold opacity-70 flex items-center gap-1.5 mb-1">
                      {msg.role === 'user' ? 'You' : `AI Assistant (${collegeSlug})`}
                    </div>

                    {/* Message Body */}
                    <div className="whitespace-pre-wrap leading-relaxed text-sm">
                      {msg.text ? (
                        renderFormattedMessage(msg.text)
                      ) : (
                        <span className="inline-flex items-center gap-2 text-muted-foreground italic text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          Searching knowledge base & generating answer...
                        </span>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground border border-border flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>

        {/* Input Bar */}
        <div className="p-4 bg-card border-t border-border/60">
          <form onSubmit={handleAsk} className="flex gap-2">
            <Input
              type="text"
              placeholder={`Ask a question about ${collegeSlug}...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isGenerating}
              className="flex-1 bg-background text-sm"
            />
            <Button 
              type="submit" 
              disabled={isGenerating || !question.trim()}
              className="px-5 font-medium shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Ask</span>
                  <Send className="w-4 h-4 ml-1.5" />
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
