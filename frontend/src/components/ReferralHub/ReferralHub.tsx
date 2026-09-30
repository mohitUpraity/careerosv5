import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  ExternalLink, 
  Linkedin, 
  Building2, 
  GraduationCap, 
  Cpu,
  Mail,
  MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Contact, PitchResponse } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ReferralHubProps {
  initialCompanyFilter?: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export const ReferralHub: React.FC<ReferralHubProps> = ({
  initialCompanyFilter = '',
  onError,
  onSuccess,
}) => {
  const { getAuthHeaders } = useAuth();
  const [searchQuery, setSearchQuery] = useState(initialCompanyFilter);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Pitch generation state
  const [pitchType, setPitchType] = useState<'linkedin' | 'inmail' | 'email'>('linkedin');
  const [targetRole, setTargetRole] = useState('Senior Backend / Full Stack Engineer');
  const [pitchResult, setPitchResult] = useState<PitchResponse | null>(null);
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [copied, setCopied] = useState(false);

  // Quick company filters
  const quickCompanies = ['All', 'Apponward', 'DRDO', 'Google', 'Microsoft', 'HCST', 'Amazon'];

  useEffect(() => {
    loadConnections(searchQuery);
  }, []);

  const loadConnections = async (query: string) => {
    setLoadingContacts(true);
    try {
      const results = await apiService.getConnections(query === 'All' ? '' : query, getAuthHeaders());
      setContacts(results);
      if (results.length > 0 && !selectedContact) {
        setSelectedContact(results[0]);
      }
    } catch (err: any) {
      console.error(err);
      onError('Failed to load connections list');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadConnections(searchQuery);
  };

  const handleGeneratePitch = async () => {
    if (!selectedContact) {
      onError('Please select a contact to generate an outreach pitch');
      return;
    }

    setGeneratingPitch(true);
    try {
      const res = await apiService.generatePitch(
        {
          contact_name: selectedContact.name,
          contact_company: selectedContact.company,
          contact_role: selectedContact.position,
          target_role: targetRole,
          pitch_type: pitchType,
        },
        getAuthHeaders()
      );
      setPitchResult(res);
      onSuccess(`AI ${pitchType === 'linkedin' ? 'LinkedIn Note' : 'InMail'} generated!`);
    } catch (err: any) {
      onError(err.message || 'Failed to generate outreach pitch');
    } finally {
      setGeneratingPitch(false);
    }
  };

  const handleCopyPitch = () => {
    if (!pitchResult) return;
    navigator.clipboard.writeText(pitchResult.content);
    setCopied(true);
    onSuccess('Copied to clipboard!');
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#6366f1', '#10b981']
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-100">Referral Outreach Hub</h2>
          </div>
          <p className="text-xs text-slate-400">
            Search 797+ verified first-degree contacts & generate warm referral notes with Groq Llama 3.3
          </p>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {quickCompanies.map((comp) => (
            <button
              key={comp}
              onClick={() => {
                setSearchQuery(comp === 'All' ? '' : comp);
                loadConnections(comp === 'All' ? '' : comp);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                (comp === 'All' && !searchQuery) || searchQuery.toLowerCase() === comp.toLowerCase()
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {comp}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Searchable Contacts List */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col h-[640px]">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, company, position..."
              className="w-full pl-10 pr-20 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all"
            >
              Search
            </button>
          </form>

          {/* List of Contacts */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingContacts ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Filtering contacts...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No contacts found matching "{searchQuery}".
              </div>
            ) : (
              contacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                          {contact.name}
                          {contact.alumni_match && (
                            <span title="Alumni Network Match">
                              <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{contact.position}</p>
                        <p className="text-[10px] text-indigo-400 font-medium truncate flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3" />
                          {contact.company}
                        </p>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">1st Conn</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Pitch Generator & Details */}
        <div className="lg:col-span-7 space-y-6">
          {selectedContact ? (
            <div className="space-y-6">
              {/* Selected Contact Hero Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-base shadow-md">
                    {selectedContact.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">{selectedContact.name}</h3>
                    <p className="text-xs text-slate-300">{selectedContact.position}</p>
                    <p className="text-xs text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {selectedContact.company}
                    </p>
                  </div>
                </div>

                {selectedContact.url && (
                  <a
                    href={selectedContact.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all shrink-0"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    LinkedIn Profile
                    <ExternalLink className="w-3 h-3 text-indigo-400 ml-1" />
                  </a>
                )}
              </div>

              {/* Pitch Format & Generator Controls */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    AI Outreach Generator (Groq Llama 3.3)
                  </span>

                  {/* Format Pills */}
                  <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
                    <button
                      onClick={() => setPitchType('linkedin')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        pitchType === 'linkedin'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      300-Char Note
                    </button>
                    <button
                      onClick={() => setPitchType('inmail')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        pitchType === 'inmail'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      InMail / Email
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Target Role
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <button
                  onClick={handleGeneratePitch}
                  disabled={generatingPitch}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  {generatingPitch ? (
                    <>
                      <Cpu className="w-4 h-4 animate-spin" />
                      Generating Hyper-Personalized Pitch...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Generate Personalized {pitchType === 'linkedin' ? 'LinkedIn Note' : 'InMail Pitch'}
                    </>
                  )}
                </button>
              </div>

              {/* Pitch Output Card */}
              {pitchResult && (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 relative group animate-fade-in shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-[11px] font-mono text-indigo-400 font-semibold uppercase">
                      {pitchType === 'linkedin'
                        ? `LinkedIn Connection Note (${pitchResult.content.length}/300 chars)`
                        : 'Full InMail / Email Referral Pitch'}
                    </span>

                    <button
                      onClick={handleCopyPitch}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>

                  {pitchResult.subject && (
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 font-semibold">
                      <span className="text-slate-400 font-normal">Subject: </span>
                      {pitchResult.subject}
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {pitchResult.content}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[400px] p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 border-dashed flex flex-col items-center justify-center text-center space-y-3">
              <Users className="w-8 h-8 text-indigo-400/80" />
              <h3 className="text-sm font-semibold text-slate-200">No Contact Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Select a contact from the left network directory to draft tailored outreach with Groq AI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
