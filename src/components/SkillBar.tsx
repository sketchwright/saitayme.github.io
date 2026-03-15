import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface SkillBarProps {
  name: string;
  level: number; // 0-100
  description?: string;
  compact?: boolean;
}

const SkillBar: React.FC<SkillBarProps> = ({ name, level, description, compact }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div className={`relative ${compact ? 'mb-2' : 'mb-6'}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className={`font-cyber ${compact ? 'text-xs text-primary/90' : 'text-base text-primary'}`}>{name}</span>
        <span className="text-primary/60 font-mono text-[10px]">{level}%</span>
      </div>
      <motion.div
        className={`w-full bg-cyber-dark rounded-full overflow-hidden border border-primary/10 ${compact ? 'h-1' : 'h-3'}`}
        initial={{ backgroundColor: '#18181b' }}
        whileHover={{ boxShadow: '0 0 16px #f07e41, 0 0 32px #f07e41' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <motion.div
          className={`h-full ${compact ? 'bg-primary/80' : 'bg-primary'}`}
          style={compact ? undefined : { boxShadow: '0 0 12px #f07e41, 0 0 24px #f07e41' }}
          initial={{ width: 0 }}
          animate={{ width: `${level}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </motion.div>
      {description && hovered && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="absolute left-0 top-full mt-1 z-50 bg-cyber-black border border-primary/50 text-gray-300 text-xs p-2 rounded shadow-lg w-max max-w-xs pointer-events-none"
        >
          {description}
        </motion.div>
      )}
    </div>
  );
};

export default SkillBar; 