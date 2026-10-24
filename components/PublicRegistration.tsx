import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { CheckCircle2, AlertCircle, Loader2, Sparkles, User, Mail, Phone, Building2, MapPin } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface PublicRegistrationProps {
  eventId: string;
}

export const PublicRegistration: React.FC<PublicRegistrationProps> = ({ eventId }) => {
  const [eventName, setEventName] = useState('Summit Event');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [successPass, setSuccessPass] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEvent = async () => {
      const { data } = await supabase.from('events').select('name, client_name').eq('id', eventId).single();
      if (data) setEventName(data.name);
    };
    loadEvent();
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const cleanEmail = email.trim().toLowerCase() || null;
      const { data, error: insertErr } = await supabase
        .from('participants')
        .insert({
          event_id: eventId,
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          company: company.trim(),
          category: 'Delegate',
          location: location.trim(),
          gender: gender || null,
          status: 'Registered',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      setSuccessPass({
        id: data.id,
        name: data.name,
        email: data.email,
        company: data.company,
        category: 'Delegate',
      });
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-3xl">
        {!successPass ? (
          <div>
            <div className="text-center mb-8">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Official Registration
              </span>
              <h2 className="text-3xl font-black italic tracking-tight mt-3 text-white">{eventName}</h2>
              <p className="text-xs text-slate-400 mt-1">Register to receive your digital entry QR pass</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Smith"
                icon={<User size={16} />}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@example.com"
                icon={<Mail size={16} />}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company"
                  icon={<Building2 size={16} />}
                />
                <Input
                  label="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1..."
                  icon={<Phone size={16} />}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Not Specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <Input
                  label="City / Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location"
                  icon={<MapPin size={16} />}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full h-14 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest mt-4"
                icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              >
                {loading ? 'Submitting Registration...' : 'Get Digital Entry Pass'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-emerald-500 text-slate-950 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black italic text-white">Registration Confirmed!</h3>
              <p className="text-xs text-slate-400 mt-1">Here is your official QR entry pass for {eventName}</p>
            </div>

            <div className="p-6 bg-white rounded-3xl shadow-2xl max-w-xs mx-auto text-slate-900">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Official Pass</p>
              <div className="flex justify-center">
                <QRCodeSVG
                  value={JSON.stringify(successPass)}
                  size={180}
                  level="H"
                />
              </div>
              <h4 className="text-lg font-black text-slate-900 mt-4 leading-tight">{successPass.name}</h4>
              <p className="text-xs font-bold text-emerald-600 uppercase mt-0.5">{successPass.category}</p>
              <p className="text-[11px] text-slate-400 mt-1">{successPass.company || 'Participant'}</p>
            </div>

            <p className="text-xs text-slate-400">Save or screenshot this QR code to present at check-in.</p>
          </div>
        )}
      </div>
    </div>
  );
};
