import React from 'react';
import { NoteGPTSkillStudio } from './NoteGPTSkillStudio';

interface NoteGPTModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName: string;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const NoteGPTModal: React.FC<NoteGPTModalProps> = ({
  isOpen,
  onClose,
  skillName,
  onSuccessToast,
  onErrorToast
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="w-full max-w-6xl my-auto rounded-3xl border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <NoteGPTSkillStudio
            initialSkill={skillName}
            onSuccessToast={onSuccessToast}
            onErrorToast={onErrorToast}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
