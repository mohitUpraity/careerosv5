import React, { useState } from 'react';
import { Trash2, AlertTriangle, RefreshCw, Upload, Github, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface StartFreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const StartFreshModal: React.FC<StartFreshModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const { getAuthHeaders, activeProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [actionStep, setActionStep] = useState<'confirm' | 'progress' | 'done'>('confirm');
  const [statusMessage, setStatusMessage] = useState('');
  const [githubUser, setGithubUser] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleWipeDatabase = async () => {
    setLoading(true);
    setActionStep('progress');
    setStatusMessage('Wiping Neo4j AuraDB graph and re-initializing constraints...');
    try {
      await apiService.wipeDatabase(getAuthHeaders());
      setStatusMessage('Graph successfully wiped! Re-seeding candidate repos and LinkedIn network...');
      
      // Auto re-ingest default candidate repos
      await apiService.ingestGithub(githubUser, getAuthHeaders());
      
      if (selectedFile) {
        setStatusMessage('Uploading and parsing LinkedIn Connections CSV...');
        await apiService.ingestLinkedinCsv(selectedFile, getAuthHeaders());
      }

      setActionStep('done');
      onSuccess('CareerOS graph reset complete! Clean database ready.');
    } catch (err: any) {
      console.error(err);
      onError(err.message || 'Failed to complete reset');
      setActionStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div
        className="relative w-full max-w-lg p-6 rounded-xl shadow-modal overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: 'var(--error-50)', color: 'var(--error-600)' }}
          >
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Database Reset & Fresh Start
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Purge stale graph data and re-index clean candidate profile
            </p>
          </div>
        </div>

        {actionStep === 'confirm' && (
          <div className="space-y-4 text-sm" style={{ color: 'var(--text-primary)' }}>
            <div
              className="p-3.5 rounded-lg text-xs flex gap-2.5 items-start"
              style={{
                backgroundColor: 'var(--warning-50)',
                border: '1px solid var(--warning-100)',
              }}
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--warning-600)' }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--warning-600)' }}>Warning</p>
                <p className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  This will wipe all existing nodes and relationships for the active profile ({activeProfile.name}) in Neo4j AuraDB and rebuild clean schemas.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Github className="w-4 h-4" />
                GitHub Username to Index:
              </label>
              <input
                type="text"
                value={githubUser}
                onChange={(e) => setGithubUser(e.target.value)}
                className="input-base w-full"
                placeholder="e.g. mohitUpraity"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Upload className="w-4 h-4" />
                LinkedIn Connections.csv (Optional):
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeDatabase}
                disabled={loading}
                className="px-4 py-2.5 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"
                style={{ backgroundColor: 'var(--error-600)' }}
              >
                <Trash2 className="w-4 h-4" />
                Wipe & Start Fresh
              </button>
            </div>
          </div>
        )}

        {actionStep === 'progress' && (
          <div className="py-8 text-center space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto" style={{ color: 'var(--brand-600)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{statusMessage}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Communicating with Neo4j AuraDB cloud instance...
            </p>
          </div>
        )}

        {actionStep === 'done' && (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: 'var(--success-600)' }} />
            <h4 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Database Fresh Start Complete!
            </h4>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              All stale records removed. Fresh graph seeded and ready for match analysis.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="px-5 py-2.5 text-white rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'var(--brand-600)' }}
              >
                Reload Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
