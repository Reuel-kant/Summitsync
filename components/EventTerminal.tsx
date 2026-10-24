
import React, { useState, useEffect, useMemo } from 'react';
import { 
  EventTenant, 
  ParticipantProfile, 
  AttendanceRecord, 
  BrandConfig, 
  BadgeSize, 
  UserRole,
  EventSession
} from '../types';
import { 
  ArrowLeft, 
  ScanLine, 
  ChevronRight,
  History,
  UserPlus,
  CheckCircle2,
  Users,
  Settings,
  Zap,
  Check,
  Link as LinkIcon,
  Activity,
  Search,
  FileStack,
  Square,
  CheckSquare,
  Monitor,
  Clock,
  AlertCircle,
  LayoutGrid,
  Save,
  Loader2,
  ShieldX,
  PieChart,
  CalendarDays,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Award,
  Package,
  Bell,
  X,
  Download,
  Printer,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Mail,
  FileArchive,
  QrCode
} from 'lucide-react';
import { ParticipantForm } from './StaffForm';
import { BadgePreview } from './BadgePreview';
import { AttendanceScanner } from './AttendanceScanner';
import { TagDesigner } from './TagDesigner';
import { SmartUpload } from './SmartUpload';
import { SheetComposer } from './SheetComposer';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { SessionManager } from './SessionManager';
import { FormBuilder } from './FormBuilder';
import { CommunicationHub } from './CommunicationHub';
import { CommSettings } from './CommSettings';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { downloadSingleQR, downloadBulkQRZip, BulkProgress } from '../lib/qrExport';

interface EventTerminalProps {
  event: EventTenant;
  onBack: () => void;
  onUpdateBrand: (brand: BrandConfig) => void;
  onUpdateEvent: (updates: Partial<EventTenant>) => void;
}

export const EventTerminal: React.FC<EventTerminalProps> = ({ event, onBack, onUpdateBrand, onUpdateEvent }) => {
  const role = event.activeRole || 'Lead';
  const isScannerOnly = role === 'Scanner';
  const getDefaultTab = () => (isScannerOnly ? 'checkin' : 'dashboard');

  const [tab, setTab] = useState<'dashboard' | 'guests' | 'checkin' | 'program' | 'logs' | 'settings' | 'composer' | 'registration' | 'comms'>(getDefaultTab());
  const [profiles, setProfiles] = useState<ParticipantProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ParticipantProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [vipAlert, setVipAlert] = useState<ParticipantProfile | null>(null);
  
  const [badgeSize, setBadgeSize] = useState<BadgeSize>('standard-id');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isCloudActive, setIsCloudActive] = useState(false);
  const [logSearch,   setLogSearch]   = useState('');
  const [activeLogDay,setActiveLogDay] = useState<string>('all');
  const [logSortBy,    setLogSortBy]    = useState<'time'|'name'|'company'|'category'|'gender'|'location'>('time');
  const [logSortDir,   setLogSortDir]   = useState<'asc'|'desc'>('asc');
  const [logGroupBy,   setLogGroupBy]   = useState<'none'|'category'|'gender'|'company'>('none');
  const [logFilterCat, setLogFilterCat] = useState<string>('all');
  const [logFilterGender,setLogFilterGender] = useState<string>('all');
  const [logFilterSession,setLogFilterSession] = useState<string>('all');
  const [printQueue, setPrintQueue] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [savingIndividual, setSavingIndividual] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [zipProgress, setZipProgress] = useState<BulkProgress | null>(null);

  // Local scan log — populated on every successful scan so scanner-only
  // nodes can see what they've scanned without needing full log access.
  const [localScanLog, setLocalScanLog] = useState<{
    name: string; company: string; category: string;
    time: string; sessionName: string | null; alreadyIn: boolean;
  }[]>([]);
  
  const terminalKey = useMemo(() => event.id, [event.id]);

  const fetchParticipants = async () => {
    if (isScannerOnly) return;
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false });
    
    if (!error) {
      setProfiles((data || []).map(p => ({
        ...p,
        category: p.custom_data?.custom_category || p.category,
        is_high_priority: p.custom_data?.is_high_priority || false,
        assets_collected: p.custom_data?.assets_collected || [],
        customData: p.custom_data,
        networking_dna: p.networking_dna
      })));
    }
  };

  const fetchLogs = async () => {
    if (isScannerOnly) return;
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, participants(company, category, custom_data, location, gender)')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });
      
    if (!error) {
      setAttendance((data || []).map(l => {
        const p = l.participants || {};
        const cd = p.custom_data || {};
        return {
          ...l,
          name: l.guest_name,
          email: l.guest_email,
          company: p.company || '',
          category: cd.custom_category || p.category || 'Delegate',
          gender: p.gender || cd.gender || '',
          location: p.location || '',
          timestamp: new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(l.created_at).toLocaleDateString(),
          synced: true
        };
      }));
    }
  };

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('event_id', event.id)
      .order('starts_at', { ascending: true });
    
    if (!error) setSessions(data || []);
  };

  useEffect(() => {
    fetchParticipants();
    fetchLogs();
    fetchSessions();

    const channel = supabase
      .channel(`event_realtime:${event.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'attendance_logs', 
        filter: `event_id=eq.${event.id}` 
      }, (payload) => {
        if (!isScannerOnly) {
           fetchLogs();
           fetchParticipants();
           
           // VIP ALERT LOGIC
           const newLog = payload.new;
           if (newLog.participant_id) {
             supabase.from('participants').select('*').eq('id', newLog.participant_id).single().then(({ data: p }) => {
               if (p && (p.category === 'VIP' || p.custom_data?.custom_category === 'VIP' || p.custom_data?.is_high_priority)) {
                 setVipAlert({ name: newLog.guest_name, company: p.company, category: p.custom_data?.custom_category || p.category } as any);
                 setTimeout(() => setVipAlert(null), 8000);
               }
             });
           }
        }
      })
      .subscribe((status) => {
        setIsCloudActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  const handleProfileChange = (field: keyof ParticipantProfile | string, value: any) => {
    setSelectedProfile(prev => {
      const base = prev || { 
        event_id: event.id, 
        name: '', 
        email: '', 
        phone: '', 
        category: 'Delegate', 
        location: '', 
        customData: {} 
      };
      return { ...base, [field]: value };
    });
  };

  const toggleAssetCollection = async (profile: ParticipantProfile, asset: string) => {
    const current = profile.assets_collected || [];
    const updated = current.includes(asset) ? current.filter(a => a !== asset) : [...current, asset];
    
    const customData = {
      ...(profile.customData || {}),
      assets_collected: updated
    };

    const { error } = await supabase
      .from('participants')
      .update({ custom_data: customData })
      .eq('id', profile.id);
    
    if (!error) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, assets_collected: updated, customData } : p));
      if (selectedProfile?.id === profile.id) {
        setSelectedProfile({ ...selectedProfile, assets_collected: updated, customData });
      }
    }
  };

  const saveIndividualGuest = async () => {
    if (!selectedProfile || !selectedProfile.name) return;
    setSavingIndividual(true);
    const p = selectedProfile;
    
    const validCategories = ['Delegate', 'Speaker', 'VIP', 'Press', 'Exhibitor'];
    const dbCategory = validCategories.includes(p.category) ? p.category : 'Delegate';
    const customData = {
      ...(p.customData || {}),
      ...(validCategories.includes(p.category) ? {} : { custom_category: p.category }),
      ...(p.is_high_priority !== undefined ? { is_high_priority: p.is_high_priority } : {}),
      ...(p.assets_collected !== undefined ? { assets_collected: p.assets_collected } : {})
    };

    // Sanitise email — empty string must become NULL so the partial unique index
    // (which only covers non-null emails) allows multiple emailless guests.
    const cleanEmail = p.email?.toLowerCase().trim() || null;

    let saveError: any = null;

    if (p.id) {
      // Existing record → UPDATE by primary key (safest, no conflict issues)
      const { error } = await supabase
        .from('participants')
        .update({
          name: p.name,
          email: cleanEmail,
          phone: p.phone || '',
          company: p.company || '',
          category: dbCategory,
          location: p.location || '',
          linkedin_url: p.linkedin_url || '',
          bio: p.bio || '',
          custom_data: customData,
          networking_dna: p.networking_dna
        })
        .eq('id', p.id);
      saveError = error;
    } else if (cleanEmail) {
      // New record WITH email → upsert on (event_id, email)
      const { error } = await supabase
        .from('participants')
        .upsert({
          event_id: event.id,
          name: p.name,
          email: cleanEmail,
          phone: p.phone || '',
          company: p.company || '',
          category: dbCategory,
          location: p.location || '',
          linkedin_url: p.linkedin_url || '',
          bio: p.bio || '',
          custom_data: customData,
          networking_dna: p.networking_dna
        }, { onConflict: 'event_id,email' });
      saveError = error;
    } else {
      // New record WITHOUT email → plain INSERT (NULL emails don't conflict)
      const { error } = await supabase
        .from('participants')
        .insert({
          event_id: event.id,
          name: p.name,
          email: null,
          phone: p.phone || '',
          company: p.company || '',
          category: dbCategory,
          location: p.location || '',
          linkedin_url: p.linkedin_url || '',
          bio: p.bio || '',
          custom_data: customData,
          networking_dna: p.networking_dna
        });
      saveError = error;
    }

    if (!saveError) {
      setSyncStatus({ message: `Registry Updated: ${p.name}`, type: 'success' });
      await fetchParticipants();
    } else {
      console.error('saveIndividualGuest error:', saveError);
      setSyncStatus({ message: `Save Failed: ${saveError.message}`, type: 'error' });
    }
    setSavingIndividual(false);
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleDownloadBulkQR = async (selectedOnly: boolean = false) => {
    const targetGuests = selectedOnly && printQueue.length > 0
      ? profiles.filter(p => p.id && printQueue.includes(p.id))
      : profiles;

    if (targetGuests.length === 0) {
      alert("No attendees available for QR export.");
      return;
    }

    setBulkDownloading(true);
    try {
      await downloadBulkQRZip(
        targetGuests,
        event.brand_config.eventName || event.name,
        (prog) => setZipProgress(prog)
      );
      setSyncStatus({ message: `Exported ${targetGuests.length} QR codes in ZIP archive`, type: 'success' });
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      alert("Bulk QR download failed: " + err.message);
    } finally {
      setBulkDownloading(false);
      setZipProgress(null);
    }
  };

  const handleScanSuccess = async (log: AttendanceRecord) => {
    try {
      const validCategories = ['Delegate', 'Speaker', 'VIP', 'Press', 'Exhibitor'];
      const rawCategory = log.category || 'Delegate';
      const dbCategory = validCategories.includes(rawCategory) ? rawCategory : 'Delegate';
      const customData = validCategories.includes(rawCategory) ? {} : { custom_category: rawCategory };

      // ── STEP 1: Identify or Upsert participant ─────────────────────────
      let participantId = log.participant_id;

      if (!participantId) {
        const cleanEmail = log.email?.toLowerCase().trim();
        if (cleanEmail) {
          const { data: p } = await supabase
            .from('participants')
            .upsert({
              event_id: event.id,
              name: log.name,
              email: cleanEmail,
              company: log.company || '',
              category: dbCategory,
              location: log.geo || '',
              status: 'Verified',
              custom_data: customData
            }, { onConflict: 'event_id,email' })
            .select('id')
            .single();
          if (p?.id) participantId = p.id;
        } else {
          // Look up existing participant by name in this event
          const { data: matched } = await supabase
            .from('participants')
            .select('id')
            .eq('event_id', event.id)
            .ilike('name', log.name)
            .limit(1);

          if (matched && matched.length > 0) {
            participantId = matched[0].id;
            await supabase.from('participants').update({ status: 'Verified' }).eq('id', participantId);
          } else {
            const { data: newP } = await supabase
              .from('participants')
              .insert({
                event_id: event.id,
                name: log.name,
                email: null,
                company: log.company || '',
                category: dbCategory,
                location: log.geo || '',
                status: 'Verified',
                custom_data: customData
              })
              .select('id')
              .single();
            if (newP?.id) participantId = newP.id;
          }
        }
      }

      if (!participantId) {
        throw new Error("Could not register or locate participant record");
      }

      // ── STEP 2: Duplicate scan guard ────────────────────────────────────
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let dupQuery = supabase
        .from('attendance_logs')
        .select('id')
        .eq('event_id', event.id)
        .eq('participant_id', participantId)
        .gte('created_at', todayStart.toISOString());

      if (activeSessionId) {
        dupQuery = dupQuery.eq('session_id', activeSessionId);
      } else {
        dupQuery = dupQuery.is('session_id', null);
      }

      const { data: existing } = await dupQuery.limit(1);

      const sessionName = sessions.find(s => s.id === activeSessionId)?.title || null;

      if (existing && existing.length > 0) {
        // Already checked in — update local log and show warning, don't throw
        setLocalScanLog(prev => [{
          name: log.name, company: log.company || '',
          category: rawCategory, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sessionName, alreadyIn: true
        }, ...prev].slice(0, 30));
        setSyncStatus({ message: `Already Checked In: ${log.name}`, type: 'warning' });
        setTimeout(() => setSyncStatus(null), 4000);
        return;
      }

      // ── STEP 3: Insert attendance log ───────────────────────────────────
      const { error: logError } = await supabase.from('attendance_logs').insert({
        event_id: event.id,
        guest_name: log.name,
        guest_email: log.email?.toLowerCase().trim() || null,
        terminal_id: log.terminal_id,
        geo: log.geo,
        ai_welcome: log.aiWelcome,
        participant_id: participantId,
        session_id: activeSessionId
      });

      if (logError) throw logError;

      // ── STEP 4: Update local scan log (visible to scanner nodes) ────────
      setLocalScanLog(prev => [{
        name: log.name, company: log.company || '',
        category: rawCategory, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sessionName, alreadyIn: false
      }, ...prev].slice(0, 30));

      setSyncStatus({
        message: activeSessionId ? `Session Entry: ${log.name}` : `Main Arrival: ${log.name}`,
        type: 'success'
      });
      setTimeout(() => setSyncStatus(null), 3000);

    } catch (err: any) {
      console.error("Scanner DB Error:", err);
      // Don't re-throw — the scanner should not show a failure screen for a
      // DB-side error. Show the sync status bar instead.
      setSyncStatus({ message: `Sync error: ${err?.message || 'Unknown error'}`, type: 'error' });
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const navTabs = [
    { id: 'dashboard', icon: TrendingUp, label: 'Analytics', roles: ['Lead', 'Manager'] },
    { id: 'guests', icon: UserPlus, label: 'Guest CRM', roles: ['Lead', 'Manager'] },
    { id: 'checkin', icon: ScanLine, label: 'Scanner', roles: ['Lead', 'Manager', 'Scanner'] },
    { id: 'program', icon: CalendarDays, label: 'Program', roles: ['Lead', 'Manager'] },
    { id: 'composer', icon: FileStack, label: 'Print Shop', roles: ['Lead', 'Manager'] },
    { id: 'logs', icon: History, label: 'History', roles: ['Lead', 'Manager'] },
    { id: 'registration', icon: ClipboardList, label: 'Reg Form', roles: ['Lead', 'Manager'] },
    { id: 'comms', icon: Mail, label: 'Comms', roles: ['Lead', 'Manager'] },
    { id: 'settings', icon: Settings, label: 'Design', roles: ['Lead'] }
  ].filter(t => t.roles.includes(role));

  // ── All unique event days, in chronological order ────────────────────────
  const logDays = useMemo(() => {
    const seen = new Set<string>();
    const days: string[] = [];
    [...attendance].sort((a, b) =>
      new Date(a.date || '').getTime() - new Date(b.date || '').getTime()
    ).forEach(l => {
      if (l.date && !seen.has(l.date)) { seen.add(l.date); days.push(l.date); }
    });
    return days;
  }, [attendance]);

  // ── Log statistics (computed from full attendance, not filtered) ─────────
  const logStats = useMemo(() => {
    const byCat: Record<string, number>    = {};
    const byGender: Record<string, number> = {};
    const bySession: Record<string, number> = {};
    attendance.forEach(l => {
      const cat = l.category || 'Unknown';
      byCat[cat] = (byCat[cat] || 0) + 1;
      const g = l.gender || 'Not specified';
      byGender[g] = (byGender[g] || 0) + 1;
      const sess = sessions.find(s => s.id === l.session_id)?.title || 'General Entry';
      bySession[sess] = (bySession[sess] || 0) + 1;
    });
    return { byCat, byGender, bySession };
  }, [attendance, sessions]);

  // ── Unique categories and genders in the log ─────────────────────────────
  const logCategories = useMemo(() =>
    [...new Set(attendance.map(l => l.category).filter(Boolean))] as string[],
  [attendance]);

  const logGenders = useMemo(() =>
    [...new Set(attendance.map(l => l.gender).filter(Boolean))] as string[],
  [attendance]);

  // ── Filtered + sorted logs ────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    let logs = [...attendance];

    // Day filter
    if (activeLogDay !== 'all') logs = logs.filter(l => l.date === activeLogDay);

    // Category filter
    if (logFilterCat !== 'all') logs = logs.filter(l => l.category === logFilterCat);

    // Gender filter
    if (logFilterGender !== 'all') logs = logs.filter(l => (l.gender || 'Not specified') === logFilterGender);

    // Session filter
    if (logFilterSession !== 'all') {
      if (logFilterSession === '__general__') {
        logs = logs.filter(l => !l.session_id);
      } else {
        logs = logs.filter(l => l.session_id === logFilterSession);
      }
    }

    // Search
    if (logSearch) {
      const q = logSearch.toLowerCase();
      logs = logs.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.location?.toLowerCase().includes(q) ||
        l.category?.toLowerCase().includes(q)
      );
    }

    // Sort
    logs.sort((a, b) => {
      let valA = '', valB = '';
      switch (logSortBy) {
        case 'name':     valA = a.name     || ''; valB = b.name     || ''; break;
        case 'company':  valA = a.company  || ''; valB = b.company  || ''; break;
        case 'category': valA = a.category || ''; valB = b.category || ''; break;
        case 'gender':   valA = a.gender   || ''; valB = b.gender   || ''; break;
        case 'location': valA = a.location || ''; valB = b.location || ''; break;
        case 'time':
        default:
          // Primary: date, Secondary: timestamp
          const da = new Date((a.date || '') + ' ' + (a.timestamp || '')).getTime();
          const db = new Date((b.date || '') + ' ' + (b.timestamp || '')).getTime();
          return logSortDir === 'asc' ? da - db : db - da;
      }
      const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
      return logSortDir === 'asc' ? cmp : -cmp;
    });

    return logs;
  }, [attendance, logSearch, activeLogDay, logSortBy, logSortDir, logFilterCat, logFilterGender, logFilterSession, sessions]);

  // ── Sort toggle helper ────────────────────────────────────────────────────
  // When groupBy is active, keep groups contiguous then sort within each group
  const groupedAndSorted = useMemo(() => {
    const logs = [...filteredLogs];
    if (logGroupBy === 'none') return logs;
    const key = (l: AttendanceRecord) => {
      if (logGroupBy === 'category') return l.category || '';
      if (logGroupBy === 'gender')   return l.gender   || 'Not specified';
      if (logGroupBy === 'company')  return l.company  || '';
      return '';
    };
    return logs.sort((a, b) => {
      const gCmp = key(a).localeCompare(key(b), undefined, { sensitivity: 'base' });
      if (gCmp !== 0) return gCmp;
      // secondary sort: time ascending within group
      const da = new Date((a.date||'') + ' ' + (a.timestamp||'')).getTime();
      const db = new Date((b.date||'') + ' ' + (b.timestamp||'')).getTime();
      return da - db;
    });
  }, [filteredLogs, logGroupBy]);

  // Stats scoped to the current day + filter selection (not global)
  const scopedStats = useMemo(() => {
    const byCat:    Record<string,number> = {};
    const byGender: Record<string,number> = {};
    const byOrg:    Record<string,number> = {};
    filteredLogs.forEach(l => {
      const c = l.category || 'Unknown';  byCat[c]    = (byCat[c]    || 0) + 1;
      const g = l.gender   || 'Not specified'; byGender[g] = (byGender[g] || 0) + 1;
      const o = l.company  || 'Unspecified'; byOrg[o]    = (byOrg[o]    || 0) + 1;
    });
    return { byCat, byGender, byOrg };
  }, [filteredLogs]);

  const handleSortToggle = (col: typeof logSortBy) => {
    if (logSortBy === col) setLogSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setLogSortBy(col); setLogSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: typeof logSortBy }) => {
    if (logSortBy !== col) return <span className="text-slate-700 ml-1 opacity-30">↕</span>;
    return <span className="text-emerald-400 ml-1">{logSortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Export label describes exactly what's in the file
  const exportLabel = () => {
    const parts: string[] = [];
    if (activeLogDay === 'all') parts.push('All_Days');
    else parts.push(`Day_${logDays.indexOf(activeLogDay)+1}`);
    if (logFilterCat    !== 'all') parts.push(logFilterCat.replace(/\s+/g,'_'));
    if (logFilterGender !== 'all') parts.push(logFilterGender.replace(/\s+/g,'_'));
    if (logGroupBy      !== 'none') parts.push(`by_${logGroupBy}`);
    return parts.join('_');
  };

  const hasAnyFilter = logFilterCat !== 'all' || logFilterGender !== 'all' || logFilterSession !== 'all' || logSearch !== '' || logGroupBy !== 'none' || activeLogDay !== 'all';

  // ── Export to CSV ─────────────────────────────────────────────────────────
  const handleExportCSV = (logs: AttendanceRecord[], label: string) => {
    const headers = ['#','Attendee Name','Email Address','Sex / Gender','Registered Location','Organisation','Access Category','Check-in Date','Check-in Time','Session Track','Scanner Terminal','Status'];
    const rows = logs.map((l, i) => {
      const sess = sessions.find(s => s.id === l.session_id);
      return [
        i + 1,
        l.name,
        l.email || '',
        l.gender || '',
        l.location || '',
        l.company || '',
        l.category || '',
        l.date || '',
        l.timestamp || '',
        sess?.title || 'General Entry',
        l.terminal_id || 'Main Gate',
        'Verified Arrival'
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    // UTF-8 BOM (\uFEFF) ensures Excel opens multilingual characters accurately
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `Attendance_${(event.brand_config.eventName || event.name).replace(/\s+/g, '_')}_${label.replace(/\//g, '-')}.csv`;
    a.click();
  };

  // ── Print attendance register ─────────────────────────────────────────────
  // Opens a new window with a properly formatted A4-landscape register.
  // Supports single-day and multi-day (all days, one per page).
  const handlePrintRegister = (logs: AttendanceRecord[], dayLabel: string, allDays = false) => {
    const eventName  = event.brand_config.eventName || event.name;
    const primary    = event.brand_config.primaryColor || '#10b981';
    const generated  = new Date().toLocaleString();

    const buildRows = (rows: AttendanceRecord[], startIdx = 1) =>
      rows.map((l, i) => {
        const sess = sessions.find(s => s.id === l.session_id);
        const bg   = (startIdx + i) % 2 === 0 ? '#f8fafc' : '#ffffff';
        return `<tr style="background:${bg}">
          <td style="color:#94a3b8;text-align:center;font-weight:700">${startIdx + i}</td>
          <td><strong>${l.name}</strong></td>
          <td style="color:#475569">${l.email || '<span style="color:#cbd5e1">—</span>'}</td>
          <td style="text-align:center">${l.gender || '<span style="color:#cbd5e1">—</span>'}</td>
          <td>${l.location || '<span style="color:#cbd5e1">—</span>'}</td>
          <td>${l.company || '<span style="color:#cbd5e1">—</span>'}</td>
          <td><span style="background:${primary}18;color:${primary};padding:2px 8px;border-radius:4px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.08em">${l.category || '—'}</span></td>
          <td style="color:#64748b;text-align:center">${l.timestamp || ''}</td>
          <td style="color:#64748b">${sess?.title || 'General Entry'}</td>
        </tr>`;
      }).join('');

    const tableHead = `<thead>
      <tr style="background:#f1f5f9">
        <th style="width:32px;text-align:center">#</th>
        <th>Full Name</th>
        <th>Email Address</th>
        <th style="width:60px;text-align:center">Sex</th>
        <th>Location</th>
        <th>Organisation</th>
        <th>Category</th>
        <th style="width:60px;text-align:center">Time</th>
        <th>Session</th>
      </tr>
    </thead>`;

    let bodyContent = '';
    if (allDays) {
      let runningIdx = 1;
      const dayGroups = logDays.map(day => {
        const dayLogs = attendance.filter(l => l.date === day);
        const fullDate = new Date(day).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const block = `
          <div style="break-before:page;margin-top:0">
            <div style="border-left:4px solid ${primary};padding:8px 14px;background:${primary}12;margin-bottom:12px;border-radius:0 6px 6px 0">
              <div style="font-size:13px;font-weight:900;color:#1e293b">${fullDate}</div>
              <div style="font-size:10px;color:#64748b;margin-top:2px">${dayLogs.length} attendee${dayLogs.length !== 1 ? 's' : ''} recorded</div>
            </div>
            <table style="width:100%;border-collapse:collapse">
              ${tableHead}
              <tbody>${buildRows(dayLogs, runningIdx)}</tbody>
            </table>
          </div>`;
        runningIdx += dayLogs.length;
        return block;
      });
      bodyContent = dayGroups.join('');
    } else {
      const fullDate = logs[0]?.date
        ? new Date(logs[0].date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : dayLabel;
      bodyContent = `
        <div style="border-left:4px solid ${primary};padding:8px 14px;background:${primary}12;margin-bottom:12px;border-radius:0 6px 6px 0">
          <div style="font-size:13px;font-weight:900;color:#1e293b">${fullDate}</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">${logs.length} attendee${logs.length !== 1 ? 's' : ''} recorded</div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          ${tableHead}
          <tbody>${buildRows(logs)}</tbody>
        </table>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Attendance Register — ${eventName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff}
    .page-wrap{padding:20px 24px}
    .doc-header{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:3px solid ${primary};margin-bottom:16px}
    .doc-header h1{font-size:22px;font-weight:900;font-style:italic;color:#0f172a}
    .doc-header p{font-size:10px;color:#64748b;margin-top:3px}
    .doc-meta{display:flex;justify-content:space-between;margin-bottom:14px}
    .doc-meta span{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{padding:7px 10px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;border-bottom:2px solid #e2e8f0;white-space:nowrap}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .doc-footer{margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em}
    @page{size:A4 landscape;margin:12mm 14mm}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page-wrap{padding:0}}
  </style>
</head>
<body>
<div class="page-wrap">
  <div class="doc-header">
    <div>
      <h1>${eventName}</h1>
      <p>Official Attendance Register — ${allDays ? 'All Days' : dayLabel}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Total Attendees</p>
      <p style="font-size:26px;font-weight:900;color:${primary};line-height:1">${logs.length}</p>
    </div>
  </div>
  <div class="doc-meta">
    <span>Generated: ${generated}</span>
    <span>SummitSync · Verified Attendance Record</span>
  </div>
  ${bodyContent}
  <div class="doc-footer">
    <span>${eventName} — Confidential</span>
    <span>Page <span class="pagenum"></span></span>
  </div>
</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=860');
    if (!win) { alert('Please allow pop-ups for this page to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.addEventListener('load', () => {
      setTimeout(() => { win.print(); }, 400);
    });
  };

  return (
    <div key={terminalKey} className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-emerald-500/20 text-slate-100 print:block print:min-h-0 print:bg-white print:text-black">
      {/* VIP ALERT TOAST */}
      {vipAlert && (
        <div className="fixed top-24 right-6 z-[200] w-80 bg-white p-6 rounded-[2rem] shadow-3xl border-4 border-amber-400 animate-in slide-in-from-right-10 duration-500">
           <div className="flex justify-between items-start mb-4">
              <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                <Bell size={24} className="animate-bounce" />
              </div>
              <button onClick={() => setVipAlert(null)} className="text-slate-300 hover:text-slate-950"><X size={20}/></button>
           </div>
           <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-1">VIP Proximity Alert</p>
           <h4 className="text-xl font-black italic text-slate-950 leading-none mb-1">{vipAlert.name}</h4>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{vipAlert.company}</p>
           <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase">Location: Main Hall</span>
              <Award size={18} className="text-amber-400" />
           </div>
        </div>
      )}

      <nav className="bg-slate-900 border-b border-white/5 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {!isScannerOnly && (
              <button onClick={onBack} className="p-3 bg-white/5 hover:bg-emerald-500 hover:text-slate-950 rounded-2xl transition-all"><ArrowLeft size={18} /></button>
            )}
            <div>
              <h2 className="text-xl font-black italic tracking-tighter text-white">{event.brand_config.eventName || event.name}</h2>
              <div className="flex items-center gap-2">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Node: {role}</p>
                 {isCloudActive && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                       <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                       <span className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter">Ops Stream Active</span>
                    </div>
                 )}
              </div>
            </div>
          </div>
          <div className="flex bg-white/5 rounded-2xl p-1 gap-1 border border-white/10 overflow-x-auto max-w-[60vw] md:max-w-none no-scrollbar">
            {navTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                  tab === t.id ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <t.icon size={16} />
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-12 relative">
        {syncStatus && (
          <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-3xl flex items-center gap-4 animate-in slide-in-from-top-12 border ${
            syncStatus.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 
            syncStatus.type === 'warning' ? 'bg-amber-500 border-amber-400 text-slate-950' :
            'bg-red-500 border-red-400 text-white'
          }`}>
             {syncStatus.type === 'success' ? <CheckCircle2 size={20} /> : 
              syncStatus.type === 'warning' ? <ShieldX size={20} /> :
              <AlertCircle size={20} />}
             <p className="font-black text-[10px] uppercase tracking-widest leading-none">{syncStatus.message}</p>
          </div>
        )}

        {bulkDownloading && zipProgress && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-3xl text-center space-y-5">
              <div className="w-14 h-14 bg-emerald-500 text-slate-950 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                <FileArchive size={28} />
              </div>
              <div>
                <h4 className="text-xl font-black italic text-white">Packaging QR Archive</h4>
                <p className="text-xs text-slate-400 mt-1">Rendering high-res badges and building ZIP bundle...</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span className="truncate max-w-[200px] text-white">{zipProgress.currentName}</span>
                  <span className="tabular-nums font-mono text-emerald-400">{zipProgress.current} / {zipProgress.total}</span>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                    style={{ width: `${zipProgress.percent}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Download will start automatically once compressed</p>
            </div>
          </div>
        )}

        {tab === 'dashboard' && (
          <AnalyticsDashboard 
            profiles={profiles} 
            attendance={attendance} 
            sessions={sessions}
          />
        )}

        {tab === 'guests' && !isScannerOnly && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7 space-y-10">
              <section className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-white/5">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-3xl font-black italic tracking-tighter text-white">Guest CRM</h3>
                  <SmartUpload activeFields={event.brand_config.activeCustomFields} onImport={async (list) => {
                     const validCategories = ['Delegate', 'Speaker', 'VIP', 'Press', 'Exhibitor'];
                     // Split guests into two buckets:
                     //   withEmail  → upsert on (event_id, email) — safe dedup
                     //   noEmail    → insert (NULL email doesn't conflict)
                     const withEmail: any[] = [];
                     const noEmail:   any[] = [];

                     list.forEach(p => {
                       const dbCategory = validCategories.includes(p.category) ? p.category : 'Delegate';
                       const customData = {
                         ...(p.customData || {}),
                         ...(validCategories.includes(p.category) ? {} : { custom_category: p.category }),
                         ...(p.is_high_priority !== undefined ? { is_high_priority: p.is_high_priority } : {}),
                         ...(p.assets_collected !== undefined ? { assets_collected: p.assets_collected } : {})
                       };
                                               const cleanEmail = p.email?.toLowerCase().trim() || null;
                        const row = {
                          event_id: event.id,
                          name: p.name,
                          email: cleanEmail,
                          phone: p.phone || "",
                          company: p.company || "",
                          category: dbCategory,
                          gender: (p as any).gender || (p.customData as any)?.gender || null,
                          location: p.location || "",
                          custom_data: customData,
                          status: "Registered"
                        };
                        if (cleanEmail) withEmail.push(row);
                        else            noEmail.push(row);
                      });

                      // Deduplicate withEmail by email to avoid PostgreSQL:
                      // "ON CONFLICT DO UPDATE command cannot affect row a second time"
                      const seenEmails = new Set<string>();
                      const deduplicatedWithEmail: any[] = [];
                      withEmail.forEach(r => {
                        if (!seenEmails.has(r.email)) {
                          seenEmails.add(r.email);
                          deduplicatedWithEmail.push(r);
                        }
                      });

                     try {
                       const CHUNK = 200; // smaller chunks = better error isolation
                       let totalSaved = 0;
                       let errors: string[] = [];

                       // Upsert guests WITH emails (deduplicated)
                      for (let i = 0; i < deduplicatedWithEmail.length; i += CHUNK) {
                        const chunk = deduplicatedWithEmail.slice(i, i + CHUNK);
                        let { error } = await supabase
                          .from("participants")
                          .upsert(chunk, { onConflict: "event_id,email" });

                        // If conflict on (event_id, email) constraint fails due to older schema, retry on (email)
                        if (error && error.message.includes("constraint")) {
                          const retry = await supabase.from("participants").upsert(chunk, { onConflict: "email" });
                          error = retry.error;
                        }

                        // If batch still fails, try row-by-row to save valid rows
                        if (error) {
                          for (const singleRow of chunk) {
                            const singleRes = await supabase.from("participants").upsert(singleRow);
                            if (singleRes.error) errors.push(singleRow.name + ": " + singleRes.error.message);
                            else totalSaved++;
                          }
                        } else {
                          totalSaved += chunk.length;
                        }
                      }

                      // Insert guests WITHOUT emails
                      for (let i = 0; i < noEmail.length; i += CHUNK) {
                        const chunk = noEmail.slice(i, i + CHUNK);
                        const { error } = await supabase
                          .from("participants")
                          .insert(chunk);
                        if (error) {
                          for (const singleRow of chunk) {
                            const singleRes = await supabase.from("participants").insert(singleRow);
                            if (singleRes.error) errors.push(singleRow.name + ": " + singleRes.error.message);
                            else totalSaved++;
                          }
                        } else {
                          totalSaved += chunk.length;
                        }
                      }

                      if (errors.length === 0) {
                        setSyncStatus({ message: `Successfully Imported ${totalSaved} Guests`, type: "success" });
                      } else {
                        setSyncStatus({ 
                          message: totalSaved > 0 ? `Imported ${totalSaved} guests (${errors.length} skipped)` : `Import error: ${errors[0]}`, 
                          type: totalSaved > 0 ? "warning" : "error" 
                        });
                      }
                      setTimeout(() => setSyncStatus(null), 5000);
                      fetchParticipants();
                     } catch (error: any) {
                        setSyncStatus({ message: `Import Failed: ${error.message}`, type: 'error' });
                        setTimeout(() => setSyncStatus(null), 5000);
                        throw error;
                     }
                  }} />
                </div>
                <ParticipantForm 
                   profile={selectedProfile || { event_id: event.id, name: '', email: '', phone: '', category: 'Delegate', location: '', customData: {} }} 
                   brand={event.brand_config}
                   onChange={handleProfileChange} 
                />
                <div className="mt-8 pt-8 border-t border-white/5 flex gap-4">
                  <Button 
                    onClick={saveIndividualGuest}
                    disabled={savingIndividual || !selectedProfile?.name}
                    className="flex-1 h-16 rounded-2xl bg-emerald-500 text-slate-950"
                    icon={savingIndividual ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  >
                    Update Guest Intelligence
                  </Button>
                </div>
              </section>

              <div className="bg-slate-900 rounded-[2.5rem] border border-white/5 shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-white/5 bg-white/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-slate-500" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Roster ({profiles.length})</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {profiles.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadBulkQR(false)}
                        disabled={bulkDownloading}
                        className="rounded-xl text-[10px] font-black uppercase tracking-wider h-9"
                        icon={<FileArchive size={13} className="text-emerald-400" />}
                      >
                        All QRs (ZIP)
                      </Button>
                    )}
                    {printQueue.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadBulkQR(true)}
                        disabled={bulkDownloading}
                        className="rounded-xl text-[10px] font-black uppercase tracking-wider h-9 text-emerald-300 border-emerald-500/30"
                        icon={<FileArchive size={13} />}
                      >
                        Selected ({printQueue.length}) (ZIP)
                      </Button>
                    )}
                    <button onClick={() => setSelectedProfile(null)} className="text-[9px] font-black uppercase text-emerald-500 hover:underline ml-2">Register New</button>
                  </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {profiles.length === 0 ? (
                    <div className="p-20 text-center text-slate-700 font-black uppercase tracking-widest text-[10px]">No guest data available.</div>
                  ) : profiles.map((p) => (
                    <div 
                      key={p.id} 
                      className={`px-8 py-5 border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer flex justify-between items-center ${selectedProfile?.id === p.id ? 'bg-white/5' : ''}`}
                    >
                      <div className="flex items-center gap-5 flex-1" onClick={() => setSelectedProfile(p)}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(p.id) setPrintQueue(prev => prev.includes(p.id!) ? prev.filter(x => x !== p.id) : [...prev, p.id!]); }}
                          className={`p-2 rounded-xl transition-all ${p.id && printQueue.includes(p.id) ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-slate-500 hover:bg-white/20'}`}
                        >
                          {p.id && printQueue.includes(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-white italic leading-none">{p.name}</p>
                            {p.category === 'VIP' && <Award size={14} className="text-amber-400" />}
                            {p.is_high_priority && <Bell size={12} className="text-emerald-500 animate-pulse" />}
                          </div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{p.company || 'Private Guest'} • {p.status || 'Registered'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSingleQR(p, event.brand_config.eventName || event.name);
                          }}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-emerald-500 hover:text-slate-950 text-slate-400 transition-colors"
                          title="Download QR Code (PNG)"
                        >
                          <QrCode size={15} />
                        </button>
                        <ChevronRight size={18} className="text-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="sticky top-32 space-y-8">
                {selectedProfile && (
                  <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-3xl">
                    <div className="flex items-center gap-3 mb-6">
                      <Package size={18} className="text-emerald-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Management</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {['Delegate Bag', 'Lanyard', 'Handbook', 'T-Shirt'].map(asset => (
                        <button
                          key={asset}
                          onClick={() => toggleAssetCollection(selectedProfile, asset)}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                            (selectedProfile.assets_collected || []).includes(asset)
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                            : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-tight">{asset}</span>
                          {(selectedProfile.assets_collected || []).includes(asset) ? <Check size={14} /> : <div className="w-3 h-3 rounded-full border border-white/10"/>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <BadgePreview data={selectedProfile} brand={event.brand_config} size={badgeSize} />
              </div>
            </div>
          </div>
        )}

        {tab === 'program' && (
          <SessionManager 
            event={event} 
            onRefresh={fetchSessions} 
            sessions={sessions} 
          />
        )}

        {tab === 'checkin' && (
          <div className="max-w-xl mx-auto py-12">
            <div className="text-center mb-12">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 rounded-full text-emerald-500 font-black text-[9px] uppercase tracking-widest mb-6 shadow-xl border border-emerald-500/20">
                 <Activity size={14} className="animate-pulse" /> {role} Terminal
               </div>
               <h2 className="text-6xl font-black tracking-tighter mb-4 italic text-white">Verify Entry</h2>
               <p className="text-slate-500 font-medium leading-relaxed mb-8">On-site verification terminal. Ensure identity match and kit distribution.</p>
               
               {sessions.length > 0 && (
                 <div className="bg-white/5 p-2 rounded-2xl border border-white/10 shadow-sm flex gap-2 mb-10 overflow-x-auto no-scrollbar">
                   <button 
                     onClick={() => setActiveSessionId(null)}
                     className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${!activeSessionId ? 'bg-emerald-500 text-slate-950 shadow-xl' : 'text-slate-500 hover:text-white'}`}
                   >
                     Main Event
                   </button>
                   {sessions.map(s => (
                     <button 
                       key={s.id}
                       onClick={() => setActiveSessionId(s.id)}
                       className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${activeSessionId === s.id ? 'bg-emerald-500 text-slate-950 shadow-xl' : 'text-slate-500 hover:text-white'}`}
                     >
                       {s.title}
                     </button>
                   ))}
                 </div>
               )}
            </div>

            <AttendanceScanner 
              eventId={event.id}
              config={{ brand: event.brand_config, features: { voiceGreeting: false, captureLocation: true, requireSelfie: false, cloudSync: true }, terminalName: `${role} Terminal` }} 
              onScanSuccess={handleScanSuccess} 
            />

            {/* ── Local Session Scan Log ─────────────────────────────────── */}
            {/* Visible to all roles on the checkin tab. Critical for scanner  */}
            {/* nodes which have no access to the full Arrival Logs tab.       */}
            {localScanLog.length > 0 && (
              <div className="mt-8 bg-slate-900 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="px-8 py-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <History size={16} className="text-slate-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      This Session — {localScanLog.filter(e => !e.alreadyIn).length} Logged
                    </p>
                  </div>
                  <button 
                    onClick={() => setLocalScanLog([])} 
                    className="text-[9px] font-black uppercase text-slate-600 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {localScanLog.map((entry, i) => (
                    <div key={i} className={`px-8 py-4 flex items-center justify-between transition-all ${entry.alreadyIn ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${entry.alreadyIn ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                        <div>
                          <p className="font-black text-white italic text-sm leading-none mb-1">{entry.name}</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                            {entry.company || 'Private Guest'} · {entry.category}
                            {entry.alreadyIn && <span className="text-amber-400 ml-2">Already Logged</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black text-emerald-500">{entry.time}</p>
                        {entry.sessionName && (
                          <p className="text-[8px] text-slate-600 uppercase tracking-widest">{entry.sessionName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

{tab === 'logs' && !isScannerOnly && (
          <div className="space-y-4">

            {/* ══════════════════════════════════════════════════════════
                HEADER — title + scope day tabs in one card
            ══════════════════════════════════════════════════════════ */}
            <div className="bg-slate-900 rounded-[2rem] border border-white/5 shadow-xl overflow-hidden">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-7 pt-6 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-emerald-500 rounded-[1rem] flex items-center justify-center text-slate-950 shadow-xl shrink-0">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tighter text-white leading-none">Attendance Register</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">
                      <span className="text-emerald-400">{groupedAndSorted.length}</span> shown of {attendance.length} total · {logDays.length} event day{logDays.length !== 1 ? 's' : ''}
                      {hasAnyFilter && <span className="text-amber-400 ml-2">· filters active</span>}
                    </p>
                  </div>
                </div>
                {/* Search */}
                <div className="relative shrink-0">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    className="pl-8 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/5 focus:bg-white/10 transition-all text-xs font-bold text-white outline-none w-48 placeholder:text-slate-600"
                    placeholder="Search anything…"
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Day scope tabs — always visible */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar px-7 pb-5">
                {[
                  { id: 'all', label: 'All Days', count: attendance.length },
                  ...logDays.map((day, i) => ({
                    id: day,
                    label: `Day ${i + 1} · ${new Date(day).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}`,
                    count: attendance.filter(l => l.date === day).length,
                  })),
                ].map(d => (
                  <button key={d.id} onClick={() => setActiveLogDay(d.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      activeLogDay === d.id
                        ? 'bg-emerald-500 text-slate-950 shadow-lg'
                        : 'bg-white/5 text-slate-500 hover:text-white border border-white/10'
                    }`}>
                    {d.label}
                    <span className={`font-black ${activeLogDay === d.id ? 'text-slate-950/60' : 'text-slate-700'}`}>{d.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                ORGANISE BAR — group by + filter + sort, all in one row
                Everything here works on whatever scope the day tab set.
            ══════════════════════════════════════════════════════════ */}
            <div className="bg-slate-900 rounded-2xl border border-white/5 px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-2">

                {/* GROUP BY */}
                <div className="flex items-center gap-1.5 border-r border-white/10 pr-3 mr-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 shrink-0">Group by</span>
                  {([['none','None'],['category','Category'],['gender','Gender'],['company','Organisation']] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setLogGroupBy(v)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        logGroupBy === v
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'bg-white/5 text-slate-500 hover:text-white'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* FILTER: Category */}
                <select value={logFilterCat} onChange={e => setLogFilterCat(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg bg-white/5 border text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all ${
                    logFilterCat !== 'all' ? 'border-amber-500/40 text-amber-300' : 'border-white/10 text-slate-500 hover:text-white'
                  }`}>
                  <option value="all">All Access</option>
                  {logCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>

                {/* FILTER: Gender */}
                <select value={logFilterGender} onChange={e => setLogFilterGender(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg bg-white/5 border text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all ${
                    logFilterGender !== 'all' ? 'border-amber-500/40 text-amber-300' : 'border-white/10 text-slate-500 hover:text-white'
                  }`}>
                  <option value="all">All Genders</option>
                  {logGenders.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="Not specified">Not specified</option>
                </select>

                {/* FILTER: Session */}
                {sessions.length > 0 && (
                  <select value={logFilterSession} onChange={e => setLogFilterSession(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg bg-white/5 border text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all ${
                      logFilterSession !== 'all' ? 'border-amber-500/40 text-amber-300' : 'border-white/10 text-slate-500 hover:text-white'
                    }`}>
                    <option value="all">All Sessions</option>
                    <option value="__general__">General Entry</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                )}

                {/* Clear all */}
                {hasAnyFilter && (
                  <button onClick={() => {
                    setLogFilterCat('all'); setLogFilterGender('all');
                    setLogFilterSession('all'); setLogSearch('');
                    setLogGroupBy('none'); setActiveLogDay('all');
                    setLogSortBy('time'); setLogSortDir('asc');
                  }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
                    <X size={10} /> Reset All
                  </button>
                )}

                {/* Spacer + record count pill */}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                    {groupedAndSorted.length} record{groupedAndSorted.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                STATS — update with current scope + filters
                Clicking a bar applies that as a filter (they work together)
            ══════════════════════════════════════════════════════════ */}
            {filteredLogs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                {/* By Access / Category */}
                <div className="bg-slate-900 rounded-2xl border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">By Access</p>
                    {logFilterCat !== 'all' && (
                      <button onClick={() => setLogFilterCat('all')} className="text-[8px] font-black text-amber-400 hover:text-white transition-colors">clear</button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {Object.entries(scopedStats.byCat).sort(([,a],[,b]) => b-a).map(([cat, n]) => (
                      <button key={cat} onClick={() => setLogFilterCat(logFilterCat === cat ? 'all' : cat)}
                        className={`w-full flex items-center gap-2 group transition-all ${logFilterCat === cat ? 'opacity-100' : logFilterCat !== 'all' ? 'opacity-40' : 'opacity-100'}`}>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((n / filteredLogs.length) * 100)}%`, backgroundColor: '#10b981' }} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-20 text-left truncate group-hover:text-white transition-colors">{cat}</span>
                        <span className="text-[9px] font-black text-emerald-400 w-6 text-right">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* By Gender */}
                <div className="bg-slate-900 rounded-2xl border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">By Gender</p>
                    {logFilterGender !== 'all' && (
                      <button onClick={() => setLogFilterGender('all')} className="text-[8px] font-black text-amber-400 hover:text-white transition-colors">clear</button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {Object.entries(scopedStats.byGender).sort(([,a],[,b]) => b-a).map(([g, n]) => (
                      <button key={g} onClick={() => setLogFilterGender(logFilterGender === g ? 'all' : g)}
                        className={`w-full flex items-center gap-2 group transition-all ${logFilterGender === g ? 'opacity-100' : logFilterGender !== 'all' ? 'opacity-40' : 'opacity-100'}`}>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((n / filteredLogs.length) * 100)}%`, backgroundColor: '#60a5fa' }} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-left truncate group-hover:text-white transition-colors">{g}</span>
                        <span className="text-[9px] font-black text-blue-400 w-6 text-right">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* By Organisation — top 6 */}
                <div className="bg-slate-900 rounded-2xl border border-white/5 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Top Organisations</p>
                  <div className="space-y-2">
                    {Object.entries(scopedStats.byOrg).sort(([,a],[,b]) => b-a).slice(0, 6).map(([org, n]) => (
                      <div key={org} className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((n / filteredLogs.length) * 100)}%`, backgroundColor: '#a78bfa' }} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-left truncate">{org}</span>
                        <span className="text-[9px] font-black text-purple-400 w-6 text-right">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                EXPORT BAR — context-aware, always describes what will be exported
            ══════════════════════════════════════════════════════════ */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-900/60 rounded-2xl border border-white/5">
              {/* Describe what's in the export */}
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Export · <span className="text-emerald-400">{groupedAndSorted.length} records</span>
                  {activeLogDay !== 'all' && <span className="text-slate-500"> · {new Date(activeLogDay).toLocaleDateString('en-GB',{month:'short',day:'numeric'})}</span>}
                  {logFilterCat !== 'all' && <span className="text-amber-400"> · {logFilterCat}</span>}
                  {logFilterGender !== 'all' && <span className="text-amber-400"> · {logFilterGender}</span>}
                  {logGroupBy !== 'none' && <span className="text-blue-400"> · grouped by {logGroupBy}</span>}
                  {logSortBy !== 'time' && <span className="text-slate-500"> · sorted by {logSortBy}</span>}
                </p>
                <p className="text-[8px] text-slate-700 font-bold">What you see is what you export</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Download CSV — current view */}
                <button onClick={() => handleExportCSV(groupedAndSorted, exportLabel())}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 transition-all text-[9px] font-black uppercase tracking-widest">
                  <Download size={11} /> Download CSV
                </button>
                {/* Print current view */}
                <button onClick={() => handlePrintRegister(groupedAndSorted, exportLabel().replace(/_/g,' '), false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 transition-all text-[9px] font-black uppercase tracking-widest">
                  <Printer size={11} /> Print View
                </button>
                {/* Print All Days — always available, uses current sort/filter within each day */}
                <button onClick={() => handlePrintRegister(attendance, 'All Days', true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all text-[9px] font-black uppercase tracking-widest shadow-lg">
                  <CalendarRange size={11} /> Print All Days
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                TABLE — sortable headers, group headers when groupBy active
            ══════════════════════════════════════════════════════════ */}
            <div className="bg-slate-900 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
              {groupedAndSorted.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-3 text-center">
                  <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">No records match the current view.</p>
                  {hasAnyFilter && (
                    <button onClick={() => { setLogFilterCat('all'); setLogFilterGender('all'); setLogFilterSession('all'); setLogSearch(''); setLogGroupBy('none'); setActiveLogDay('all'); }}
                      className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:underline">Reset all filters</button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[940px]">
                    <thead className="bg-white/5 border-b border-white/5 sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-600 w-9 text-center">#</th>
                        <th className="px-5 py-4 cursor-pointer select-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                          onClick={() => handleSortToggle('name')}>Name <SortIcon col="name" /></th>
                        <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-600">Email</th>
                        <th className="px-5 py-4 cursor-pointer select-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors text-center"
                          onClick={() => handleSortToggle('gender')}>Sex <SortIcon col="gender" /></th>
                        <th className="px-5 py-4 cursor-pointer select-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                          onClick={() => handleSortToggle('location')}>Location <SortIcon col="location" /></th>
                        <th className="px-5 py-4 cursor-pointer select-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                          onClick={() => handleSortToggle('company')}>Organisation <SortIcon col="company" /></th>
                        <th className="px-5 py-4 cursor-pointer select-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                          onClick={() => handleSortToggle('category')}>Category <SortIcon col="category" /></th>
                        {(activeLogDay === 'all') && (
                          <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-600">Date</th>
                        )}
                        <th className="px-5 py-4 cursor-pointer select-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors text-center"
                          onClick={() => handleSortToggle('time')}>Time <SortIcon col="time" /></th>
                        <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-600">Session</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        const rows: React.ReactNode[] = [];
                        let lastGroupVal = '';
                        let lastDay = '';
                        const colSpan = 9 + (activeLogDay === 'all' ? 1 : 0);

                        groupedAndSorted.forEach((log, idx) => {
                          const session = sessions.find(s => s.id === log.session_id);

                          // ── Group header row ──────────────────────────────
                          if (logGroupBy !== 'none') {
                            const groupVal =
                              logGroupBy === 'category' ? (log.category || 'Uncategorised') :
                              logGroupBy === 'gender'   ? (log.gender   || 'Not specified') :
                              logGroupBy === 'company'  ? (log.company  || 'Unspecified')   : '';
                            if (groupVal !== lastGroupVal) {
                              lastGroupVal = groupVal;
                              const groupCount = groupedAndSorted.filter(l =>
                                logGroupBy === 'category' ? (l.category||'Uncategorised') === groupVal :
                                logGroupBy === 'gender'   ? (l.gender  ||'Not specified') === groupVal :
                                (l.company||'Unspecified') === groupVal
                              ).length;
                              rows.push(
                                <tr key={`grp-${groupVal}`}>
                                  <td colSpan={colSpan} className="px-5 py-3 bg-emerald-500/5 border-y border-emerald-500/10">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{groupVal}</span>
                                        <span className="text-[8px] font-bold text-slate-600">— {logGroupBy}</span>
                                      </div>
                                      <span className="text-[9px] font-black text-emerald-500/60">{groupCount} attendee{groupCount !== 1 ? 's' : ''}</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                          } else if (activeLogDay === 'all' && logSortBy === 'time') {
                            // ── Day break row (only in time-sorted all-days) ─
                            if (log.date !== lastDay) {
                              lastDay = log.date || '';
                              const dayCount = attendance.filter(l => l.date === log.date).length;
                              rows.push(
                                <tr key={`day-${log.date}`}>
                                  <td colSpan={colSpan} className="px-5 py-2.5 bg-white/3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        {log.date ? new Date(log.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                                      </span>
                                      <span className="text-[8px] font-bold text-slate-600">— {dayCount} arrivals</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                          }

                          // ── Data row ───────────────────────────────────────
                          rows.push(
                            <tr key={log.id || idx} className="hover:bg-white/5 transition-all">
                              <td className="px-5 py-3.5 text-[9px] font-black text-slate-700 text-center">{idx + 1}</td>
                              <td className="px-5 py-3.5">
                                <p className="font-black text-white italic leading-none text-sm">{log.name}</p>
                              </td>
                              <td className="px-5 py-3.5 text-[10px] font-mono text-slate-500 max-w-[160px] truncate">
                                {log.email || <span className="text-slate-700 font-sans not-italic">—</span>}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                {log.gender
                                  ? <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{log.gender}</span>
                                  : <span className="text-slate-700">—</span>}
                              </td>
                              <td className="px-5 py-3.5 text-[10px] font-bold text-slate-500">
                                {log.location || <span className="text-slate-700">—</span>}
                              </td>
                              <td className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                {log.company || <span className="text-slate-700">—</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                  logGroupBy === 'category' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-400'
                                }`}>
                                  {log.category || '—'}
                                </span>
                              </td>
                              {activeLogDay === 'all' && (
                                <td className="px-5 py-3.5 text-[9px] font-bold text-slate-600">{log.date}</td>
                              )}
                              <td className="px-5 py-3.5 text-[10px] font-black text-emerald-500 text-center whitespace-nowrap">{log.timestamp}</td>
                              <td className="px-5 py-3.5">
                                <span className={`text-[9px] font-black uppercase tracking-widest ${session ? 'text-blue-400' : 'text-slate-600'}`}>
                                  {session ? session.title : 'General Entry'}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

                {tab === 'composer' && (
          <SheetComposer 
            selectedGuests={profiles.filter(p => p.id && printQueue.includes(p.id))}
            brand={event.brand_config}
            onClear={() => setPrintQueue([])}
            onRemove={(id) => setPrintQueue(prev => prev.filter(x => x !== id))}
          />
        )}

        {tab === 'settings' && role === 'Lead' && (
          <div className="max-w-4xl mx-auto pb-40 space-y-12 animate-in zoom-in-95 duration-500">
            <section className="bg-slate-900 p-16 rounded-[4rem] text-white shadow-3xl relative border border-white/10 overflow-hidden">
               <div className="absolute top-0 right-0 p-16 opacity-10 transform scale-150 rotate-12"><Zap size={240} fill="currentColor" /></div>
               <div className="relative z-10">
                  <h3 className="text-4xl font-black italic tracking-tighter mb-4">Node Deployment</h3>
                  <p className="text-slate-500 text-sm mb-16 max-w-xl leading-relaxed">Secure magic links for temporary staff terminals. Leads can manage these nodes to restrict data access on-site.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {['Manager', 'Scanner', 'Exhibitor'].map(t => (
                      <div key={t} className="bg-white/5 border border-white/10 p-10 rounded-[3rem] group hover:bg-white/10 transition-all backdrop-blur-xl">
                        <h4 className="text-2xl font-black italic tracking-tight mb-8">{t} Node</h4>
                        <button 
                           onClick={() => {
                             const params = new URLSearchParams({ id: event.id, role: t as UserRole, name: event.name, client: event.client_name });
                             const encoded = btoa(params.toString());
                             const link = `${window.location.origin}${window.location.pathname}?join=${encoded}`;
                             navigator.clipboard.writeText(link);
                             setCopiedLink(t);
                             setTimeout(() => setCopiedLink(null), 2000);
                           }} 
                           className={`w-full py-6 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-[0.2em] transition-all ${copiedLink === t ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                          {copiedLink === t ? <Check size={18} strokeWidth={3} /> : <LinkIcon size={18} />}
                          {copiedLink === t ? 'Link Copied' : `Generate Access`}
                        </button>
                      </div>
                    ))}
                  </div>
               </div>
            </section>
            <section className="bg-slate-900 p-10 rounded-[3rem] border border-white/10">
               <div className="mb-8">
                 <h3 className="text-2xl font-black italic tracking-tighter text-white mb-1">Communication Settings</h3>
                 <p className="text-slate-500 text-sm">Connect your email and WhatsApp Business accounts. Credentials are stored encrypted and used server-side only.</p>
               </div>
               <CommSettings ownerId={event.owner_id} />
            </section>
            <TagDesigner config={event.brand_config} onChange={onUpdateBrand} />
          </div>
        )}

        {tab === 'registration' && role !== 'Scanner' && (
          <FormBuilder event={event} />
        )}

        {tab === 'comms' && role !== 'Scanner' && (
          <CommunicationHub
            event={event}
            participants={profiles}
            sessions={sessions}
            ownerId={event.owner_id}
          />
        )}
      </main>
    </div>
  );
};
