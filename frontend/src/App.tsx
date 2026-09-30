import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { KnowledgeGraph } from './components/KnowledgeGraph/KnowledgeGraph';
import { JobMatchmaker } from './components/JobMatchmaker/JobMatchmaker';
import { ReferralHub } from './components/ReferralHub/ReferralHub';
import { ResumeStudio } from './components/ResumeStudio/ResumeStudio';
import { StartFreshModal } from './components/StartFreshModal';
import { SyncGitHubModal } from './components/SyncGitHubModal';
import { Toast, ToastMessage } from './components/Toast';
import { apiService, ProfileAnalysis } from './services/api';
import { GraphData } from './types';

const MainLayout: React.FC = () => {
  const { getAuthHeaders, activeProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('graph');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSyncGitHubModalOpen, setIsSyncGitHubModalOpen] = useState(false);

  // App data state
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Cross-component parameters
  const [resumeParams, setResumeParams] = useState<{ role: string; company: string; jd: string }>({
    role: 'Senior Backend / Full Stack Engineer',
    company: 'Apponward Technologies',
    jd: '',
  });
  const [referralCompanyFilter, setReferralCompanyFilter] = useState<string>('');

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [graph, analysisData] = await Promise.all([
        apiService.getGraph(headers).catch(() => ({ nodes: [], links: [] })),
        apiService.getAnalysis(headers).catch(() => ({
          repos_count: 3,
          connections_count: 797,
          alumni_count: 12,
          top_skills: ['FastAPI', 'Python', 'Neo4j', 'Docker'],
          graph_nodes_count: 42,
        })),
      ]);
      setGraphData(graph);
      setAnalysis(analysisData);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to load profile graph data');
    } finally {
      setLoading(false);
    }
  };

  // Reload when profile changes (Candidate vs Coworker Benchmark)
  useEffect(() => {
    loadProfileData();
  }, [activeProfile.id]);

  const handleSelectTailorResume = (role: string, company: string, jd: string) => {
    setResumeParams({ role, company, jd });
    setActiveTab('resume');
  };

  const handleNavigateToReferrals = (company: string) => {
    setReferralCompanyFilter(company);
    setActiveTab('referrals');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
      {/* Top Navigation */}
      <Navbar
        analysis={analysis}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        onOpenSyncGitHub={() => setIsSyncGitHubModalOpen(true)}
        onRefreshData={loadProfileData}
        loading={loading}
      />

      {/* Main Content Area: Sidebar + Active View */}
      <div className="flex-1 flex flex-col lg:flex-row">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto min-h-[calc(100vh-57px)]">
          {activeTab === 'graph' && (
            <KnowledgeGraph 
              graphData={graphData} 
              loading={loading} 
              onOpenSyncGitHub={() => setIsSyncGitHubModalOpen(true)}
            />
          )}

          {activeTab === 'matcher' && (
            <JobMatchmaker
              onSelectTailorResume={handleSelectTailorResume}
              onNavigateToReferrals={handleNavigateToReferrals}
              onError={(msg) => addToast('error', msg)}
              onSuccess={(msg) => addToast('success', msg)}
            />
          )}

          {activeTab === 'referrals' && (
            <ReferralHub
              initialCompanyFilter={referralCompanyFilter}
              onError={(msg) => addToast('error', msg)}
              onSuccess={(msg) => addToast('success', msg)}
            />
          )}

          {activeTab === 'resume' && (
            <ResumeStudio
              initialRole={resumeParams.role}
              initialCompany={resumeParams.company}
              initialJd={resumeParams.jd}
              onError={(msg) => addToast('error', msg)}
              onSuccess={(msg) => addToast('success', msg)}
            />
          )}
        </main>
      </div>

      {/* Sync GitHub Modal */}
      <SyncGitHubModal
        isOpen={isSyncGitHubModalOpen}
        onClose={() => setIsSyncGitHubModalOpen(false)}
        onSyncSuccess={() => {
          loadProfileData();
        }}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      {/* Database Reset & Fresh Start Modal */}
      <StartFreshModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={(msg) => {
          addToast('success', msg);
          loadProfileData();
        }}
        onError={(msg) => addToast('error', msg)}
      />

      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
};

import { LandingPage } from './components/LandingPage';
import { Loader2 } from 'lucide-react';

const RootRouter: React.FC = () => {
  const { isLoggedIn, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-400">Loading CareerOS Engine...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LandingPage />;
  }

  return <MainLayout />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RootRouter />
    </AuthProvider>
  );
};

export default App;

