import React, { useState } from 'react';
import { EventTenant, EventSession } from '../types';
import { supabase } from '../lib/supabase';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Calendar, Plus, Trash2, Clock, MapPin, User, Loader2 } from 'lucide-react';

interface SessionManagerProps {
  event: EventTenant;
  sessions: EventSession[];
  onRefresh: () => Promise<void> | void;
}

export const SessionManager: React.FC<SessionManagerProps> = ({ event, sessions, onRefresh }) => {
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await supabase.from('sessions').insert({
        event_id: event.id,
        title: title.trim(),
        speaker: speaker.trim(),
        location: location.trim(),
        starts_at: startsAt || new Date().toISOString(),
      });
      setTitle('');
      setSpeaker('');
      setLocation('');
      setStartsAt('');
      await onRefresh();
    } catch (e: any) {
      alert('Failed to create session: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this track session?')) return;
    try {
      await supabase.from('sessions').delete().eq('id', id);
      await onRefresh();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-300">
      {/* Create Session Form */}
      <div className="lg:col-span-5 bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 font-black">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black italic text-white">Program Sessions</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Add track & verification points</p>
          </div>
        </div>

        <form onSubmit={handleCreateSession} className="space-y-4">
          <Input
            label="Session Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Keynote: Future of AI"
            required
          />
          <Input
            label="Key Speaker / Host"
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            placeholder="e.g. Dr. Jane Doe"
            icon={<User size={15} />}
          />
          <Input
            label="Stage / Hall Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Main Auditorium"
            icon={<MapPin size={15} />}
          />
          <Input
            label="Start Time"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            icon={<Clock size={15} />}
          />
          <Button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full h-14 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest"
            icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          >
            {saving ? 'Creating Session...' : 'Add Program Track'}
          </Button>
        </form>
      </div>

      {/* Session Roster List */}
      <div className="lg:col-span-7 bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">
          Active Event Tracks ({sessions.length})
        </h4>

        {sessions.length === 0 ? (
          <div className="text-center py-16 text-slate-600 text-xs font-bold uppercase tracking-widest">
            No sessions configured. All check-ins will register under General Entry.
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <div className="space-y-1">
                  <h5 className="font-bold text-white text-sm">{s.title}</h5>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    {s.speaker && <span className="flex items-center gap-1"><User size={13} /> {s.speaker}</span>}
                    {s.location && <span className="flex items-center gap-1"><MapPin size={13} /> {s.location}</span>}
                    {s.starts_at && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Clock size={13} /> {new Date(s.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSession(s.id)}
                  className="p-2.5 text-slate-500 hover:text-red-400 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
