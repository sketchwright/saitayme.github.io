import React, { useState } from 'react';
import { MdEmail, MdPhone, MdLocationOn, MdContentCopy, MdCheck } from 'react-icons/md';

const contact = {
  city: 'Brno, Czech Republic',
  email: 'julian.strunz@hotmail.com',
  phone: '+43 664 9145420',
};

const iconGlowStyle: React.CSSProperties = {
  filter: 'drop-shadow(0 0 3px rgba(240,126,65,0.4)) drop-shadow(0 0 6px rgba(240,126,65,0.25))',
};

interface ContactPanelProps {
  compact?: boolean;
}

const ContactPanel: React.FC<ContactPanelProps> = ({ compact = false }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (value: string, type: string) => {
    navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 1200);
  };

  const iconSize = compact ? 18 : 22;
  const wrapperClass = compact
    ? 'w-full p-3 rounded-lg border border-primary/25 bg-black/30'
    : 'w-full p-4 rounded-lg border border-primary/50 bg-black/60 relative';
  const gapClass = compact ? 'gap-3' : 'gap-5';
  const textClass = compact ? 'text-gray-100 font-mono text-sm' : 'text-gray-100 font-mono';

  return (
    <div className={wrapperClass} style={compact ? undefined : { boxShadow: '0 0 16px rgba(240,126,65,0.1)' }}>
      <div className={`flex flex-col ${gapClass}`}>
        <div className="flex items-center gap-3">
          <MdLocationOn size={iconSize} className="text-primary shrink-0" style={iconGlowStyle} />
          <span className={textClass}>{contact.city}</span>
        </div>
        <div className="flex items-center gap-3">
          <MdEmail size={iconSize} className="text-primary shrink-0" style={iconGlowStyle} />
          <span className={textClass}>{contact.email}</span>
          <button
            className="ml-2 p-1 rounded bg-cyber-dark border border-primary hover:bg-primary/20 transition"
            onClick={() => handleCopy(contact.email, 'email')}
            aria-label="Copy email"
          >
            {copied === 'email' ? <MdCheck className="text-primary" /> : <MdContentCopy className="text-primary" />}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <MdPhone size={iconSize} className="text-primary shrink-0" style={iconGlowStyle} />
          <span className={textClass}>{contact.phone}</span>
          <button
            className="ml-2 p-1 rounded bg-cyber-dark border border-primary hover:bg-primary/20 transition"
            onClick={() => handleCopy(contact.phone, 'phone')}
            aria-label="Copy phone"
          >
            {copied === 'phone' ? <MdCheck className="text-primary" /> : <MdContentCopy className="text-primary" />}
          </button>
        </div>
      </div>
      {!compact && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'url(/assets/crt-noise.png)', opacity: 0.10, mixBlendMode: 'screen' }} />
      )}
    </div>
  );
};

export default ContactPanel; 