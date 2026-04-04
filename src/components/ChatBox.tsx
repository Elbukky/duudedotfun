import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle } from "lucide-react";

interface ChatMessage {
  id: string;
  user: string;
  avatar: string;
  message: string;
  timestamp: string;
}

const randomAvatars = ["🐸", "🦊", "🐶", "🦍", "🤖", "👽", "🎃", "🐉", "👑", "🧙"];
const randomUsers = ["0xd3g3...n420", "0xm00n...beef", "0xape...lord", "0xfr0g...king", "0xwhal...3000", "0xpap3...hand"];

const generateMockMessages = (context: string): ChatMessage[] => [
  { id: "1", user: "0xd3g3...n420", avatar: "🐸", message: `this ${context} is gonna moon fr fr 🚀`, timestamp: "2m ago" },
  { id: "2", user: "0xm00n...beef", avatar: "🦊", message: "LFG!! just aped in hard 💪", timestamp: "3m ago" },
  { id: "3", user: "0xape...lord", avatar: "🦍", message: "who else is holding? diamond hands only 💎", timestamp: "5m ago" },
  { id: "4", user: "0xfr0g...king", avatar: "🐸", message: "the chart looks bullish af ngl", timestamp: "7m ago" },
  { id: "5", user: "0xwhal...3000", avatar: "🐉", message: "just bought another bag 🐋", timestamp: "8m ago" },
  { id: "6", user: "0xpap3...hand", avatar: "👽", message: "when dex listing? 👀", timestamp: "10m ago" },
];

const ChatBox = ({ title = "💬 LIVE CHAT", context = "token" }: { title?: string; context?: string }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => generateMockMessages(context));
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      user: "You",
      avatar: "😎",
      message: input,
      timestamp: "now",
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");

    // Simulate a reply
    setTimeout(() => {
      const replies = [
        "based 🔥", "wagmi", "nice entry!", "LFG 🚀", "to the moon!", "ape in! 🦍",
        "ser this is a wendy's", "bullish af", "diamond hands 💎", "gm gm ☀️",
      ];
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          user: randomUsers[Math.floor(Math.random() * randomUsers.length)],
          avatar: randomAvatars[Math.floor(Math.random() * randomAvatars.length)],
          message: replies[Math.floor(Math.random() * replies.length)],
          timestamp: "now",
        },
      ]);
    }, 1500 + Math.random() * 2000);
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
          {messages.length} msgs · {isOpen ? "▲" : "▼"}
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
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  className={`flex gap-2 items-start ${msg.user === "You" ? "flex-row-reverse" : ""}`}
                  initial={{ opacity: 0, x: msg.user === "You" ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i < 6 ? i * 0.05 : 0 }}
                >
                  <span className="text-lg flex-shrink-0">{msg.avatar}</span>
                  <div
                    className={`rounded-xl px-3 py-1.5 max-w-[80%] ${
                      msg.user === "You"
                        ? "bg-primary/20 border border-primary/30"
                        : "bg-muted/50 border border-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-display text-primary">{msg.user}</span>
                      <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                    </div>
                    <p className="text-xs font-body text-foreground">{msg.message}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="say something degen..."
                className="flex-1 bg-muted/30 border border-border/50 rounded-xl px-3 py-2 text-xs font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={sendMessage}
                className="btn-arcade px-3 py-2 text-xs"
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChatBox;
