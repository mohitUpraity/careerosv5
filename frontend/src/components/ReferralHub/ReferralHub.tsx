import { WorkspacePageHeader, WorkspaceMetrics, WorkspaceSectionHeading, WorkspaceEmptyState, WorkspaceSteps } from '../WorkspaceUI';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, CheckCircle2, 
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
  const pitchRequest = useRef(0);

  // Quick company filters
  const quickCompanies = ['All', 'Apponward', 'DRDO', 'Google', 'Microsoft', 'HCST', 'Amazon'];

  useEffect(() => {
    pitchRequest.current += 1;
    setPitchResult(null);
    setCopied(false);
    setGeneratingPitch(false);
  }, [selectedContact?.id, pitchType, targetRole]);

  useEffect(() => {
    loadConnections(searchQuery);
  }, []);

  const loadConnections = async (query: string) => {
    setLoadingContacts(true);
    try {
      const results = await apiService.getConnections(query === 'All' ? '' : query, getAuthHeaders());
      setContacts(results);
      setSelectedContact(current => results.find(contact => contact.id === current?.id) || results[0] || null);
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

    const request = ++pitchRequest.current;
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
      if (request !== pitchRequest.current) return;
      setPitchResult(res);
      onSuccess(`${pitchType === 'linkedin' ? 'LinkedIn Note' : 'InMail'} generated!`);
    } catch (err: any) {
      if (request === pitchRequest.current) onError(err.message || 'Failed to generate outreach pitch');
    } finally {
      if (request === pitchRequest.current) setGeneratingPitch(false);
    }
  };

  const handleCopyPitch = async () => {
    if (!pitchResult) return;
    try { await navigator.clipboard.writeText(pitchResult.content); }
    catch { onError('Could not copy the message. Select the draft text and copy it manually.'); return; }
    setCopied(true);
    onSuccess('Copied to clipboard!');
    
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dashboard-view ws-page dashboard-view--referrals space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <WorkspacePageHeader page="referrals" eyebrow="YOUR NETWORK, WORKING FOR YOU" title="Good opportunities start with a conversation." description="Find the right person, personalise your introduction, and take the next step with confidence." actions={<div className="ws-heading-controls">
          {quickCompanies.map((comp) => (
            <button
              key={comp}
              onClick={() => {
                setSearchQuery(comp === 'All' ? '' : comp);
                loadConnections(comp === 'All' ? '' : comp);
              }}
              className="dashboard-button "
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
        </div>} />

      {/* Main Content: Split Grid */}
      <div className="ws-referral-grid">
        {/* Left: Contacts List */}
        <div className="ws-contact-panel ws-surface">
          <WorkspaceSectionHeading title="Your connections" description={loadingContacts ? "Searching your network…" : contacts.length + " connections in this view"} />
          <form onSubmit={handleSearchSubmit} className="dashboard-referral-search relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input aria-label="Search by name, company, position..."
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
          <div className="ws-contact-list space-y-2">
            {loadingContacts ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--brand-500)', borderTopColor: 'transparent' }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Filtering contacts...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-12 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {searchQuery ? `No contacts found matching “${searchQuery}”. Try another name or company.` : 'No connections yet. Import your LinkedIn connections from Sync data to build your network.'}
              </div>
            ) : (
              contacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="ws-contact-row" role="button" tabIndex={0} aria-pressed={isSelected} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedContact(contact); } }}
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
        <div className="ws-referral-detail space-y-6">
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
                  <input aria-label="Your Target Role"
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
            <WorkspaceEmptyState icon={Users} title="Turn a connection into a conversation" description="Choose someone from your network to create a thoughtful introduction based on the role you want."><div className="ws-preview-checks"><span><CheckCircle2 size={16} />An introduction with context</span><span><Building2 size={16} />A relevant company and role</span><span><Send size={16} />A draft you can review and copy</span></div></WorkspaceEmptyState>
          )}
        </div>
      </div>
    </div>
  );
};
