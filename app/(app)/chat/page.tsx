"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, Trash2, Bot, User } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [input]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + text } : m
            )
          );
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `发送失败: ${err instanceof Error ? err.message : "未知错误"}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      <PageHeader
        eyebrow="AI 助手"
        title="Claude 对话"
        description="与 Claude 进行对话，下达任务或获取帮助。"
        actions={
          messages.length > 0 ? (
            <button
              onClick={clearChat}
              className="inline-flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-sm font-semibold text-theme-secondary hover:bg-theme-card-muted"
            >
              <Trash2 className="h-4 w-4" />
              清空对话
            </button>
          ) : null
        }
      />

      <div className="flex flex-col rounded-3xl border border-theme-border bg-theme-card/95 shadow-panel backdrop-blur" style={{ height: "calc(100vh - 260px)" }}>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Bot className="mx-auto h-12 w-12 text-theme-secondary/40" />
                <h3 className="mt-4 text-lg font-semibold text-theme-heading">
                  开始对话
                </h3>
                <p className="mt-2 text-sm text-theme-secondary">
                  输入消息开始与 Claude 交流，可以下达任务、提问或寻求帮助。
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-intelligence-accent/10">
                      <Bot className="h-4 w-4 text-intelligence-accent" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-intelligence-accent text-white"
                        : "border border-theme-border bg-theme-card-muted"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {msg.content || (isLoading && msg.role === "assistant" ? "" : msg.content)}
                    </pre>
                    {isLoading && msg.role === "assistant" && !msg.content && (
                      <div className="flex items-center gap-2 text-sm text-theme-secondary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>思考中...</span>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-heading/10">
                      <User className="h-4 w-4 text-theme-heading" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-theme-border px-6 py-4">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-2xl border border-theme-border bg-theme-card-muted px-4 py-3 text-sm text-theme-heading placeholder:text-theme-secondary/60 focus:border-intelligence-accent focus:outline-none focus:ring-1 focus:ring-intelligence-accent disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-intelligence-accent text-white transition hover:bg-intelligence-accent-dark disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
