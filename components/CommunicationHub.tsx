import React, { useState } from 'react';
import { EventTenant, ParticipantProfile, EventSession } from '../types';
import { Button } from './ui/Button';
import { Mail, Send, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface CommunicationHubProps {
  event: EventTenant;
  participants: ParticipantProfile[];
  sessions: EventSession[];
  ownerId: string;
}

export const CommunicationHub: React.FC<CommunicationHubProps> = ({
  event,
  participants,
  sessions,
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const targetList = participants.filter(p => {
    if (!p.email) return false;
    if (filter === 'all') return true;
    return p.category === filter;
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || targetList.length === 0) return;
    setSending(true);
    setStatus(null);

    // Simulate dispatch with timeout
    setTimeout(() => {
      setSending(false);
      setStatus(`Notification broadcasted to ${targetList.length} verified attendees!`);
      setSubject('');
      setMessage('');
      setTimeout(() => setStatus(null), 5000);
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 font-black">
            <Mail size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black italic text-white">Broadcast Comms Center</h3>
            <p className="text-slate-400 text-xs">Dispatch schedules and event updates to attendees with valid emails</p>
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Recipient Segment</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Attendees ({participants.filter(p => p.email).length} with email)</option>
                <option value="VIP">VIPs Only</option>
                <option value="Speaker">Speakers Only</option>
                <option value="Delegate">Delegates Only</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Important Announcement: Event Schedule"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Message Body</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your announcement or reminder here..."
              rows={5}
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
              required
            />
          </div>

          {status && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{status}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={sending || targetList.length === 0}
            className="w-full h-14 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest"
            icon={sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          >
            {sending ? 'Dispatching Message...' : `Send Broadcast (${targetList.length} Recipients)`}
          </Button>
        </form>
      </div>
    </div>
  );
};
