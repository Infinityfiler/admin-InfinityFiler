import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, X, Send, Paperclip, Loader2, Download, Eye
} from "lucide-react";

interface ChatMessage {
  id: number;
  order_id: number;
  customer_id: number | null;
  sender_type: string;
  sender_name: string;
  message: string | null;
  file_name: string | null;
  file_path: string | null;
  created_at: string;
}

interface FloatingChatProps {
  orderId: number;
  senderType: "admin" | "customer";
  senderName: string;
  fetchUrl: string;
  postUrl: string;
  downloadUrlPrefix: string;
  authHeaders?: Record<string, string>;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FloatingChat({
  orderId,
  senderType,
  senderName,
  fetchUrl,
  postUrl,
  downloadUrlPrefix,
  authHeaders = {},
}: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenCountRef = useRef(0);
  const openRef = useRef(false);
  const authHeadersRef = useRef(authHeaders);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(0);

  openRef.current = open;
  authHeadersRef.current = authHeaders;

  const fetchMessages = useCallback(async () => {
    try {
      const headers = typeof authHeadersRef.current === 'object' ? { ...authHeadersRef.current } : {};
      const res = await fetch(fetchUrl, { headers });
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        setMessages(data);
        if (!openRef.current) {
          const otherMessages = data.filter(m => m.sender_type !== senderType).length;
          const newUnread = Math.max(0, otherMessages - lastSeenCountRef.current);
          setUnreadCount(data.length > 0 && newUnread > 0 ? newUnread : 0);
        }
      }
    } catch (_) {}
    setLoading(false);
  }, [fetchUrl, senderType]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (!open || !scrollContainerRef.current) return;
    const hasNewMessages = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (hasNewMessages) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      const otherCount = messages.filter(m => m.sender_type !== senderType).length;
      lastSeenCountRef.current = otherCount;
      setUnreadCount(0);
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
        inputRef.current?.focus();
      }, 100);
    } else {
      lastSeenCountRef.current = messages.filter(m => m.sender_type !== senderType).length;
    }
  }, [open, messages, senderType]);

  const handleSend = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("message", text.trim());
      formData.append("sender_type", senderType);
      formData.append("sender_name", senderName);
      if (file) formData.append("file", file);

      const headers = typeof authHeadersRef.current === 'object' ? { ...authHeadersRef.current } : {};
      const res = await fetch(postUrl, {
        method: "POST",
        body: formData,
        headers,
      });
      if (res.ok) {
        setText("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchMessages();
      }
    } catch (_) {}
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDownload = async (msg: ChatMessage) => {
    if (!msg.file_path) return;
    try {
      const url = `${downloadUrlPrefix}/${msg.id}/download`;
      const headers = typeof authHeadersRef.current === 'object' ? { ...authHeadersRef.current } : {};
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = msg.file_name || "file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (_) {}
  };

  const handleView = async (msg: ChatMessage) => {
    if (!msg.file_path) return;
    try {
      const url = `${downloadUrlPrefix}/${msg.id}/download`;
      const headers = typeof authHeadersRef.current === 'object' ? { ...authHeadersRef.current } : {};
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (_) {}
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
          data-testid="button-chat-toggle"
        >
          <MessageSquare className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse" data-testid="badge-unread-count">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[9999] w-[360px] sm:w-[400px] h-[520px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200" data-testid="chat-popup">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <div>
                <p className="font-semibold text-sm" data-testid="text-chat-title">Order Chat</p>
                <p className="text-[10px] opacity-80">{messages.length} message{messages.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              data-testid="button-chat-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-3 space-y-2"
            data-testid="chat-messages-area"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Send a message to start the conversation</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_type === senderType;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    data-testid={`chat-message-${msg.id}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-semibold ${
                          isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {msg.sender_name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[8px] px-1 py-0 leading-3 h-3.5 ${
                            msg.sender_type === "admin"
                              ? isMine ? "bg-primary-foreground/20 text-primary-foreground/80" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : isMine ? "bg-primary-foreground/20 text-primary-foreground/80" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          }`}
                          data-testid={`badge-sender-${msg.id}`}
                        >
                          {msg.sender_type === "admin" ? "Admin" : "Customer"}
                        </Badge>
                      </div>
                      {msg.message && (
                        <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      )}
                      {msg.file_name && (
                        <div
                          className={`flex items-center gap-1.5 mt-1 text-[11px] rounded-lg px-2 py-1 ${
                            isMine
                              ? "bg-primary-foreground/10 text-primary-foreground/80"
                              : "bg-background/80 text-muted-foreground"
                          }`}
                          data-testid={`link-chat-file-${msg.id}`}
                        >
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate flex-1">{msg.file_name}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[7px] px-1 py-0 leading-3 h-3 ml-1 ${
                              msg.sender_type === "admin"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            }`}
                          >
                            {msg.sender_type === "admin" ? "Admin" : "Customer"}
                          </Badge>
                          {msg.file_path && (
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                onClick={() => handleView(msg)}
                                className={`p-0.5 rounded hover:opacity-70 transition-opacity`}
                                title="View"
                                data-testid={`button-chat-view-${msg.id}`}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDownload(msg)}
                                className={`p-0.5 rounded hover:opacity-70 transition-opacity`}
                                title="Download"
                                data-testid={`button-chat-download-${msg.id}`}
                              >
                                <Download className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <p className={`text-[9px] mt-1 ${
                        isMine ? "text-primary-foreground/50" : "text-muted-foreground/60"
                      }`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {file && (
            <>
              <Separator />
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">{file.name}</span>
                <button
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-chat-remove-file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}

          <div className="border-t p-2 flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
              data-testid="input-chat-file"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              data-testid="button-chat-attach"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <Input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 h-9 text-sm rounded-full border-muted-foreground/20"
              data-testid="input-chat-message"
            />
            <button
              onClick={handleSend}
              disabled={sending || (!text.trim() && !file)}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all"
              data-testid="button-chat-send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
