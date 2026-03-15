import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExperienceCardProps {
  title: string;
  company: string;
  date: string;
  description: string;
  details?: string;
  highlight?: boolean;
}

const ExperienceCard: React.FC<ExperienceCardProps> = ({ title, company, date, description, details, highlight }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className={`relative isolate z-10 rounded-lg border ${highlight ? 'border-primary shadow-[0_0_20px_rgba(240,126,65,0.25)] p-6 md:p-7' : 'border-primary/30 p-5'} bg-black/80 transition-all duration-200 cursor-pointer ${hovered ? 'z-30' : ''}`}
      whileHover={{ scale: 1.01, boxShadow: highlight ? '0 0 28px rgba(240,126,65,0.3)' : '0 0 12px rgba(240,126,65,0.2)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex flex-col gap-0">
        <h4 className={`font-cyber text-primary leading-tight uppercase tracking-wide ${highlight ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}>{title}</h4>
        <p className="text-gray-500 text-xs font-mono mt-1.5">{company} · {date}</p>
        <p className="text-gray-400 text-sm mt-3 leading-relaxed">{description}</p>
      </div>
      <AnimatePresence>
        {hovered && details && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-3 z-[100] min-w-[280px] max-w-md bg-cyber-black border border-primary/80 text-gray-300 text-sm p-4 rounded-lg shadow-xl pointer-events-none"
            style={{ boxShadow: '0 0 24px rgba(240,126,65,0.15)' }}
          >
            {details}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ExperienceCard; 