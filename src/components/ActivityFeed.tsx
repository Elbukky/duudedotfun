import { motion } from "framer-motion";
import type { Activity } from "@/lib/mockData";

const typeConfig = {
  buy: { icon: '💚', color: 'text-secondary' },
  sell: { icon: '❤️', color: 'text-destructive' },
  holder: { icon: '👤', color: 'text-primary' },
  mission: { icon: '🏆', color: 'text-accent' },
};

const ActivityFeed = ({ activities }: { activities: Activity[] }) => (
  <div className="card-cartoon">
    <h3 className="font-display text-sm text-foreground mb-4">LIVE ACTIVITY</h3>
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {activities.map((a, i) => {
        const cfg = typeConfig[a.type];
        return (
          <motion.div
            key={a.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <span>{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-body truncate ${cfg.color}`}>
                {a.user && <span className="text-muted-foreground">{a.user} </span>}
                {a.message}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap">{a.timestamp}</span>
          </motion.div>
        );
      })}
    </div>
  </div>
);

export default ActivityFeed;
