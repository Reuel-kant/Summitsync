import React from 'react';
import { BrandConfig } from '../types';
import { Input } from './ui/Input';
import { Palette, Sparkles, Layout } from 'lucide-react';

interface TagDesignerProps {
  config: BrandConfig;
  onChange: (updates: Partial<BrandConfig>) => void;
}

export const TagDesigner: React.FC<TagDesignerProps> = ({ config, onChange }) => {
  return (
    <section className="bg-slate-900 p-10 rounded-[3rem] border border-white/10 text-white space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black">
          <Palette size={20} />
        </div>
        <div>
          <h3 className="text-2xl font-black italic tracking-tight">Badge & Brand Styling</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Customize credentials and color accents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Display Event Title"
          value={config.eventName || ''}
          onChange={(e) => onChange({ eventName: e.target.value })}
          placeholder="Summit 2026"
        />
        <Input
          label="Tagline / Slogan"
          value={config.slogan || ''}
          onChange={(e) => onChange({ slogan: e.target.value })}
          placeholder="Innovate. Connect. Lead."
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Primary Accent</label>
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
            <input
              type="color"
              value={config.primaryColor || '#10b981'}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
              className="w-8 h-8 rounded-xl bg-transparent cursor-pointer border-0"
            />
            <span className="font-mono text-xs text-slate-300 uppercase">{config.primaryColor}</span>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Secondary Accent</label>
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
            <input
              type="color"
              value={config.secondaryColor || '#0f172a'}
              onChange={(e) => onChange({ secondaryColor: e.target.value })}
              className="w-8 h-8 rounded-xl bg-transparent cursor-pointer border-0"
            />
            <span className="font-mono text-xs text-slate-300 uppercase">{config.secondaryColor}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
