import React from 'react';
import { ParticipantProfile, BrandConfig } from '../types';
import { Button } from './ui/Button';
import { Printer, Trash2, X, FileStack, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { buildQRPayload } from '../lib/qrExport';

interface SheetComposerProps {
  selectedGuests: ParticipantProfile[];
  brand: BrandConfig;
  onClear: () => void;
  onRemove: (id: string) => void;
}

export const SheetComposer: React.FC<SheetComposerProps> = ({
  selectedGuests,
  brand,
  onClear,
  onRemove,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950">
            <FileStack size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black italic text-white">Badge Print Queue</h3>
            <p className="text-slate-400 text-xs">
              {selectedGuests.length} badge{selectedGuests.length !== 1 ? 's' : ''} queued for batch printing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedGuests.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              icon={<Trash2 size={14} />}
            >
              Clear Queue
            </Button>
          )}
          <Button
            onClick={handlePrint}
            disabled={selectedGuests.length === 0}
            className="bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider h-11 px-6 rounded-xl"
            icon={<Printer size={15} />}
          >
            Print Sheet ({selectedGuests.length})
          </Button>
        </div>
      </div>

      {selectedGuests.length === 0 ? (
        <div className="bg-slate-900/50 border border-dashed border-white/10 rounded-[2.5rem] p-16 text-center text-slate-600 no-print">
          <p className="text-xs font-black uppercase tracking-widest">Print queue is empty</p>
          <p className="text-[11px] text-slate-600 mt-1">Select attendees in the Guest CRM to queue badges for batch printing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {selectedGuests.map((p) => (
            <div
              key={p.id}
              className="relative bg-white text-slate-900 rounded-3xl p-5 shadow-xl border border-slate-100 flex flex-col justify-between aspect-[3/4]"
            >
              <button
                type="button"
                onClick={() => p.id && onRemove(p.id)}
                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 transition-colors no-print"
              >
                <X size={15} />
              </button>

              <div className="border-b border-slate-100 pb-2">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                  {brand?.eventName || 'Summit Event'}
                </span>
                <span className="block text-[10px] font-black uppercase text-emerald-600">
                  {p.category || 'Delegate'}
                </span>
              </div>

              <div className="my-auto flex justify-center py-2">
                <QRCodeSVG
                  value={buildQRPayload(p)}
                  size={120}
                  level="M"
                />
              </div>

              <div className="border-t border-slate-100 pt-2 text-center">
                <h5 className="font-black text-sm text-slate-900 leading-tight truncate">
                  {p.name}
                </h5>
                <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">
                  {p.company || 'Participant'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
