import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageCircle, ShieldCheck } from "lucide-react";
import { useWeb3 } from "@/lib/web3Provider";
import { useProfiles } from "@/lib/profileProvider";
import { shortAddress } from "@/lib/arcscan";
import { toast } from "sonner";

const SIGN_MESSAGE = "Sign this message to verify your wallet for duude.fun chat.\n\nThis does not cost any gas.";

interface ChatMessage {
  _id?: string;
  senderAddress: string;
  message: string;
  timestamp: string; // ISO string
  tokenAddress?: string;
  // Resolved display fields (client-side)
  displayName?: string;
  avatarUrl?: string;
}

interface ChatBoxProps {
  title?: string;
  /** "token" or "arena" */
  mode: "token" | "arena";
  /** Required for token chat — the token contract address */
  tokenAddress?: string;
}

const ChatBox = ({ title = "LIVE CHAT", mode, tokenAddress }: ChatBoxProps) => {
  const { address: userAddress, isConnected, signer } = useWeb3();
  const { getDisplayName, batchResolve, getProfile } = useProfiles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    try {
      let url: string;
      if (mode === "token" && tokenAddress) {
        url = `/api/chat/token?tokenAddress=${encodeURIComponent(tokenAddress)}&limit=50`;
      } else if (mode === "arena") {
        url = `/api/chat/arena?limit=50`;
      } else {
        return;
      }

      const res = await fetch(url);
      if (!res.ok) {
        console.error("Chat fetch failed:", res.status, await res.text().catch(() => ""));
        return;
      }
      const docs: ChatMessage[] = await res.json();

      // Reverse to get oldest-first for display
      docs.reverse();

      // Batch resolve usernames for all senders
      const addresses = [...new Set(docs.map((d) => d.senderAddress))];
      await batchResolve(addresses);

      setMessages(docs);
    } catch (err) {
      console.error("Chat fetch error:", err);
    } finally {
      setLoadingMsgs(false);
    }
  }, [mode, tokenAddress, batchResolve]);

  // Initial load and polling
  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 8000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const requestSignature = async (): Promise<string | null> => {
    if (!signer) {
      toast.error("Wallet not connected");
      return null;
    }
    setVerifying(true);
    try {
      toast.info("Sign the message to verify your wallet for chat");
      const signature = await signer.signMessage(SIGN_MESSAGE);
      return signature;
    } catch (err: any) {
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        toast.error("Signature rejected — required for first chat message");
      } else {
        toast.error("Failed to sign message");
      }
      return null;
    } finally {
      setVerifying(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !isConnected || !userAddress) {
      if (!isConnected) toast.error("Connect wallet to chat");
      return;
    }
    if (input.trim().length > 500) {
      toast.error("Message too long (max 500 chars)");
      return;
    }

    setSending(true);
    try {
      let url: string;
      let body: Record<string, string>;

      if (mode === "token" && tokenAddress) {
        url = "/api/chat/token";
        body = { tokenAddress, senderAddress: userAddress, message: input.trim() };
      } else if (mode === "arena") {
        url = "/api/chat/arena";
        body = { senderAddress: userAddress, message: input.trim() };
      } else {
        return;
      }

      // First attempt without signature
      let res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // If server says signature required, get signature and retry
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === "SIGNATURE_REQUIRED") {
          const signature = await requestSignature();
          if (!signature) {
            setSending(false);
            return;
          }

          // Retry with signature
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, signature }),
          });
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Send failed" }));
        throw new Error(err.error);
      }

      const doc: ChatMessage = await res.json();
      setMessages((prev) => [...prev, doc]);
      setInput("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diffMin = Math.floor((now - d.getTime()) / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  };

  return (
    <motion.div
      className="card-cartoon flex flex-col"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full mb-2"
      >
        <h3 className="font-display text-sm text-foreground flex items-center gap-2">
          <MessageCircle size={14} className="text-primary" />
          {title}
        </h3>
        <span className="text-xs text-muted-foreground font-body">
          {messages.length} msgs {isOpen ? "▲" : "▼"}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-3 scrollbar-thin scrollbar-thumb-primary/20"
            >
              {loadingMsgs ? (
                <p className="text-xs text-muted-foreground font-body text-center py-4 animate-pulse">
                  Loading chat...
                </p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground font-body text-center py-4">
                  No messages yet. Be the first!
                </p>
              ) : (
                messages.map((msg, i) => {
                  const isMe = userAddress && msg.senderAddress.toLowerCase() === userAddress.toLowerCase();
                  const profile = getProfile(msg.senderAddress);
                  const name = isMe ? "You" : (profile?.displayName || profile?.username || shortAddress(msg.senderAddress));
                  const avatar = profile?.avatarUrl;

                  return (
                    <motion.div
                      key={msg._id || `${msg.senderAddress}-${msg.timestamp}-${i}`}
                      className={`flex gap-2 items-start ${isMe ? "flex-row-reverse" : ""}`}
                      initial={{ opacity: 0, x: isMe ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i < 6 ? i * 0.03 : 0 }}
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span className="text-lg flex-shrink-0">💬</span>
                      )}
                      <div
                        className={`rounded-xl px-3 py-1.5 max-w-[80%] ${
                          isMe
                            ? "bg-primary/20 border border-primary/30"
                            : "bg-muted/50 border border-border/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-display text-primary">{name}</span>
                          <span className="text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
                        </div>
                        <p className="text-xs font-body text-foreground">{msg.message}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sending && !verifying && sendMessage()}
                placeholder={isConnected ? "say something..." : "connect wallet to chat"}
                disabled={!isConnected || sending || verifying}
                className="flex-1 bg-muted/30 border border-border/50 rounded-xl px-3 py-2 text-xs font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!isConnected || sending || verifying || !input.trim()}
                className="btn-arcade px-3 py-2 text-xs disabled:opacity-50"
              >
                {verifying ? <ShieldCheck size={14} className="animate-pulse" /> : <Send size={14} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChatBox;
