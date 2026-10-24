import React, { useState } from 'react';
import { EventTenant } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FormInput, Plus, Trash2, Copy, Check, ExternalLink } from 'lucide-react';

interface FormBuilderProps {
  event: EventTenant;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({ event }) => {
  const [copied, setCopied] = useState(false);
  const registrationLink = `${window.location.origin}${window.location.pathname}?register=${event.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 font-black">
            <FormInput size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black italic text-white">Public Registration Portal</h3>
            <p className="text-slate-400 text-xs">Share this link with attendees for self-registration and instant QR passes</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="truncate w-full sm:w-auto font-mono text-xs text-emerald-400">
            {registrationLink}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              onClick={handleCopyLink}
              size="sm"
              className="bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex-1 sm:flex-initial"
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
            >
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
            <a
              href={registrationLink}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
