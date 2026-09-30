export type GraphNodeType = 'Candidate' | 'Project' | 'Skill' | 'Company' | 'Contact' | 'Education' | 'Benchmark';

export interface GraphNode {
  id: string;
  label: string;
  name?: string;
  type: GraphNodeType;
  category?: string;
  summary?: string;
  url?: string;
  repo_url?: string;
  role?: string;
  company?: string;
  headline?: string;
  proficiency?: number;
  val?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: any;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  relation?: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Contact {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  company: string;
  position: string;
  connected_on?: string;
  url?: string;
  alumni_match?: boolean;
}

export interface SkillMatch {
  skill: string;
  matched: boolean;
  code_evidence?: string;
  repo_name?: string;
  confidence?: number;
}

export interface MatchAnalysisResponse {
  job_title: string;
  company: string;
  match_score: number;
  summary: string;
  matched_skills: SkillMatch[];
  missing_skills: string[];
  key_strengths: string[];
  gap_recommendations: string[];
  peer_comparison?: {
    coworker_score?: number;
    advantage_summary?: string;
    differentiators?: string[];
  };
}

export interface PitchResponse {
  pitch_type: 'linkedin' | 'inmail' | 'email';
  subject?: string;
  content: string;
  character_count?: number;
}

export interface ResumeBullet {
  bullet: string;
  code_evidence_url?: string;
  repo?: string;
  impact_score?: number;
}

export interface TailoredResumeResponse {
  candidate_name: string;
  target_role: string;
  target_company: string;
  ats_score: number;
  summary: string;
  experience_bullets: ResumeBullet[];
  highlighted_projects: Array<{
    title: string;
    description: string;
    tech_stack: string[];
    repo_url: string;
    bullets: string[];
  }>;
  highlighted_skills: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  isBenchmarkPeer?: boolean;
}
