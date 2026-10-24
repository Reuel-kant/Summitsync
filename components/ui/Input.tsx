import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  icon,
  error,
  hint,
  className = '',
  id,
  ...props
}) => {
  return (
    <div className="w-full space-y-2">
      {label && (
        <label htmlFor={id} className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-4 text-slate-500 pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 text-sm transition-all ${className}`}
          {...props}
        />
      </div>
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
      {error && <p className="text-[10px] font-bold text-red-400">{error}</p>}
    </div>
  );
};
