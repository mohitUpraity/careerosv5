import { GraphData, Contact, MatchAnalysisResponse, PitchResponse, TailoredResumeResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface ProfileAnalysis {
  repos_count: number;
  connections_count: number;
  alumni_count: number;
  top_skills: string[];
  graph_nodes_count: number;
}

export const apiService = {
  async getGraph(headers: Record<string, string>): Promise<GraphData> {
    const res = await fetch(`${API_BASE}/api/v1/profile/graph`, { headers });
    if (!res.ok) throw new Error(`Failed to load graph (${res.status})`);
    return await res.json();
  },

  async getAnalysis(headers: Record<string, string>): Promise<ProfileAnalysis> {
    const res = await fetch(`${API_BASE}/api/v1/profile/analysis`, { headers });
    if (!res.ok) throw new Error(`Failed to load profile analysis (${res.status})`);
    const data = await res.json();
    return {
      repos_count: data.repos_count ?? data.metrics?.total_projects ?? 4,
      connections_count: data.connections_count ?? data.metrics?.network_reach_connections ?? 797,
      alumni_count: data.alumni_count ?? 12,
      top_skills: data.top_skills ?? ['Python', 'FastAPI', 'Neo4j', 'Docker'],
      graph_nodes_count: data.graph_nodes_count ?? 25,
      ...data
    };
  },

  async getConnections(query: string = '', headers: Record<string, string>): Promise<Contact[]> {
    const url = `${API_BASE}/api/v1/profile/connections?search=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to load connections (${res.status})`);
    const data = await res.json();
    return data.contacts || data.connections || [];
  },

  async analyzeMatch(
    payload: { target_company: string; target_role: string; job_description: string },
    headers: Record<string, string>
  ): Promise<MatchAnalysisResponse> {
    const res = await fetch(`${API_BASE}/api/v1/matches/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Match analysis failed (${res.status})`);
    }
    return await res.json();
  },

  async generatePitch(
    payload: {
      contact_name: string;
      contact_company: string;
      contact_role: string;
      target_role: string;
      job_description?: string;
      pitch_type: 'linkedin' | 'inmail' | 'email';
    },
    headers: Record<string, string>
  ): Promise<PitchResponse> {
    const res = await fetch(`${API_BASE}/api/v1/matches/generate-pitch`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Pitch generation failed (${res.status})`);
    }
    return await res.json();
  },

  async tailorResume(
    payload: { target_role: string; target_company: string; job_description: string },
    headers: Record<string, string>
  ): Promise<TailoredResumeResponse> {
    const res = await fetch(`${API_BASE}/api/v1/resume/tailor`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Resume tailoring failed (${res.status})`);
    }
    return await res.json();
  },

  async wipeDatabase(headers: Record<string, string>): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/api/v1/health/wipe-database`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to wipe database (${res.status})`);
    return await res.json();
  },

  async ingestGithub(username: string, headers: Record<string, string>): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/ingest/github`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ github_username: username }),
    });
    if (!res.ok) throw new Error(`GitHub ingestion failed (${res.status})`);
    return await res.json();
  },

  async ingestLinkedinCsv(file: File, headers: Record<string, string>): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Copy headers without Content-Type so browser sets multipart boundary
    const reqHeaders: Record<string, string> = {};
    if (headers['Authorization']) reqHeaders['Authorization'] = headers['Authorization'];
    if (headers['x-user-id']) reqHeaders['x-user-id'] = headers['x-user-id'];

    const res = await fetch(`${API_BASE}/api/v1/ingest/linkedin/connections`, {
      method: 'POST',
      headers: reqHeaders,
      body: formData,
    });
    if (!res.ok) throw new Error(`LinkedIn ingestion failed (${res.status})`);
    return await res.json();
  }
};
