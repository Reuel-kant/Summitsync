
import React, { useState, useEffect, useCallback } from 'react';
import { 
  EventTenant, 
  DEFAULT_BRAND,
  UserRole,
  AuthSession
} from './types';
import { EventTerminal } from './components/EventTerminal';
import { AuthView } from './components/AuthView';
import { 
  Plus, 
  ChevronRight,
  Loader2,
  Zap,
  Trash2,
  X,
  LogOut,
  AlertCircle,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { supabase } from './lib/supabase';
import { PublicRegistration } from './components/PublicRegistration';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventTenant | null>(null);
  const [events, setEvents] = useState<EventTenant[]>([]);
  const [showWizard, setShowWizard] = useState<'create' | 'join' | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [isPublicAccess, setIsPublicAccess] = useState(false);
  const [registerEventId, setRegisterEventId] = useState<string | null>(null);
  
  const [wizardData, setWizardData] = useState({ name: '', client: '' });

  const fetchEvents = useCallback(async (userId: string, isAdmin: boolean = false) => {
    try {
      let query = supabase.from('events').select('*');
      if (!isAdmin) {
        query = query.eq('owner_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const mappedEvents: EventTenant[] = (data || []).map(ev => ({
        id: ev.id,
        owner_id: ev.owner_id,
        name: ev.name,
        client_name: ev.client_name,
        slug: ev.slug,
        brand_config: ev.brand_config || DEFAULT_BRAND,
        created_at: ev.created_at,
        isCloudSynced: true,
        activeRole: 'Lead'
      }));
      
      setEvents(mappedEvents);
    } catch (e) {
      console.error("Error fetching events", e);
    }
  }, []);

  const handleJoinLink = useCallback(async (joinParam: string) => {
    try {
      const decoded = atob(joinParam);
      const params = new URLSearchParams(decoded);
      const eventId = params.get('id');
      const role = params.get('role') as UserRole;
      
      if (eventId) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();
        
        if (data && !error) {
          const publicEvent: EventTenant = {
            id: data.id,
            owner_id: data.owner_id,
            name: data.name,
            client_name: data.client_name,
            slug: data.slug,
            brand_config: data.brand_config || DEFAULT_BRAND,
            created_at: data.created_at,
            isCloudSynced: true,
            activeRole: role || 'Scanner'
          };
          setActiveEvent(publicEvent);
          setIsPublicAccess(true);
          return true;
        }
      }
    } catch (e) {
      console.error("Join link failed", e);
    }
    return false;
  }, []);

  useEffect(() => {
    const init = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const registerParam = urlParams.get('register');
      if (registerParam) {
        setRegisterEventId(registerParam);
        setLoading(false);
        return;
      }
      const joinParam = urlParams.get('join');
      
      if (joinParam) {
        const success = await handleJoinLink(joinParam);
        if (success) {
          setLoading(false);
          return;
        }
      }

      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      
      if (supabaseSession) {
        const isAdmin = supabaseSession.user.user_metadata?.isAdmin || false;
        setSession({
          user: {
            id: supabaseSession.user.id,
            email: supabaseSession.user.email!,
            organization: supabaseSession.user.user_metadata?.organization_name || "Organization",
            isAdmin
          },
          token: supabaseSession.access_token
        });
        await fetchEvents(supabaseSession.user.id, isAdmin);
      }

      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (currentSession) {
          const isAdmin = currentSession.user.user_metadata?.isAdmin || false;
          setSession({
            user: {
              id: currentSession.user.id,
              email: currentSession.user.email!,
              organization: currentSession.user.user_metadata?.organization_name || "Organization",
              isAdmin
            },
            token: currentSession.access_token
          });
          await fetchEvents(currentSession.user.id, isAdmin);
        } else {
          setSession(null);
        }
      });

      setLoading(false);
      return () => {
        authListener.subscription.unsubscribe();
      };
    };
    init();
  }, [fetchEvents, handleJoinLink]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setActiveEvent(null);
    setIsPublicAccess(false);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleDeleteEvent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("CRITICAL ACTION: Are you sure you want to delete this event? This will permanently erase all associated guest data and logs.")) return;
    
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      setEvents(prev => prev.filter(ev => ev.id !== id));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <Loader2 className="text-emerald-500 animate-spin mb-4" size={48} />
      <p className="text-emerald-500 font-black text-xs uppercase tracking-widest">SummitSync Cloud...</p>
    </div>
  );

  if (registerEventId) {
    return <PublicRegistration eventId={registerEventId} />;
  }

  if (activeEvent) {
    return (
      <EventTerminal 
        event={activeEvent} 
        onBack={() => { 
          if (isPublicAccess) {
            window.location.href = window.location.pathname;
          } else {
            setActiveEvent(null); 
          }
        }} 
        onUpdateBrand={async (newBrand) => {
          const updatedBrand = { ...activeEvent.brand_config, ...newBrand };
          const { error } = await supabase.from('events').update({ brand_config: updatedBrand }).eq('id', activeEvent.id);
          if (!error) {
            setActiveEvent({ ...activeEvent, brand_config: updatedBrand });
          }
        }} 
        onUpdateEvent={async (updates) => {
          const { error } = await supabase.from('events').update(updates).eq('id', activeEvent.id);
          if (!error) {
            setActiveEvent({ ...activeEvent, ...updates });
          }
        }}
      />
    );
  }

  if (!session) {
    return <AuthView onAuthSuccess={setSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative">
      <nav className="absolute top-0 right-0 p-8 z-50 flex items-center gap-4">
        {session.user.isAdmin && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl text-emerald-500 font-black text-[9px] uppercase tracking-widest shadow-2xl">
            <Globe size={14} className="animate-pulse" /> Admin Mode
          </div>
        )}
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{session.user.organization}</p>
          <p className="text-xs font-bold text-slate-900">{session.user.email}</p>
        </div>
        <button onClick={handleLogout} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-red-500 transition-all shadow-sm">
          <LogOut size={20} />
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-24">
        <header className="flex flex-col md:flex-row items-center justify-between gap-12 mb-32">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-2xl transform -rotate-6">
              <Zap size={40} className="text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-6xl font-black tracking-tighter italic leading-none mb-2">Summit<span className="text-emerald-500">Sync</span></h1>
              <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">Manage guests, print badges, welcome the world.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowWizard('create')}
            className="w-full md:w-auto bg-slate-950 hover:bg-emerald-500 text-white hover:text-slate-950 px-12 py-6 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 transition-all shadow-2xl"
          >
            <Plus size={28} strokeWidth={3} />
            Launch New Event
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {events.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 text-slate-300 font-black uppercase tracking-widest text-xs">
              No active events found.
            </div>
          )}
          {events.map(event => (
            <div 
              key={event.id}
              onClick={() => setActiveEvent(event)}
              className="group bg-white p-10 rounded-[3rem] border border-slate-100 hover:border-emerald-500 hover:shadow-3xl transition-all cursor-pointer relative flex flex-col justify-between h-[22rem]"
            >
              <div className="absolute top-8 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDeleteEvent(e, event.id)}
                  className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-300 hover:text-red-500 hover:border-red-100 hover:bg-red-50 shadow-sm transition-all"
                  title="Delete Event"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div>
                <div className="flex justify-between items-start mb-8">
                  <div className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-50 border-emerald-200 text-emerald-600">
                    Lead
                  </div>
                </div>
                <h3 className="text-3xl font-black tracking-tight text-slate-900 mb-2 italic">{event.name}</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">{event.client_name}</p>
              </div>
              <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Live Sync Active</span>
                <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <ChevronRight size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showWizard === 'create' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-white rounded-[3rem] p-12 shadow-3xl">
            <h2 className="text-3xl font-black italic mb-8">Launch Your Event</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!wizardData.name || !wizardData.client) return;
              const { data, error } = await supabase.from('events').insert({
                owner_id: session.user.id,
                name: wizardData.name.trim(),
                client_name: wizardData.client.trim(),
                slug: wizardData.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2,4),
                brand_config: { ...DEFAULT_BRAND, eventName: wizardData.name.trim() }
              }).select().single();
              if (!error) {
                setEvents([data, ...events]);
                setShowWizard(null);
                setActiveEvent(data);
              } else {
                setWizardError(error.message);
              }
            }} className="space-y-6">
              <Input label="Event Name" value={wizardData.name} onChange={(e) => setWizardData({...wizardData, name: e.target.value})} placeholder="e.g. Tech Expo 2025" />
              <Input label="Client Name" value={wizardData.client} onChange={(e) => setWizardData({...wizardData, client: e.target.value})} placeholder="e.g. Acme Corp" />
              {wizardError && <p className="text-red-500 text-[10px] font-black uppercase">{wizardError}</p>}
              <Button type="submit" className="w-full h-16 rounded-2xl">Create Event Dashboard</Button>
            </form>
            <button onClick={() => setShowWizard(null)} className="absolute top-8 right-8 p-4 text-slate-400 hover:text-slate-950 transition-colors"><X /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
