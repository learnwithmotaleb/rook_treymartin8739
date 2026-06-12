import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";

export function AnimatedRing({ score = 72 }: { score?: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    const duration = 2000; // 2 seconds

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      
      // Easing function (easeOutQuart)
      const ease = 1 - Math.pow(1 - progress, 4);
      
      setDisplayScore(Math.floor(ease * score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  const radius = 120;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      {/* Background glow */}
      <div className="absolute inset-0 rounded-full bg-primary/20 blur-[60px] opacity-60"></div>
      
      <svg
        height={radius * 2}
        width={radius * 2}
        className="transform -rotate-90 relative z-10"
      >
        {/* Track */}
        <circle
          stroke="rgba(255,255,255,0.05)"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress */}
        <motion.circle
          stroke="url(#blue-gradient)"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference + ' ' + circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 2, ease: "easeOut" }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
        />
        <defs>
          <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute flex flex-col items-center justify-center z-20">
        <motion.span 
          className="text-5xl font-bold text-white tracking-tighter"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {displayScore}
        </motion.span>
        <span className="text-sm text-muted-foreground font-medium uppercase tracking-widest mt-1">
          Score
        </span>
      </div>
    </div>
  );
}
