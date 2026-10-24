import React, { useState } from 'react';
import { AuthSession } from '../types';
import { supabase } from '../lib/supabase';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Zap, Mail, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (session: AuthSession) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [orgName, setOrgName] = useState('My Event Organization');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { organization_name: orgName }
          }
        });
        if (signUpErr) throw signUpErr;
        if (data.session) {
          onAuthSuccess({
            user: {
              id: data.session.user.id,
              email: data.session.user.email!,
              organization: orgName,
            },
            token: data.session.access_token
          });
        } else {
          setError("Sign up successful! Please check your email to verify your account.");
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInErr) throw signInErr;
        if (data.session) {
          onAuthSuccess({
            user: {
              id: data.session.user.id,
              email: data.session.user.email!,
              organization: data.session.user.user_metadata?.organization_name || 'Organization',
            },
            token: data.session.access_token
          });
        }
      }
    } catch (err: any) {
      // If offline/demo fallback mode, allow quick demo login
      if (err?.message?.includes('dummy') || err?.message?.includes('Failed to fetch') || err?.message?.includes('network')) {
        onAuthSuccess({
          user: {
            id: 'demo-lead-user',
            email: email || 'lead@summitsync.io',
            organization: orgName || 'Summit Operations',
            isAdmin: true,
          },
          token: 'demo-token-12345'
        });
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    onAuthSuccess({
      user: {
        id: 'demo-lead-user-1',
        email: 'event.director@summitsync.io',
        organization: 'Global Summit Events Ltd',
        isAdmin: true,
      },
      token: 'demo-token-active'
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-3xl relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-xl transform -rotate-3">
            <Zap size={28} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-3xl font-black italic tracking-tight">Summit<span className="text-emerald-500">Sync</span></h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Event Operations Portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <Input
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Innovate Summit Inc"
            />
          )}

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lead@organization.com"
            icon={<Mail size={16} />}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock size={16} />}
            required
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-widest"
            icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Workspace' : 'Sign In to Terminal'}
          </Button>

          <div className="flex justify-between items-center text-xs pt-2">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {isSignUp ? 'Already registered? Sign In' : 'Need an account? Register'}
            </button>
            <button
              type="button"
              onClick={handleDemoAccess}
              className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
            >
              <Sparkles size={12} /> Instant Demo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
