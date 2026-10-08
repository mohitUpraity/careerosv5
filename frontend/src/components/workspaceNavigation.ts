import { LayoutDashboard, Network, Target, Send, FileText, GitCompare, Compass, UserCog, Sparkles, TrendingUp, Swords } from 'lucide-react';

export type ActiveTab = 'overview' | 'graph' | 'opportunities' | 'growth' | 'interview' | 'matcher' | 'benchmark' | 'referrals' | 'resume' | 'profile' | 'brain';

export const workspaceGroups = [
  { label: 'Workspace', items: [
    { id: 'overview', label: 'Overview', description: 'Your career at a glance', icon: LayoutDashboard },
    { id: 'graph', label: 'Knowledge Graph', description: 'Explore your skills and connections', icon: Network },
    { id: 'profile', label: 'Profile & Preferences', description: 'Your experience, goals, and preferences', icon: UserCog },
  ] },
  { label: 'Discover', items: [
    { id: 'opportunities', label: 'Opportunities Radar', description: 'Find jobs, internships, and challenges', icon: Compass },
    { id: 'matcher', label: 'Job Matchmaker', description: 'See how you fit a specific role', icon: Target },
    { id: 'referrals', label: 'Referral Hub', description: 'Find a warm introduction', icon: Send },
  ] },
  { label: 'Your next move', items: [
    { id: 'resume', label: 'Resume Studio', description: 'Build and tailor your resume', icon: FileText },
    { id: 'interview', label: 'Interview Arena', description: 'Practice for your next interview', icon: Swords },
    { id: 'growth', label: 'Career Growth', description: 'Bridge skill gaps with learning sprints', icon: TrendingUp },
    { id: 'benchmark', label: 'Benchmark Lab', description: 'Learn from a target peer', icon: GitCompare },
    { id: 'brain', label: 'Brain Chat AI', description: 'Ask your personal career co-pilot', icon: Sparkles },
  ] },
] satisfies { label: string; items: { id: ActiveTab; label: string; description: string; icon: typeof LayoutDashboard }[] }[];

export const workspacePages = workspaceGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.label })));
