import React, { useState, useEffect, useRef } from 'react';
import { AttendanceRecord, AppConfig } from '../types';
import { 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Volume2, 
  VolumeX, 
  RefreshCw,
  QrCode,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { Button } from './ui/Button';

interface AttendanceScannerProps {
  eventId: string;
  config: AppConfig;
  onScanSuccess: (log: AttendanceRecord) => Promise<void> | void;
}

// Sound effects using Web Audio API (zero external asset dependency)
const playSound = (type: 'success' | 'warning' | 'error') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.setValueAtTime(329.63, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    // Ignore audio permission/context errors
  }
};

export const AttendanceScanner: React.FC<AttendanceScannerProps> = ({
  eventId,
  config,
  onScanSuccess,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [lastScanned, setLastScanned] = useState<{ name: string; time: string; status: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerDivId = 'summit-qr-reader';

  // Parse QR content (either structured JSON payload or plaintext identifier)
  const handleDecodedString = async (decodedText: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      let attendeeData: Partial<AttendanceRecord> = {};

      try {
        const parsed = JSON.parse(decodedText);
        if (typeof parsed === 'object' && parsed !== null) {
          attendeeData = {
            participant_id: parsed.id || parsed.participant_id || '',
            name: parsed.name || 'Attendee',
            email: parsed.email || '',
            company: parsed.company || '',
            category: parsed.category || parsed.cat || 'Delegate',
            gender: parsed.gender || '',
            location: parsed.location || '',
          };
        }
      } catch {
        // Plain text fallback (could be ID or raw name)
        attendeeData = {
          participant_id: decodedText.length > 20 ? decodedText : '',
          name: decodedText.length <= 20 ? decodedText : 'Attendee',
          category: 'Delegate',
        };
      }

      if (!attendeeData.name) attendeeData.name = 'Attendee';

      const record: AttendanceRecord = {
        event_id: eventId,
        participant_id: attendeeData.participant_id || '',
        name: attendeeData.name,
        email: attendeeData.email || '',
        company: attendeeData.company || '',
        category: attendeeData.category || 'Delegate',
        gender: attendeeData.gender || '',
        location: attendeeData.location || '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toISOString().split('T')[0],
        geo: 'On-Site Terminal',
        terminal_id: config.terminalName || 'Main Gate',
        synced: true,
      };

      if (soundEnabled) playSound('success');

      setLastScanned({
        name: record.name,
        time: record.timestamp,
        status: 'Recorded',
      });

      await onScanSuccess(record);
    } catch (err: any) {
      if (soundEnabled) playSound('error');
      setErrorMessage(err?.message || 'Verification failed');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setTimeout(() => setProcessing(false), 1200);
    }
  };

  const startScanner = async () => {
    const Html5QrcodeScanner = (window as any).Html5QrcodeScanner;
    if (!Html5QrcodeScanner) {
      setErrorMessage('Camera scanner library not loaded. Please use manual entry.');
      return;
    }

    try {
      setCameraActive(true);
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          scannerDivId,
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            rememberLastUsedCamera: true,
            aspectRatio: 1.0,
          },
          false
        );

        scanner.render(
          (decodedText: string) => {
            handleDecodedString(decodedText);
          },
          (err: any) => {
            // Scanner frame errors (standard for unaligned camera frames)
          }
        );
        scannerRef.current = scanner;
      }, 100);
    } catch (err: any) {
      setCameraActive(false);
      setErrorMessage('Could not initialize camera: ' + (err?.message || 'Permission denied'));
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (e) {
        // Ignored
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    handleDecodedString(manualQuery.trim());
    setManualQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Scanner Screen Box */}
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-6 border-b border-white/5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <QrCode size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Live Scanner</h4>
              <p className="text-[10px] text-slate-500 font-semibold">{config.terminalName || 'Check-In Terminal'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border transition-colors ${
                soundEnabled 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
              title={soundEnabled ? 'Audio Chime Enabled' : 'Muted'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <Button
              variant={cameraActive ? 'danger' : 'primary'}
              size="sm"
              onClick={cameraActive ? stopScanner : startScanner}
              icon={cameraActive ? <CameraOff size={15} /> : <Camera size={15} />}
              className="rounded-xl text-xs uppercase tracking-wider font-bold"
            >
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </Button>
          </div>
        </div>

        {/* Video Scanner Container */}
        {cameraActive ? (
          <div className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 p-2 min-h-[300px]">
            <div id={scannerDivId} className="w-full scanner-video-container" />
            {processing && (
              <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs flex items-center justify-center z-20">
                <div className="bg-slate-950 px-6 py-3 rounded-2xl border border-emerald-500/40 text-emerald-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={16} className="animate-spin" /> Verifying Pass...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-14 px-6 border-2 border-dashed border-white/10 rounded-2xl text-center flex flex-col items-center justify-center bg-white/[0.02]">
            <Camera size={44} className="text-slate-600 mb-3" />
            <h5 className="text-sm font-bold text-slate-300">Camera Scanner Idle</h5>
            <p className="text-xs text-slate-500 max-w-xs mt-1 mb-6">
              Activate camera to scan physical badges, mobile screens, or printed QR codes.
            </p>
            <Button
              onClick={startScanner}
              className="bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg"
              icon={<Camera size={16} />}
            >
              Enable Camera Scanner
            </Button>
          </div>
        )}

        {/* Last Scanned Feedback Banner */}
        {lastScanned && (
          <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Checked In Successfully</p>
                <h5 className="text-sm font-black text-white italic">{lastScanned.name}</h5>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-lg">
              {lastScanned.time}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Manual Input Fallback */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Manual check-in: type attendee name, email, or barcode ID..."
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <Button
              type="submit"
              disabled={!manualQuery.trim()}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-5 rounded-xl border border-white/10"
              icon={<UserCheck size={15} />}
            >
              Verify
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
