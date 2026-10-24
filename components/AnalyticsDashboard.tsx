import React from 'react';
import { ParticipantProfile, AttendanceRecord, EventSession } from '../types';
import { Users, UserCheck, Clock, TrendingUp, Award, Calendar } from 'lucide-react';

interface AnalyticsDashboardProps {
  profiles: ParticipantProfile[];
  attendance: AttendanceRecord[];
  sessions: EventSession[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  profiles,
  attendance,
  sessions,
}) => {
  const totalRegistered = profiles.length;
  const uniqueAttendees = new Set(attendance.map(a => a.participant_id || a.name)).size;
  const attendanceRate = totalRegistered > 0 ? Math.round((uniqueAttendees / totalRegistered) * 100) : 0;

  // Breakdown by category
  const categoryCounts = profiles.reduce((acc: Record<string, number>, p) => {
    const cat = p.category || 'Delegate';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  // Gender breakdown
  const genderCounts = profiles.reduce((acc: Record<string, number>, p) => {
    const g = (p as any).gender || 'Unspecified';
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Registered</span>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
              <Users size={18} />
            </div>
          </div>
          <h3 className="text-4xl font-black text-white italic tabular-nums">{totalRegistered}</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2">Invited & Pre-registered</p>
        </div>

        <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Checked In</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <UserCheck size={18} />
            </div>
          </div>
          <h3 className="text-4xl font-black text-emerald-400 italic tabular-nums">{uniqueAttendees}</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2">Verified Arrivals</p>
        </div>

        <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attendance Rate</span>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 className="text-4xl font-black text-white italic tabular-nums">{attendanceRate}%</h3>
          <div className="w-full bg-white/10 h-2 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${attendanceRate}%` }} 
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Total Scans Logged</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <h3 className="text-4xl font-black text-amber-400 italic tabular-nums">{attendance.length}</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2">Across All Sessions</p>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Breakdown */}
        <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl">
          <h4 className="text-base font-black italic tracking-tight text-white mb-6">Guest Distribution by Category</h4>
          <div className="space-y-4">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const pct = totalRegistered > 0 ? Math.round((count / totalRegistered) * 100) : 0;
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-white">{cat}</span>
                    <span className="text-slate-400 tabular-nums">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gender Demographics */}
        <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl">
          <h4 className="text-base font-black italic tracking-tight text-white mb-6">Demographic Profile</h4>
          <div className="space-y-4">
            {Object.entries(genderCounts).map(([g, count]) => {
              const pct = totalRegistered > 0 ? Math.round((count / totalRegistered) * 100) : 0;
              return (
                <div key={g} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-white">{g}</span>
                    <span className="text-slate-400 tabular-nums">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div className="bg-teal-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
