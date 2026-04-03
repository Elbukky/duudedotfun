import { motion } from "framer-motion";

type Status = 'fighting' | 'mooning' | 'new' | 'hot' | 'graduated';

const config: Record<Status, { label: string; colors: string }> = {
  mooning: { label: '🚀 MOONING', colors: 'bg-secondary/20 text-secondary border-secondary/40' },
  hot: { label: '🔥 HOT', colors: 'bg-destructive/20 text-destructive border-destructive/40' },
  fighting: { label: '⚔️ FIGHTING', colors: 'bg-primary/20 text-primary border-primary/40' },
  new: { label: '✨ NEW', colors: 'bg-accent/20 text-accent border-accent/40' },
  graduated: { label: '👑 GRADUATED', colors: 'bg-neon-gold/20 text-accent border-accent/40' },
};

const StatusBadge = ({ status }: { status: Status }) => {
  const { label, colors } = config[status];
  return (
    <motion.span
      className={`badge-sticker text-[10px] ${colors}`}
      animate={status === 'mooning' ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1.5 }}
    >
      {label}
    </motion.span>
  );
};

export default StatusBadge;
