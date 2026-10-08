import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, CircleHelp, Network, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { UserProfileDetails, MarketIntelligenceResponse } from '../../types';
import { ProfileAnalysis, apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type Props = { profile: UserProfileDetails | null; marketIntel: MarketIntelligenceResponse | null };

const salaryBands = [
  { max: 1, low: 4, high: 9 },
  { max: 3, low: 6, high: 15 },
  { max: 5, low: 10, high: 24 },
  { max: 8, low: 18, high: 40 },
  { max: Infinity, low: 30, high: 65 },
];

const yearsInExperience = (profile: UserProfileDetails | null) => {
  const entries = profile?.experience || [];
  let earliest = Infinity;
  let latest = 0;
  for (const item of entries) {
    const start = item.start_date ? Date.parse(item.start_date) : NaN;
    const end = item.is_current || !item.end_date ? Date.now() : Date.parse(item.end_date);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      earliest = Math.min(earliest, start);
      latest = Math.max(latest, end);
    }
  }
  return earliest === Infinity ? null : Math.min(40, Math.max(0, (latest - earliest) / (365.25 * 24 * 60 * 60 * 1000)));
};

const lpa = (value: number) => `₹${value.toFixed(value % 1 ? 1 : 0)} LPA`;

export const SalaryOutlook: React.FC<Props> = ({ profile, marketIntel }) => {
  const { getAuthHeaders } = useAuth();
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [currentCtc, setCurrentCtc] = useState('');
  useEffect(() => {
    apiService.getAnalysis(getAuthHeaders()).then(setAnalysis).catch(() => setAnalysis(null));
  }, []);

  const years = yearsInExperience(profile);
  const band = salaryBands.find(item => years === null || years <= item.max) || salaryBands[0];
  const skills = profile?.skills || [];
  const projects = profile?.projects || [];
  const verifiedCount = profile?.verified_skills?.length || 0;
  const experienceFactor = years === null ? 0.88 : Math.min(1.22, 0.88 + years * 0.045);
  const evidenceFactor = 1 + Math.min(0.12, projects.length * 0.025 + verifiedCount * 0.015);
  const isTechRole = /engineer|developer|software|data|machine learning|ai|devops|product/i.test(profile?.preferences?.primary_role || profile?.headline || '');
  const roleFactor = isTechRole ? 1 : 0.88;
  const estimateLow = band.low * experienceFactor * evidenceFactor * roleFactor;
  const estimateHigh = band.high * experienceFactor * evidenceFactor * roleFactor;
  const existingSkills = skills.map(s => s.toLowerCase());
  const nextSkill = (marketIntel?.market_summary?.high_roi_unlocks || []).find(item =>
    !existingSkills.some(skill => skill.includes(item.skill.split(/[&/(]/)[0].trim().toLowerCase()))
  );
  const connectionCount = analysis?.connections_count || 0;
  const confidence = years === null ? 'Low' : (projects.length + skills.length >= 5 ? 'Medium' : 'Low');
  const currency = (profile?.preferences?.target_country || 'India').toLowerCase();

  const range = useMemo(() => {
    const input = Number(currentCtc);
    if (input > 0) return { low: input * 1.1, high: input * 1.25 };
    return { low: estimateLow, high: estimateHigh };
  }, [currentCtc, estimateLow, estimateHigh]);

  const actions = [
    { title: nextSkill ? `Add proof for ${nextSkill.skill}` : 'Ship one measurable project', detail: nextSkill?.recommended_project?.title || 'Build a production-style project and publish code, tests, and a short case study.', impact: `Scenario: ${lpa(range.low * 1.03)} – ${lpa(range.high * 1.08)} (+3–8%)`, icon: Rocket },
    { title: 'Make existing work measurable', detail: 'Add scale, latency, reliability, adoption, or cost numbers to project and experience bullets.', impact: `Scenario: ${lpa(range.low * 1.02)} – ${lpa(range.high * 1.05)} (+2–5%)`, icon: ShieldCheck },
    { title: 'Use warm connections for targeted roles', detail: `${connectionCount} connections are in your profile. Prioritise relevant people at hiring companies and ask for role context or a referral.`, impact: 'Can improve interview access; no direct CTC uplift assumed', icon: Network },
  ];

  return <section className="space-y-5" aria-label="CTC outlook">
    <div className="rounded-3xl border p-6 md:p-8" style={{ background: 'linear-gradient(120deg, color-mix(in srgb, var(--bg-primary) 92%, #2563eb), var(--bg-primary))', borderColor: 'var(--border-primary)' }}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <span className="ws-eyebrow"><BriefcaseBusiness size={14} /> PERSONAL COMPENSATION OUTLOOK</span>
          <h2 className="mt-2 text-2xl md:text-3xl font-black" style={{ color: 'var(--text-primary)' }}>Your next-role CTC range</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>A rough planning estimate from your experience, target role, skills and project evidence. It is not a live salary survey or an offer prediction.</p>
        </div>
        <div className="rounded-2xl border p-4 min-w-[230px]" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Indicative annual CTC</span>
          <div className="mt-1 text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{lpa(range.low)} – {lpa(range.high)}</div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{profile?.preferences?.primary_role || 'Software role'} · {years === null ? 'Experience dates missing' : `${years.toFixed(1)} yrs inferred`} · {confidence} confidence</span>
        </div>
      </div>
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <label htmlFor="current-ctc" className="font-semibold">Current CTC (optional, LPA):</label>
        <input id="current-ctc" type="number" min="0" step="0.1" value={currentCtc} onChange={e => setCurrentCtc(e.target.value)} placeholder="Use profile-based estimate" className="rounded-lg border px-3 py-2 w-52" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }} />
        {currentCtc && <button className="underline" onClick={() => setCurrentCtc('')}>Reset estimate</button>}
      </div>
    </div>

    {currency !== 'india' && <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>Your target country is {profile?.preferences?.target_country}. This first version only has an India INR planning range; switch to an India target to interpret the estimate.</div>}

    <div className="grid md:grid-cols-3 gap-4">
      <div className="rounded-2xl border p-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Profile signals</span><strong className="block mt-1 text-xl">{skills.length} skills · {projects.length} projects</strong><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{verifiedCount} verified skills · {connectionCount} connections</span></div>
      <div className="rounded-2xl border p-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Market sample</span><strong className="block mt-1 text-xl">{marketIntel?.analyzed_jobs_count ?? 0} roles analysed</strong><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Used to identify skill demand, not salary levels</span></div>
      <div className="rounded-2xl border p-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Confidence</span><strong className="block mt-1 text-xl">{confidence}</strong><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Improve it with complete experience dates and project proof</span></div>
    </div>

    <div>
      <div className="flex items-start gap-2 mb-3"><Sparkles size={18} className="text-amber-500 mt-0.5" /><div><h3 className="font-bold">Kaunsi cheezen next range tak le ja sakti hain?</h3><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>These actions strengthen role fit and negotiating evidence. Their impact is not additive or guaranteed.</p></div></div>
      <div className="grid lg:grid-cols-3 gap-4">{actions.map(({ title, detail, impact, icon: Icon }) => <article key={title} className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}><div className="flex items-center justify-between"><span className="dashboard-soft-icon is-violet"><Icon size={18} /></span><ArrowUpRight size={16} style={{ color: 'var(--text-secondary)' }} /></div><h4 className="font-bold">{title}</h4><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{detail}</p><p className="text-xs font-semibold text-emerald-600">{impact}</p></article>)}</div>
    </div>

    <div className="rounded-xl border p-4 flex gap-3 text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}><CircleHelp size={16} className="shrink-0" /><p>Estimate uses a broad India tech-role baseline by inferred experience band, adjusted slightly for role fit and evidence in your profile. The +3–8% and +2–5% action figures are illustrative planning scenarios, not measured market premiums, and should not be added together. Connection count affects access to opportunities, not the salary number. Real CTC depends on location, company, level, interview performance, and variable pay; verify against current offers and salary data.</p></div>
  </section>;
};
