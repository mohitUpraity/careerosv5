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
  const [githubUser, setGithubUser] = useState('mohitUpraity');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg p-6 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Glowing top line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Database Reset & Fresh Start</h3>
            <p className="text-xs text-slate-400">Purge stale graph data and re-index clean candidate profile</p>
          </div>
        </div>

        {actionStep === 'confirm' && (
          <div className="space-y-4 text-sm text-slate-300">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex gap-2.5 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Clean Slate Guarantee</p>
                <p className="mt-0.5 text-slate-300">
                  This will wipe all existing nodes and relationships for the active profile ({activeProfile.name}) in Neo4j AuraDB and rebuild clean schemas.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Github className="w-4 h-4 text-emerald-400" />
                GitHub Username to Index:
              </label>
              <input
                type="text"
                value={githubUser}
                onChange={(e) => setGithubUser(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 text-sm"
                placeholder="e.g. mohitUpraity"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-cyan-400" />
                LinkedIn Connections.csv (Optional):
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeDatabase}
                disabled={loading}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Wipe & Start Fresh
              </button>
            </div>
          </div>
        )}

        {actionStep === 'progress' && (
          <div className="py-8 text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-200">{statusMessage}</p>
            <p className="text-xs text-slate-500">Communicating with Neo4j AuraDB cloud instance...</p>
          </div>
        )}

        {actionStep === 'done' && (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-base font-semibold text-slate-100">Database Fresh Start Complete!</h4>
            <p className="text-xs text-slate-400">
              All stale records removed. Fresh graph seeded and ready for match analysis.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20"
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
