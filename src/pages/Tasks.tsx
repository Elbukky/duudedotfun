import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Rocket,
  ArrowRightLeft,
  Twitter,
  MessageSquare,
  CheckCircle2,
  Circle,
  Loader2,
  Gift,
  ExternalLink,
} from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Navbar from "@/components/Navbar";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const API_BASE = "/api";

interface TaskState {
  completed: boolean;
  completedAt: string | null;
  tweetId?: string | null;
}

interface TaskDoc {
  address: string;
  tasks: {
    launch_token: TaskState;
    trade_5: TaskState;
    follow_twitter: TaskState;
    tweet: TaskState;
  };
  claimed: boolean;
  claimedAt: string | null;
}

const TASKS = [
  {
    id: "launch_token" as const,
    title: "Launch a Token",
    description: "Create and launch your own meme coin on duude.fun",
    icon: Rocket,
    reward: 25,
    action: "Verify",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
  },
  {
    id: "trade_5" as const,
    title: "Trade 5 Times",
    description: "Buy or sell tokens at least 5 times on any bonding curve",
    icon: ArrowRightLeft,
    reward: 25,
    action: "Verify",
    color: "text-accent",
    bgColor: "bg-accent/10",
    borderColor: "border-accent/30",
  },
  {
    id: "follow_twitter" as const,
    title: "Follow on Twitter",
    description: "Follow @Duudedotfun on Twitter / X",
    icon: Twitter,
    reward: 25,
    action: "Follow",
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    borderColor: "border-secondary/30",
    link: "https://x.com/Duudedotfun",
  },
  {
    id: "tweet" as const,
    title: "Tweet About Us",
    description: "Post a tweet mentioning duude.fun — paste the link below",
    icon: MessageSquare,
    reward: 25,
    action: "Submit",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    needsInput: true,
  },
] as const;

const Tasks = () => {
  const { address, isConnected } = useAccount();
  const [taskDoc, setTaskDoc] = useState<TaskDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [tweetUrl, setTweetUrl] = useState("");

  // Fetch task progress
  const fetchTasks = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tasks?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        // API returns the doc directly on GET, or nested in { doc } on POST
        setTaskDoc(data.doc || data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Verify / complete a task
  const verifyTask = async (taskId: string, payload?: Record<string, string>) => {
    if (!address) return;
    setVerifying(taskId);
    try {
      const body: Record<string, unknown> = { address, task: taskId };
      if (payload) body.payload = payload;

      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Verification failed");
        return;
      }

      if (data.already) {
        toast.info("Already completed!");
      } else {
        toast.success("Task completed!");
      }
      setTaskDoc(data.doc);
      if (taskId === "tweet") setTweetUrl("");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setVerifying(null);
    }
  };

  // Handle follow twitter — open link then mark complete
  const handleFollow = async () => {
    window.open("https://x.com/Duudedotfun", "_blank");
    // Small delay so the window opens first
    await new Promise((r) => setTimeout(r, 500));
    await verifyTask("follow_twitter");
  };

  // Claim reward
  const handleClaim = async () => {
    if (!address) return;
    setClaiming(true);
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, action: "claim" }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Claim failed");
        return;
      }

      toast.success("Reward claimed! 100 USDC will be sent to your wallet.");
      setTaskDoc(data.doc);
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setClaiming(false);
    }
  };

  const completedCount = taskDoc
    ? TASKS.filter((t) => taskDoc.tasks[t.id]?.completed).length
    : 0;
  const allDone = completedCount === TASKS.length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-24 pb-16 px-4">
        <div className="container max-w-3xl">
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="badge-sticker bg-accent/20 text-accent border-accent/40 mb-4 inline-block">
              <Gift size={12} className="inline mr-1" /> EARN REWARDS
            </span>
            <h1 className="text-3xl md:text-5xl font-display mb-3">
              <span
                className="inline-block animate-gradient-shift"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(var(--neon-purple)), hsl(var(--slime-green)), hsl(var(--gold)), hsl(var(--neon-purple)))",
                  backgroundSize: "300% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                COMPLETE TASKS
              </span>
            </h1>
            <p className="text-muted-foreground font-body text-lg">
              Earn <span className="text-primary font-display">100 USDC</span> by completing all 4 tasks
            </p>

            {/* Progress bar */}
            <div className="mt-6 max-w-md mx-auto">
              <div className="flex justify-between text-xs font-body text-muted-foreground mb-2">
                <span>{completedCount}/{TASKS.length} completed</span>
                <span>{completedCount * 25} / 100 USDC</span>
              </div>
              <div className="progress-arcade h-3">
                <motion.div
                  className="progress-arcade-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / TASKS.length) * 100}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Connect wallet prompt */}
          {!isConnected && (
            <motion.div
              className="card-cartoon text-center py-12 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-muted-foreground font-body mb-4">
                Connect your wallet to start completing tasks
              </p>
              <ConnectButton />
            </motion.div>
          )}

          {/* Loading */}
          {isConnected && loading && !taskDoc && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Task cards */}
          {isConnected && (taskDoc || !loading) && (
            <div className="space-y-4">
              {TASKS.map((task, i) => {
                const completed = taskDoc?.tasks[task.id]?.completed ?? false;
                const isVerifying = verifying === task.id;
                const Icon = task.icon;

                return (
                  <motion.div
                    key={task.id}
                    className={`card-cartoon flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                      completed ? "opacity-80" : ""
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-xl ${task.bgColor} border ${task.borderColor} flex items-center justify-center shrink-0`}
                    >
                      <Icon size={22} className={task.color} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display text-sm text-foreground">{task.title}</h3>
                        <span className="badge-sticker text-[10px] bg-primary/10 text-primary border-primary/30">
                          +{task.reward} USDC
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-body">{task.description}</p>

                      {/* Tweet URL input */}
                      {task.id === "tweet" && !completed && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={tweetUrl}
                            onChange={(e) => setTweetUrl(e.target.value)}
                            placeholder="https://x.com/you/status/..."
                            className="flex-1 px-3 py-1.5 text-xs font-body rounded-lg bg-muted border border-primary/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                          />
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="shrink-0 self-center">
                      {completed ? (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <CheckCircle2 size={18} />
                          <span className="text-xs font-display">DONE</span>
                        </div>
                      ) : (
                        <motion.button
                          className={`btn-arcade text-xs px-5 py-2 ${task.bgColor} ${task.color} border ${task.borderColor}`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          disabled={isVerifying || (task.id === "tweet" && !tweetUrl.trim())}
                          onClick={() => {
                            if (task.id === "follow_twitter") {
                              handleFollow();
                            } else if (task.id === "tweet") {
                              verifyTask("tweet", { tweetUrl: tweetUrl.trim() });
                            } else {
                              verifyTask(task.id);
                            }
                          }}
                        >
                          {isVerifying ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : task.id === "follow_twitter" ? (
                            <span className="flex items-center gap-1">
                              Follow <ExternalLink size={12} />
                            </span>
                          ) : (
                            task.action
                          )}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Claim section */}
          {isConnected && taskDoc && (
            <motion.div
              className="mt-10 card-cartoon text-center py-8 glow-purple"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {taskDoc.claimed ? (
                <>
                  <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
                  <h3 className="font-display text-lg text-foreground mb-1">REWARD CLAIMED</h3>
                  <p className="text-xs text-muted-foreground font-body">
                    100 USDC has been recorded. It will be sent to your wallet.
                  </p>
                </>
              ) : allDone ? (
                <>
                  <Gift size={40} className="text-accent mx-auto mb-3" />
                  <h3 className="font-display text-lg text-foreground mb-2">ALL TASKS COMPLETE!</h3>
                  <p className="text-sm text-muted-foreground font-body mb-4">
                    Claim your 100 USDC reward
                  </p>
                  <motion.button
                    className="btn-arcade bg-primary text-primary-foreground border-primary px-8 py-3 text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClaim}
                    disabled={claiming}
                  >
                    {claiming ? (
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                    ) : null}
                    CLAIM 100 USDC
                  </motion.button>
                </>
              ) : (
                <>
                  <Circle size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="font-display text-lg text-foreground mb-1">
                    {completedCount > 0 ? "KEEP GOING!" : "GET STARTED"}
                  </h3>
                  <p className="text-sm text-muted-foreground font-body">
                    Complete all {TASKS.length} tasks to claim your{" "}
                    <span className="text-primary">100 USDC</span> reward
                  </p>
                  {completedCount === 0 && (
                    <Link to="/launch">
                      <motion.button
                        className="mt-4 btn-arcade bg-primary/10 text-primary border-primary/30 px-6 py-2 text-xs"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Rocket size={14} className="inline mr-1" /> Start by launching a token
                      </motion.button>
                    </Link>
                  )}
                </>
              )}
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Tasks;
