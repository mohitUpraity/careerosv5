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
      repos_count: data.repos_count ?? data.metrics?.total_projects ?? 0,
      connections_count: data.connections_count ?? data.metrics?.network_reach_connections ?? 0,
      alumni_count: data.alumni_count ?? 0,
      top_skills: data.top_skills ?? [],
      graph_nodes_count: data.graph_nodes_count ?? 0,
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

  async getMasterResume(headers: Record<string, string>): Promise<{
    status: string;
    has_master_resume: boolean;
    blueprint: any | null;
  }> {
    const res = await fetch(`${API_BASE}/api/v1/resume/master`, { headers });
    if (!res.ok) throw new Error(`Failed to load master resume (${res.status})`);
    return await res.json();
  },

  async updateMasterResume(blueprint: any, headers: Record<string, string>): Promise<{
    status: string;
    message: string;
    blueprint: any;
  }> {
    const res = await fetch(`${API_BASE}/api/v1/resume/master`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blueprint),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to update master resume (${res.status})`);
    }
    return await res.json();
  },

  async uploadResumePdf(file: File, headers: Record<string, string>): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Copy auth headers but do NOT set Content-Type header so browser sets multipart/form-data boundary automatically
    const reqHeaders: Record<string, string> = {};
    if (headers['Authorization'] || headers['authorization']) {
      reqHeaders['Authorization'] = headers['Authorization'] || headers['authorization'];
    }
    if (headers['x-user-id']) {
      reqHeaders['x-user-id'] = headers['x-user-id'];
    }

    const res = await fetch(`${API_BASE}/api/v1/ingest/resume`, {
      method: 'POST',
      headers: reqHeaders,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Resume upload failed (${res.status})`);
    }
    return await res.json();
  },

  async resetProfile(headers: Record<string, string>): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/api/v1/profile/reset`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to reset profile (${res.status})`);
    return await res.json();
  },

  async wipeDatabase(headers: Record<string, string>): Promise<{ status: string; message: string }> {
    return await this.resetProfile(headers);
  },

  async getGithubSyncStatus(username: string, headers: Record<string, string>, token?: string): Promise<{
    status: string;
    username: string;
    total_github_repos: number;
    synced_projects_count: number;
    unsynced_repos_count: number;
    synced_projects: Array<{ id: string; name: string; repo_url: string; primary_language: string; stars?: number }>;
  }> {
    const params = new URLSearchParams({ username });
    if (token) params.append('token', token);
    const res = await fetch(`${API_BASE}/api/v1/ingest/github/status?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`Failed to load GitHub sync status (${res.status})`);
    return await res.json();
  },

  async ingestGithub(
    username: string, 
    headers: Record<string, string>, 
    maxRepos: number = 0, 
    token?: string,
    includeForks: boolean = false,
    onlyUnsynced: boolean = false
  ): Promise<{
    status: string;
    username: string;
    repos_processed: number;
    repos_total_found: number;
    new_repos_synced: number;
    already_synced_count: number;
    skills_extracted: number;
    projects: any[];
    graph_nodes_merged: number;
  }> {
    const res = await fetch(`${API_BASE}/api/v1/ingest/github`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        username, 
        max_repos: maxRepos,
        github_token: token || undefined,
        include_forks: includeForks,
        only_unsynced: onlyUnsynced
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `GitHub ingestion failed (${res.status})`);
    }
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
  },

  async getBenchmarkPeers(headers: Record<string, string>): Promise<{ peers: any[]; total: number }> {
    const res = await fetch(`${API_BASE}/api/v1/benchmark/peers`, { headers });
    if (!res.ok) throw new Error(`Failed to load benchmark peers (${res.status})`);
    return await res.json();
  },

  async addBenchmarkPeer(
    payload: { github_username?: string; name?: string; role?: string; company?: string; custom_skills?: string[] },
    headers: Record<string, string>
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/benchmark/peers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to add benchmark peer (${res.status})`);
    }
    return await res.json();
  },

  async getBenchmarkComparison(peerId?: string, headers: Record<string, string> = {}): Promise<any> {
    const url = peerId 
      ? `${API_BASE}/api/v1/benchmark/compare?peer_id=${encodeURIComponent(peerId)}`
      : `${API_BASE}/api/v1/benchmark/compare`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to generate comparison (${res.status})`);
    }
    return await res.json();
  },

  async deleteBenchmarkPeer(peerId: string, headers: Record<string, string>): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/benchmark/peers/${encodeURIComponent(peerId)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to delete peer (${res.status})`);
    return await res.json();
  }
};
