import React, { useEffect, useState } from 'react';
import { BadgeCheck, ShieldCheck, ArrowRight, LoaderCircle, CircleHelp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { UserProfileDetails, VerifiedSkill } from '../../types';
import { WorkspacePageHeader } from '../WorkspaceUI';

interface SkillProofProps { onStartAssessment: (skill: string) => void; onError: (message: string) => void; }

export const SkillProof: React.FC<SkillProofProps> = ({ onStartAssessment, onError }) => {
  const { getAuthHeaders, activeProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiService.getProfileDetails(getAuthHeaders()).then(result => { if (active) setProfile(result.profile); })
      .catch(error => { if (active) onError(error.message || 'Could not load your skills.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeProfile.id]);

  const verified: VerifiedSkill[] = profile?.verified_skills || [];
  const verifiedNames = new Set(verified.map(skill => skill.name.trim().toLowerCase()));
  const claimed = (profile?.skills || []).filter(skill => !verifiedNames.has(skill.trim().toLowerCase()));
  const rows = (skills: string[], isVerified: boolean) => skills.map(skill => {
    const proof = verified.find(item => item.name.trim().toLowerCase() === skill.toLowerCase());
    return <div className="skill-proof-row" key={skill}>
      <span className={`skill-proof-icon ${isVerified ? 'is-verified' : ''}`}>{isVerified ? <ShieldCheck size={18} /> : <CircleHelp size={18} />}</span>
      <div className="skill-proof-copy"><strong>{skill}</strong><span>{isVerified ? `Interview verified · ${proof?.verification_score ?? '—'}/100` : 'Claimed · not assessed'}</span></div>
      {isVerified ? <span className="skill-proof-status">Verified</span> : <button type="button" className="dashboard-button dashboard-button-primary" onClick={() => onStartAssessment(skill)}>Prove skill <ArrowRight size={15} /></button>}
    </div>;
  });
  return <div className="dashboard-view ws-page skill-proof-page space-y-6 max-w-7xl mx-auto">
    <WorkspacePageHeader page="skill-proof" title="Skill Proof" description="Turn skills you claim into skills you can demonstrate. Each assessment uses a strict technical interview with follow-up questions and a scored evaluation." />
    <div className="skill-proof-note"><BadgeCheck size={18} /><span><strong>How verification works</strong> Complete a live camera-and-microphone assessment. Verification requires a skill-specific score of 75/100, at least three demonstrated answers, zero integrity warnings, and a submitted code solution for programming skills.</span></div>
    {loading ? <div className="skill-proof-loading"><LoaderCircle className="animate-spin" size={20} /> Loading your skills…</div> : <div className="skill-proof-columns">
      <section className="skill-proof-card"><header><div><h2>Claimed skills</h2><p>Choose any skill to start an assessment.</p></div><span>{claimed.length}</span></header>{claimed.length ? rows(claimed, false) : <p className="skill-proof-empty">No claimed skills. Add skills under Profile & Preferences → Skills.</p>}</section>
      <section className="skill-proof-card"><header><div><h2>Verified skills</h2><p>Skills demonstrated in a CareerOS interview.</p></div><span>{verified.length}</span></header>{verified.length ? rows(verified.map(skill => skill.name), true) : <p className="skill-proof-empty">Your passed skill assessments will appear here.</p>}</section>
    </div>}
  </div>;
};
