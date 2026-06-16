import { motion } from "framer-motion";
import { Clock, ShieldAlert } from "lucide-react";
import { SiInstagram, SiTiktok, SiX } from "react-icons/si";

export type ThreatSeverity = "High" | "Medium" | "Low";

interface ThreatCardProps {
  platform: "Instagram" | "TikTok" | "X";
  severity: ThreatSeverity;
  type: string;
  username: string;
  timeAgo: string;
  delay?: number;
}

export function ThreatCard({ platform, severity, type, username, timeAgo, delay = 0 }: ThreatCardProps) {
  const getPlatformIcon = () => {
    switch (platform) {
      case "Instagram": return <SiInstagram className="w-4 h-4" />;
      case "TikTok": return <SiTiktok className="w-4 h-4" />;
      case "X": return <SiX className="w-4 h-4" />;
    }
  };

  const getSeverityColors = () => {
    switch (severity) {
      case "High": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "Medium": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "Low": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4 relative overflow-hidden group"
    >
      {/* Subtle background pulse for High severity */}
      {severity === "High" && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[40px] rounded-full group-hover:bg-red-500/20 transition-colors pointer-events-none" />
      )}

      <div className="flex justify-between items-start z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground border border-border">
            {getPlatformIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm sm:text-base">{platform}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getSeverityColors()}`}>
                {severity}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" /> {timeAgo}
            </div>
          </div>
        </div>
      </div>

      <div className="z-10 bg-black/40 rounded-xl p-3 border border-border/50">
        <div className="flex items-start gap-3">
          <ShieldAlert className={`w-5 h-5 mt-0.5 shrink-0 ${severity === "High" ? "text-red-400" : "text-amber-400"}`} />
          <div>
            <p className="text-sm font-medium text-foreground">{type}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Account <span className="font-mono text-red-300/80 bg-red-500/10 px-1 rounded">{username}</span> is using your likeness.
            </p>
          </div>
        </div>
      </div>
      
      <div className="z-10 flex gap-2 mt-1">
        <button className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-medium py-2 rounded-lg transition-colors border border-white/5">
          View Profile
        </button>
        <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium py-2 rounded-lg transition-colors border border-red-500/20">
          Report
        </button>
      </div>
    </motion.div>
  );
}
