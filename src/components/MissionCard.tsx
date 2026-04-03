import { motion } from "framer-motion";
import type { Mission } from "@/lib/mockData";

const MissionCard = ({ mission, index = 0 }: { mission: Mission; index?: number }) => {
  const pct = Math.min((mission.progress / mission.target) * 100, 100);

  return (
    <motion.div
      className={`card-cartoon ${mission.completed ? "border-secondary/50" : ""}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{mission.icon}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-xs text-foreground">{mission.title}</h4>
            {mission.completed && (
              <motion.span
                className="badge-sticker text-[10px] bg-secondary/20 text-secondary border-secondary/40"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
              >
                ✅ DONE
              </motion.span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-body mt-1">{mission.description}</p>
          <div className="mt-2">
            <div className="progress-arcade h-3">
              <motion.div
                className="progress-arcade-fill"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: index * 0.15 }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground font-body">
                {mission.progress.toLocaleString()} / {mission.target.toLocaleString()}
              </span>
              <span className="text-[10px] text-accent font-body">{mission.reward}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MissionCard;
