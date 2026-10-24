import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { ParticipantProfile } from '../types';
import { Button } from './ui/Button';
import { 
  Upload, 
  Check, 
  AlertCircle, 
  X, 
  Loader2, 
  Sparkles, 
  FileSpreadsheet, 
  ClipboardList, 
  Trash2, 
  RefreshCw,
  Info
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface SmartUploadProps {
  onImport: (profiles: ParticipantProfile[]) => Promise<void> | void;
  activeFields: string[];
}

export const SmartUpload: React.FC<SmartUploadProps> = ({ onImport, activeFields }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<ParticipantProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [parserMode, setParserMode] = useState<'instant' | 'ai'>('instant');

  // Normalize column header names
  const matchColumn = (header: any): string => {
    if (!header) return '';
    const h = String(header).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (h.includes('fullname') || h === 'name' || h.includes('guest') || h.includes('attendee') || h.includes('person') || h.includes('participant')) return 'name';
    if (h.includes('firstname') || h === 'first') return 'first_name';
    if (h.includes('lastname') || h.includes('surname') || h === 'last') return 'last_name';
    if (h.includes('email') || h.includes('mail')) return 'email';
    if (h.includes('phone') || h.includes('mobile') || h.includes('tel') || h.includes('contact') || h.includes('cell')) return 'phone';
    if (h.includes('company') || h.includes('org') || h.includes('corp') || h.includes('business') || h.includes('institution') || h.includes('employer')) return 'company';
    if (h.includes('category') || h.includes('role') || h.includes('access') || h.includes('type') || h.includes('ticket') || h.includes('pass') || h.includes('tier')) return 'category';
    if (h.includes('gender') || h === 'sex') return 'gender';
    if (h.includes('location') || h.includes('city') || h.includes('country') || h.includes('state') || h.includes('address')) return 'location';
    return String(header).trim();
  };

  // Convert raw 2D array of rows (from Excel or CSV) into ParticipantProfiles
  const processRawMatrix = (matrix: any[][], sourceLabel: string = 'Spreadsheet'): ParticipantProfile[] => {
    if (!matrix || matrix.length === 0) return [];

    // Filter out completely blank rows
    const nonBlankRows = matrix.filter(row => 
      row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    );

    if (nonBlankRows.length === 0) return [];

    // Find the header row among the first 5 rows
    let headerRowIndex = 0;
    let bestMatchCount = -1;
    const recognizedFields = ['name', 'first_name', 'last_name', 'email', 'phone', 'company', 'category', 'gender', 'location'];

    for (let r = 0; r < Math.min(5, nonBlankRows.length); r++) {
      const row = nonBlankRows[r];
      let matches = 0;
      row.forEach(cell => {
        const matched = matchColumn(cell);
        if (recognizedFields.includes(matched)) matches++;
      });
      if (matches > bestMatchCount) {
        bestMatchCount = matches;
        headerRowIndex = r;
      }
    }

    const hasRecognizedHeaders = bestMatchCount >= 1;
    const headerRow = hasRecognizedHeaders ? nonBlankRows[headerRowIndex] : [];
    const columnMap = headerRow.map(h => matchColumn(h));
    const dataRows = hasRecognizedHeaders ? nonBlankRows.slice(headerRowIndex + 1) : nonBlankRows;

    const firstNameIdx = columnMap.indexOf('first_name');
    const lastNameIdx = columnMap.indexOf('last_name');

    const profiles: ParticipantProfile[] = [];

    dataRows.forEach((row) => {
      let name = '';
      let email = '';
      let phone = '';
      let company = '';
      let category = 'Delegate';
      let gender = '';
      let location = '';
      const customData: Record<string, string> = {};

      if (hasRecognizedHeaders) {
        row.forEach((cellVal, colIdx) => {
          const val = cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : '';
          const field = columnMap[colIdx];
          if (!field || !val) return;

          if (field === 'name') name = val;
          else if (field === 'email') email = val;
          else if (field === 'phone') phone = val;
          else if (field === 'company') company = val;
          else if (field === 'category') category = val;
          else if (field === 'gender') gender = val;
          else if (field === 'location') location = val;
          else if (field !== 'first_name' && field !== 'last_name') {
            customData[field] = val;
          }
        });

        // Combine first and last name if provided separately
        if (!name && (firstNameIdx !== -1 || lastNameIdx !== -1)) {
          const first = firstNameIdx !== -1 && row[firstNameIdx] ? String(row[firstNameIdx]).trim() : '';
          const last = lastNameIdx !== -1 && row[lastNameIdx] ? String(row[lastNameIdx]).trim() : '';
          name = `${first} ${last}`.trim();
        }
      } else {
        // Fallback positional heuristics
        name = row[0] ? String(row[0]).trim() : '';
        email = row[1] ? String(row[1]).trim() : '';
        company = row[2] ? String(row[2]).trim() : '';
        phone = row[3] ? String(row[3]).trim() : '';
      }

      // Email hygiene
      const rawEmail = (email || '').toLowerCase().trim();
      const isEmailValid = rawEmail.includes('@') && rawEmail.includes('.') && !rawEmail.includes(' ');
      const cleanEmail = isEmailValid ? rawEmail : '';

      // Clean category
      const cleanCategory = category.trim() || 'Delegate';

      if (name || cleanEmail) {
        profiles.push({
          event_id: 'pending',
          name: name || cleanEmail.split('@')[0] || 'Attendee',
          email: cleanEmail,
          phone: phone.trim(),
          company: company.trim(),
          category: cleanCategory,
          location: location.trim(),
          customData: {
            ...customData,
            ...(gender ? { gender: gender.trim() } : {})
          },
          ...((gender ? { gender: gender.trim() } : {}) as any)
        });
      }
    });

    return profiles;
  };

  // AI Extraction fallback for unstructured text
  const processWithAI = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      if (!apiKey) throw new Error("Gemini API key is not configured");

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Extract all guest registration records from this text into a JSON array.
Return JSON format:
[
  {
    "name": "Full legal name",
    "email": "Valid email or empty string",
    "phone": "Phone number or empty string",
    "company": "Company or Organization",
    "category": "Delegate, Speaker, VIP, Exhibitor, Press, Staff",
    "gender": "Male, Female, or empty string",
    "location": "City or Country",
    "customData": {}
  }
]
Input text:
${text.slice(0, 50000)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
          responseMimeType: "application/json",
          maxOutputTokens: 8192
        }
      });

      const results = JSON.parse(response.text || '[]');
      if (!Array.isArray(results) || results.length === 0) {
        throw new Error("No attendee records could be identified. Try pasting tabular spreadsheet rows.");
      }

      const mappedProfiles: ParticipantProfile[] = results
        .filter(r => (r.name || r.Name || r.email || r.Email))
        .map((r: any) => ({
          event_id: 'pending',
          name: (r.name || r.Name || (r.email ? r.email.split('@')[0] : 'Guest')).trim(),
          email: (r.email || '').toLowerCase().trim(),
          phone: (r.phone || '').trim(),
          company: (r.company || r.Company || '').trim(),
          category: (r.category || 'Delegate').trim(),
          location: (r.location || '').trim(),
          customData: {
            ...(r.customData || {}),
            ...(r.gender ? { gender: r.gender } : {})
          },
          ...((r.gender ? { gender: r.gender } : {}) as any)
        }));

      setPreview(mappedProfiles);
      setSuccessInfo(`AI parsed ${mappedProfiles.length} attendees.`);
    } catch (err: any) {
      setError(err.message || "AI extraction failed. Please paste standard CSV/Excel rows instead.");
    } finally {
      setLoading(false);
    }
  };

  // Main file loader supporting .xlsx, .xls, .csv, .tsv, .txt
  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    setSuccessInfo(null);

    try {
      const buffer = await file.arrayBuffer();

      // XLSX seamlessly parses binary Excel (.xlsx, .xls) as well as text formats (.csv, .tsv)
      const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("Spreadsheet contains no readable sheets.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '',
        blankrows: false 
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error("The selected file is empty.");
      }

      const parsed = processRawMatrix(rawRows, file.name);

      if (parsed.length === 0) {
        // If sheet parsing found 0 attendees, try AI fallback with text
        const textFallback = await file.text();
        setError("Standard column matching yielded 0 guests. Attempting AI Smart Extraction...");
        await processWithAI(textFallback);
      } else {
        setPreview(parsed);
        setSuccessInfo(`Loaded ${parsed.length} guests from ${file.name} (${worksheet['!ref'] ? `Sheet: ${firstSheetName}` : ''})`);
      }
    } catch (err: any) {
      console.error("Spreadsheet ingestion error:", err);
      // Fallback: try reading as plain text if it's text/csv
      try {
        const text = await file.text();
        const parsed = processRawMatrix(
          text.split(/\r?\n/).map(line => line.split(',')),
          file.name
        );
        if (parsed.length > 0) {
          setPreview(parsed);
          setSuccessInfo(`Loaded ${parsed.length} guests.`);
          return;
        }
      } catch (fallbackErr) {
        // Ignored
      }
      setError(`Failed to read file: ${err?.message || "Invalid spreadsheet file format. Please ensure it is a valid .xlsx or .csv"}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteProcess = () => {
    setError(null);
    if (!pasteContent.trim()) return;

    if (parserMode === 'instant') {
      try {
        // Use XLSX to parse the pasted text as a CSV/TSV table
        const workbook = XLSX.read(pasteContent, { type: 'string' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '',
          blankrows: false 
        });

        const parsed = processRawMatrix(rawRows, 'Pasted Data');
        if (parsed.length === 0) {
          setError("No tabular columns matched. Trying AI extraction...");
          processWithAI(pasteContent);
        } else {
          setPreview(parsed);
          setSuccessInfo(`Successfully processed ${parsed.length} attendees from pasted rows.`);
        }
      } catch {
        processWithAI(pasteContent);
      }
    } else {
      processWithAI(pasteContent);
    }
  };

  const handleCommit = async () => {
    if (preview.length === 0) return;
    setCommitting(true);
    setError(null);
    try {
      await onImport(preview);
      setPreview([]);
      setPasteContent('');
      setIsOpen(false);
      setSuccessInfo(null);
    } catch (err: any) {
      setError(err?.message || "Database commit failed. Please check your network or schema.");
    } finally {
      setCommitting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleRowRemove = (index: number) => {
    setPreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleFieldEdit = (index: number, field: string, value: string) => {
    setPreview(prev => prev.map((p, i) => {
      if (i !== index) return p;
      if (field === 'gender') {
        return {
          ...p,
          gender: value,
          customData: { ...(p.customData || {}), gender: value }
        } as any;
      }
      return { ...p, [field]: value };
    }));
  };

  return (
    <div>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2"
        icon={<FileSpreadsheet size={16} />}
      >
        Import Spreadsheet
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-3xl text-white max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-6 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight italic">Spreadsheet Ingestion Hub</h3>
                  <p className="text-slate-400 text-xs font-semibold">
                    Upload Excel (.xlsx, .xls), CSV, or paste directly from Google Sheets
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setParserMode('instant')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      parserMode === 'instant' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Direct Parser
                  </button>
                  <button
                    type="button"
                    onClick={() => setParserMode('ai')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      parserMode === 'ai' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles size={12} /> AI Parser
                  </button>
                </div>

                <button
                  onClick={() => { setIsOpen(false); setPreview([]); setError(null); }}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={20} className="shrink-0 text-red-400" />
                    <p className="text-xs font-bold">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="p-1 text-red-400 hover:text-white"><X size={16} /></button>
                </div>
              )}

              {successInfo && !error && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl flex items-center gap-3">
                  <Check size={18} className="text-emerald-400" />
                  <p className="text-xs font-bold">{successInfo}</p>
                </div>
              )}

              {preview.length === 0 && !loading && (
                <div className="space-y-6">
                  {/* Mode switcher: Upload vs Paste */}
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 max-w-md mx-auto">
                    <button
                      type="button"
                      onClick={() => setIsPasteMode(false)}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        !isPasteMode ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Upload File (.xlsx, .xls, .csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPasteMode(true)}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        isPasteMode ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Paste Rows from Spreadsheet
                    </button>
                  </div>

                  {!isPasteMode ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={onDrop}
                      className={`relative border-2 border-dashed rounded-[2rem] p-12 transition-all flex flex-col items-center justify-center text-center ${
                        dragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mb-4">
                        <Upload size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-2">Drop your Excel or CSV file here</h4>
                      <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
                        Supports <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>, and <strong>.tsv</strong> formats. Columns like Name, Email, Phone, Company, Category, and Gender will be auto-detected.
                      </p>
                      <label className="cursor-pointer bg-white text-slate-950 hover:bg-emerald-400 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors shadow-lg">
                        Browse Computer
                        <input
                          type="file"
                          accept=".csv,.tsv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-xs text-slate-400 flex items-start gap-3">
                        <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                        <p>
                          Copy rows directly from Excel or Google Sheets (including headers if available) and paste them below:
                        </p>
                      </div>
                      <textarea
                        className="w-full h-56 p-4 text-xs font-mono bg-slate-950 border border-white/10 rounded-2xl focus:ring-2 focus:ring-emerald-500/30 outline-none placeholder:text-slate-600 text-slate-200 resize-none"
                        placeholder="Full Name&#9;Email Address&#9;Company&#9;Category&#9;Gender&#10;Alice Johnson&#9;alice@acme.com&#9;Acme Corp&#9;VIP&#9;Female&#10;Bob Miller&#9;bob@tech.io&#9;Tech Inc&#9;Delegate&#9;Male"
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                      />
                      <Button
                        onClick={handlePasteProcess}
                        disabled={!pasteContent.trim()}
                        className="w-full h-14 rounded-2xl bg-emerald-500 text-slate-950"
                        icon={<ClipboardList size={18} />}
                      >
                        Process Spreadsheet Data
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {loading && (
                <div className="p-16 flex flex-col items-center justify-center text-center">
                  <Loader2 className="text-emerald-500 animate-spin mb-4" size={48} />
                  <p className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                    <Sparkles size={16} /> Reading & Analyzing Spreadsheet...
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Extracting worksheets, columns, and guest records.</p>
                </div>
              )}

              {/* Data Preview & Verification Table */}
              {preview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {preview.length} Attendees Ready for Review
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {preview.filter(p => p.email).length} with email · {preview.filter(p => !p.email).length} without email
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setPreview([]); setPasteContent(''); setError(null); }}
                        icon={<RefreshCw size={14} />}
                      >
                        Upload Another File
                      </Button>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-950/60 max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400 sticky top-0 border-b border-white/10">
                        <tr>
                          <th className="py-3 px-4 w-10">#</th>
                          <th className="py-3 px-4">Full Name *</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Organization</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Gender</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {preview.map((p, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-4">
                              <input
                                value={p.name}
                                onChange={(e) => handleFieldEdit(idx, 'name', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-500 focus:outline-none font-bold text-white text-xs py-1"
                              />
                            </td>
                            <td className="py-2.5 px-4">
                              <input
                                value={p.email || ''}
                                onChange={(e) => handleFieldEdit(idx, 'email', e.target.value)}
                                placeholder="None"
                                className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-500 focus:outline-none text-slate-300 text-xs py-1"
                              />
                            </td>
                            <td className="py-2.5 px-4">
                              <input
                                value={p.company || ''}
                                onChange={(e) => handleFieldEdit(idx, 'company', e.target.value)}
                                placeholder="Organization"
                                className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-500 focus:outline-none text-slate-400 text-xs py-1"
                              />
                            </td>
                            <td className="py-2.5 px-4">
                              <input
                                value={p.category || 'Delegate'}
                                onChange={(e) => handleFieldEdit(idx, 'category', e.target.value)}
                                className="w-24 bg-white/5 px-2 py-1 rounded text-emerald-400 font-bold text-[10px] uppercase border border-white/10"
                              />
                            </td>
                            <td className="py-2.5 px-4">
                              <select
                                value={(p as any).gender || ''}
                                onChange={(e) => handleFieldEdit(idx, 'gender', e.target.value)}
                                className="bg-slate-900 text-slate-300 text-xs px-2 py-1 rounded border border-white/10 focus:outline-none"
                              >
                                <option value="">—</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleRowRemove(idx)}
                                className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                                title="Remove row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {preview.length > 0 && (
              <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                <span className="text-xs text-slate-400 font-medium">
                  Ready to commit <strong className="text-white">{preview.length} attendees</strong> to your database.
                </span>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => { setPreview([]); setError(null); }}
                    disabled={committing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCommit}
                    disabled={committing}
                    className="flex-1 sm:flex-initial h-12 px-8 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg"
                    icon={committing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  >
                    {committing ? 'Importing...' : `Confirm & Commit (${preview.length})`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
