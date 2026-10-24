import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Mail, Check, ShieldCheck } from 'lucide-react';

interface CommSettingsProps {
  ownerId: string;
}

export const CommSettings: React.FC<CommSettingsProps> = ({ ownerId }) => {
  const [senderName, setSenderName] = useState('Summit Operations');
  const [senderEmail, setSenderEmail] = useState('noreply@summitsync.io');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Sender Display Name"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="Summit Operations"
        />
        <Input
          label="Sender Email Address"
          type="email"
          value={senderEmail}
          onChange={(e) => setSenderEmail(e.target.value)}
          placeholder="noreply@domain.com"
          icon={<Mail size={16} />}
        />
      </div>

      <Button
        type="submit"
        className="bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl h-11 px-6"
        icon={<Check size={15} />}
      >
        {saved ? 'Settings Saved' : 'Save Email Dispatch Settings'}
      </Button>
    </form>
  );
};
