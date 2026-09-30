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
      onSuccess(`${pitchType === 'linkedin' ? 'LinkedIn Note' : 'InMail'} generated!`);
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
      particleCount: 30,
      spread: 40,
      origin: { y: 0.7 },
      colors: ['#2563EB', '#059669']
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand-600)' }}>
              <Users className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Referral Hub</h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Search your network and generate personalized outreach messages
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
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: (comp === 'All' && !searchQuery) || searchQuery.toLowerCase() === comp.toLowerCase()
                  ? 'var(--brand-50)' : 'transparent',
                color: (comp === 'All' && !searchQuery) || searchQuery.toLowerCase() === comp.toLowerCase()
                  ? 'var(--brand-600)' : 'var(--text-secondary)',
                border: `1px solid ${(comp === 'All' && !searchQuery) || searchQuery.toLowerCase() === comp.toLowerCase()
                  ? 'var(--brand-100)' : 'var(--border-primary)'}`,
                fontWeight: (comp === 'All' && !searchQuery) || searchQuery.toLowerCase() === comp.toLowerCase() ? 600 : 500,
              }}
            >
              {comp}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Contacts List */}
        <div className="lg:col-span-5 p-5 rounded-xl card space-y-4 flex flex-col h-[640px]">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, company, position..."
              className="input-base w-full pl-10 pr-20 text-sm"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 text-white rounded text-xs font-medium transition-all"
              style={{ backgroundColor: 'var(--brand-600)' }}
            >
              Search
            </button>
          </form>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingContacts ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--brand-500)', borderTopColor: 'transparent' }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Filtering contacts...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-12 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                No contacts found matching "{searchQuery}".
              </div>
            ) : (
              contacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="p-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSelected ? 'var(--brand-50)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--brand-100)' : 'var(--border-primary)'}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                          {contact.name}
                          {contact.alumni_match && (
                            <span title="Alumni Network Match">
                              <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warning-600)' }} />
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{contact.position}</p>
                        <p className="text-[10px] font-medium truncate flex items-center gap-1 mt-1" style={{ color: 'var(--brand-600)' }}>
                          <Building2 className="w-3 h-3" />
                          {contact.company}
                        </p>
                      </div>
                      <span className="badge-neutral text-[9px] font-mono shrink-0">1st</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Pitch Generator */}
        <div className="lg:col-span-7 space-y-6">
          {selectedContact ? (
            <div className="space-y-6">
              {/* Selected Contact Card */}
              <div className="p-5 rounded-xl card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: 'var(--brand-600)' }}
                  >
                    {selectedContact.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{selectedContact.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedContact.position}</p>
                    <p className="text-xs font-medium flex items-center gap-1 mt-0.5" style={{ color: 'var(--brand-600)' }}>
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0"
                    style={{
                      backgroundColor: 'var(--brand-50)',
                      color: 'var(--brand-600)',
                      border: '1px solid var(--brand-100)',
                    }}
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    LinkedIn
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </div>

              {/* Pitch Generator Controls */}
              <div className="p-5 rounded-xl card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--brand-600)' }} />
                    Outreach Generator
                  </span>

                  {/* Format Toggle */}
                  <div
                    className="flex items-center p-0.5 rounded-lg text-xs"
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
                  >
                    <button
                      onClick={() => setPitchType('linkedin')}
                      className="px-3 py-1 rounded font-medium transition-all"
                      style={{
                        backgroundColor: pitchType === 'linkedin' ? 'var(--bg-primary)' : 'transparent',
                        color: pitchType === 'linkedin' ? 'var(--brand-600)' : 'var(--text-secondary)',
                        boxShadow: pitchType === 'linkedin' ? '0 1px 2px var(--shadow-color)' : 'none',
                        fontWeight: pitchType === 'linkedin' ? 600 : 500,
                      }}
                    >
                      300-Char Note
                    </button>
                    <button
                      onClick={() => setPitchType('inmail')}
                      className="px-3 py-1 rounded font-medium transition-all"
                      style={{
                        backgroundColor: pitchType === 'inmail' ? 'var(--bg-primary)' : 'transparent',
                        color: pitchType === 'inmail' ? 'var(--brand-600)' : 'var(--text-secondary)',
                        boxShadow: pitchType === 'inmail' ? '0 1px 2px var(--shadow-color)' : 'none',
                        fontWeight: pitchType === 'inmail' ? 600 : 500,
                      }}
                    >
                      InMail / Email
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Your Target Role
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="input-base w-full text-sm"
                  />
                </div>

                <button
                  onClick={handleGeneratePitch}
                  disabled={generatingPitch}
                  className="w-full py-2.5 px-4 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{ backgroundColor: 'var(--brand-600)' }}
                >
                  {generatingPitch ? (
                    <>
                      <Cpu className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Generate {pitchType === 'linkedin' ? 'LinkedIn Note' : 'InMail'}
                    </>
                  )}
                </button>
              </div>

              {/* Pitch Output */}
              {pitchResult && (
                <div className="p-5 rounded-xl card space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <span className="text-[11px] font-mono font-semibold uppercase" style={{ color: 'var(--brand-600)' }}>
                      {pitchType === 'linkedin'
                        ? `LinkedIn Note (${pitchResult.content.length}/300)`
                        : 'InMail / Email Pitch'}
                    </span>

                    <button
                      onClick={handleCopyPitch}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: 'var(--success-50)',
                        color: 'var(--success-600)',
                        border: '1px solid var(--success-100)',
                      }}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  {pitchResult.subject && (
                    <div
                      className="p-2.5 rounded-lg text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-primary)',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Subject: </span>
                      {pitchResult.subject}
                    </div>
                  )}

                  <div
                    className="p-4 rounded-lg text-sm leading-relaxed font-sans whitespace-pre-wrap"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-primary)',
                    }}
                  >
                    {pitchResult.content}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="h-[400px] p-8 rounded-xl flex flex-col items-center justify-center text-center space-y-3"
              style={{ backgroundColor: 'var(--bg-primary)', border: '2px dashed var(--border-primary)' }}
            >
              <Users className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No Contact Selected</h3>
              <p className="text-xs max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                Select a contact from your network to draft personalized outreach.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
