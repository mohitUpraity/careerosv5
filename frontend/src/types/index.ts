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

export interface ContactInfo {
  full_name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
}

export interface ExperienceEntry {
  company: string;
  role: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  bullets: string[];
}

export interface EducationEntry {
  university: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  gpa?: string;
}

export interface ProjectEntry {
  name: string;
  tech_stack?: string;
  repo_url?: string;
  live_url?: string;
  bullets: string[];
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

export interface ResumeBlueprint {
  contact: ContactInfo;
  summary?: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  skills: SkillCategory[];
  certifications?: string[];
  achievements?: string[];
  raw_text?: string;
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
  tailored_blueprint?: ResumeBlueprint;
}

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  category: 'jobs' | 'internships' | 'hackathons' | 'opensource';
  opportunity_type: string;
  location: string;
  reward: string;
  deadline_date: string;
  deadline_formatted: string;
  days_left: number;
  is_urgent: boolean;
  urgency_level: 'normal' | 'high' | 'critical';
  source_platform: string;
  apply_url: string;
  skills_required: string[];
  matched_skills: string[];
  missing_skills: string[];
  match_score: number;
  description: string;
  eligibility?: string;
  verified?: boolean;
}

export interface OpportunitiesResponse {
  status: string;
  total: number;
  category_counts: {
    all: number;
    jobs: number;
    internships: number;
    hackathons: number;
    opensource: number;
  };
  opportunities: Opportunity[];
}

export interface UserPreferences {
  primary_role?: string;
  priority_domain?: string;
  target_country: string;
  preferred_cities: string[];
  work_modes: string[];
  preferred_roles: string[];
  opportunity_types: string[];
  experience_level?: string;
  min_salary?: string;
  priority_factor?: 'best_fit' | 'urgency' | 'compensation' | 'remote_first';
  custom_locations?: string[];
}

export interface UserProfileDetails {
  id?: string;
  full_name: string;
  email: string;
  phone?: string;
  headline?: string;
  location?: string;
  bio?: string;
  github_username?: string;
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  education?: Array<{
    university: string;
    degree?: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
    gpa?: string;
  }>;
  experience?: Array<{
    company: string;
    role?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    description?: string;
  }>;
  skills?: string[];
  preferences: UserPreferences;
}


export interface BenchmarkPeer {
  id: string;
  name: string;
  github_username: string;
  role: string;
  company: string;
  avatar_url: string;
  bio?: string;
  repos_count: number;
  skills: string[];
}

export interface SkillGapItem {
  skill: string;
  priority: 'High' | 'Medium' | 'Low';
  impact: string;
  action_item: string;
}

export interface RoadmapPhase {
  phase: string;
  milestones: string[];
}

export interface BenchmarkComparisonResult {
  candidate: {
    name: string;
    repos_count: number;
    stars_count: number;
    languages: string[];
    skills: string[];
    connections_count: number;
  };
  peer: BenchmarkPeer & {
    stars_count: number;
    languages: string[];
  };
  skill_matrix: {
    shared_skills: string[];
    candidate_unique_skills: string[];
    missing_peer_skills: string[];
    overlap_percentage: number;
  };
  ai_analysis: {
    candidate_score: number;
    peer_score: number;
    experience_gap_summary: string;
    critical_skill_gaps: SkillGapItem[];
    candidate_superpowers: string[];
    strategic_roadmap: RoadmapPhase[];
    hiring_manager_verdict: string;
  };
}
