import React from 'react';
import { ParticipantProfile, BrandConfig, BadgeSize } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, User, Building2, Award } from 'lucide-react';
import { Button } from './ui/Button';
import { downloadSingleQR, buildQRPayload } from '../lib/qrExport';

interface BadgePreviewProps {
  data: ParticipantProfile | null;
  brand: BrandConfig;
  size: BadgeSize;
}

export const BadgePreview: React.FC<BadgePreviewProps> = ({ data, brand, size }) => {
  if (!data) {
    return (
      <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-10 text-center flex flex-col items-center justify-center min-h-[360px] text-slate-500">
        <User size={40} className="text-slate-700 mb-3" />
        <p className="text-xs font-bold uppercase tracking-widest">Select or Register an Attendee</p>
        <p className="text-[11px] text-slate-600 mt-1">Live QR and badge preview will display here</p>
      </div>
    );
  }

  const qrPayload = buildQRPayload(data);
  const primaryColor = brand?.primaryColor || '#10b981';
  const eventName = brand?.eventName || 'Summit Event';

  const handleDownloadQR = async () => {
    try {
      await downloadSingleQR(data, eventName);
    } catch (err: any) {
      alert('QR Download failed: ' + err?.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Visual Badge Card */}
      <div className="relative bg-white text-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 p-6 flex flex-col justify-between aspect-[3/4] max-w-sm mx-auto">
        {/* Top Header */}
        <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {eventName}
            </h5>
            <h3 className="text-lg font-black tracking-tight text-slate-900 italic mt-0.5">
              Verified Entry Pass
            </h3>
          </div>
          <div 
            className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-950 shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {data.category || 'Delegate'}
          </div>
        </div>

        {/* Center QR Code */}
        <div className="my-auto flex flex-col items-center justify-center py-4">
          <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center">
            <QRCodeSVG
              value={qrPayload}
              size={180}
              level="H"
              marginSize={1}
            />
          </div>
          <p className="text-[9px] font-mono font-bold text-slate-400 mt-2 tracking-widest">
            SCAN AT TERMINAL
          </p>
        </div>

        {/* Bottom Details */}
        <div className="pt-4 border-t border-slate-100 space-y-1">
          <h4 className="text-xl font-black text-slate-900 leading-tight">
            {data.name || 'Anonymous Guest'}
          </h4>
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400 shrink-0" />
            {data.company || 'Private Participant'}
          </p>
          {data.email && (
            <p className="text-[10px] text-slate-400 truncate">
              {data.email}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        <Button
          onClick={handleDownloadQR}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider h-12 rounded-xl"
          icon={<Download size={15} />}
        >
          Download QR
        </Button>
        <Button
          variant="outline"
          onClick={handlePrint}
          className="text-xs font-bold uppercase tracking-wider h-12 rounded-xl"
          icon={<Printer size={15} />}
        >
          Print Badge
        </Button>
      </div>
    </div>
  );
};
