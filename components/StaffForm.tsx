import React, { useState } from 'react';
import { Input } from './ui/Input';
import { ParticipantProfile, BrandConfig } from '../types';
import { 
  User, 
  Mail, 
  Phone, 
  Users, 
  Building2, 
  Sparkles, 
  Loader2, 
  Linkedin, 
  BookOpen,
  Zap,
  Bell,
  BellOff,
  MapPin
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface ParticipantFormProps {
  profile: ParticipantProfile;
  brand: BrandConfig;
  onChange: (field: keyof ParticipantProfile | string, value: any) => void;
}

export const ParticipantForm: React.FC<ParticipantFormProps> = ({ profile, brand, onChange }) => {
  const [loading, setLoading] = useState(false);

  const handleMagicSparkle = async () => {
    if (!profile.name || !profile.company) return;
    setLoading(true);
    try {
      const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      if (!apiKey) throw new Error("API key not configured");
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Task: Create a Networking DNA for an event attendee.
      Input: Name: ${profile.name}, Company: ${profile.company}, Role: ${profile.category}.
      Return JSON: { 
        "summary": "Professional bio in 10 words", 
        "icebreaker": "One engaging conversation starter for this person", 
        "target_industries": ["3 industries they might benefit from"] 
      }`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const result = JSON.parse(response.text || '{}');
      onChange('networking_dna', result);
    } catch (e) {
      console.error("AI Sparkle Failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/5 p-6 rounded-3xl border border-white/5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 shadow-lg">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white">CRM Intelligence</h4>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Enrich guest profile with professional data</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            type="button"
            onClick={() => onChange('is_high_priority', !profile.is_high_priority)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              profile.is_high_priority 
                ? 'bg-amber-400 text-slate-950 shadow-xl' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {profile.is_high_priority ? <Bell size={14} className="animate-pulse text-slate-950" /> : <BellOff size={14} />}
            {profile.is_high_priority ? 'VIP Alert Active' : 'Enable VIP Alert'}
          </button>
          <button 
            type="button"
            onClick={handleMagicSparkle}
            disabled={loading || !profile.name || !profile.company}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Enrich
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          id="name"
          label="Full Legal Name *"
          value={profile.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Alex Morgan"
          icon={<User size={16} />}
        />
        <Input
          id="company"
          label="Organization / Company"
          value={profile.company || ''}
          onChange={(e) => onChange('company', e.target.value)}
          placeholder="e.g. Acme Innovations"
          icon={<Building2 size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          id="email"
          label="Email Address"
          type="email"
          value={profile.email || ''}
          onChange={(e) => onChange('email', e.target.value)}
          placeholder="alex@example.com (optional)"
          icon={<Mail size={16} />}
        />
        <Input
          id="phone"
          label="Phone / Mobile"
          value={profile.phone || ''}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="+1..."
          icon={<Phone size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="w-full">
          <label htmlFor="category" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Access Category</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
              <Users size={16} />
            </div>
            <input
              list="access-protocols"
              id="category"
              value={profile.category || 'Delegate'}
              onChange={(e) => onChange('category', e.target.value)}
              placeholder="e.g. Delegate, VIP, Speaker..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-bold transition-all"
            />
            <datalist id="access-protocols">
              <option value="Delegate" />
              <option value="Speaker" />
              <option value="VIP" />
              <option value="Exhibitor" />
              <option value="Press" />
              <option value="Staff" />
              <option value="Sponsor" />
            </datalist>
          </div>
        </div>

        <div>
          <label htmlFor="gender" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gender / Sex</label>
          <select
            id="gender"
            value={(profile as any).gender || ''}
            onChange={(e) => onChange('gender', e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-slate-900 text-white focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-bold transition-all"
          >
            <option value="">Not Specified</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other / Non-Binary</option>
          </select>
        </div>

        <div>
          <Input
            id="location"
            label="Location / Base"
            value={profile.location || ''}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="City / Country"
            icon={<MapPin size={16} />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          id="linkedin"
          label="LinkedIn Profile"
          value={profile.linkedin_url || ''}
          onChange={(e) => onChange('linkedin_url', e.target.value)}
          placeholder="linkedin.com/in/..."
          icon={<Linkedin size={16} />}
        />
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Notes</label>
          <div className="relative">
            <div className="absolute top-3.5 left-4 text-slate-500">
              <BookOpen size={16} />
            </div>
            <textarea 
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[46px] transition-all resize-none"
              placeholder="Important notes for on-site staff..."
              value={profile.bio || ''}
              onChange={(e) => onChange('bio', e.target.value)}
              rows={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
