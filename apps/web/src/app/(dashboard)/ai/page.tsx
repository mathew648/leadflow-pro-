"use client";
import { useState, useRef, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your AI trade business assistant. I can help with job pricing, customer communication, compliance questions, business growth strategies, and more. What can I help you with today?" },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || streaming) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const token = getAccessToken();
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userMsg.content,
          history: messages.slice(-10),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const { text } = JSON.parse(data);
              accumulated += text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
                return updated;
              });
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, I encountered an error. Please try again." };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  const SUGGESTIONS = [
    "How should I price an electrical switchboard upgrade?",
    "Draft a professional quote follow-up SMS",
    "What are the compliance requirements for hot water installations in NSW?",
    "How can I get more Google reviews from happy customers?",
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar title="AI Trade Assistant" />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {messages.length === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                className="p-3 text-left text-sm rounded-xl border hover:bg-muted hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-4 h-4" />
              </div>
            )}
            <div className={cn(
              "max-w-xl rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-brand-500 text-white rounded-br-sm"
                : "bg-white border text-foreground rounded-bl-sm shadow-sm"
            )}>
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                <span className="inline-block w-1 h-4 bg-brand-500 ml-1 animate-pulse" />
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            placeholder="Ask anything about your trades business…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            disabled={streaming}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={!input.trim() || streaming} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          AI responses are suggestions only — always verify compliance with local regulations.
        </p>
      </div>
    </div>
  );
}
