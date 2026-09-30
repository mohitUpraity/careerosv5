import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '../firebase';

export interface ProfileMode {
  id: string;
  name: string;
  role: string;
  type: 'candidate' | 'coworker';
  avatar: string;
  githubUser: string;
}

const DEFAULT_CANDIDATE: ProfileMode = {
  id: 'dev-user-0000-0000-0000-000000000001',
  name: 'Mohit Upraity',
  role: 'AI / Distributed Systems Engineer',
  type: 'candidate',
  avatar: 'https://github.com/mohitUpraity.png',
  githubUser: 'mohitUpraity'
};

const COWORKER_BENCHMARK: ProfileMode = {
  id: 'coworker-benchmark-0000-0000-000000000002',
  name: 'Coworker (Benchmark Peer)',
  role: 'Staff ML Engineer',
  type: 'coworker',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  githubUser: 'coworker-benchmark'
};

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  activeProfile: ProfileMode;
  isLoggedIn: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: (profileType: 'candidate' | 'coworker') => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProfileMode>(DEFAULT_CANDIDATE);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
          // Update candidate profile name/avatar from Google
          setActiveProfile(prev => ({
            ...prev,
            id: firebaseUser.uid,
            name: firebaseUser.displayName || prev.name,
            avatar: firebaseUser.photoURL || prev.avatar,
          }));
        } catch (err) {
          console.error('Failed to get Firebase ID token:', err);
        }
      } else {
        setUser(null);
        setIdToken(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      setUser(result.user);
      setIdToken(token);
      setActiveProfile({
        id: result.user.uid,
        name: result.user.displayName || 'Authenticated User',
        role: 'Full Stack & AI Engineer',
        type: 'candidate',
        avatar: result.user.photoURL || 'https://github.com/mohitUpraity.png',
        githubUser: 'mohitUpraity'
      });
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIdToken(null);
    setActiveProfile(DEFAULT_CANDIDATE);
  };

  const switchProfile = (profileType: 'candidate' | 'coworker') => {
    if (profileType === 'candidate') {
      if (user) {
        setActiveProfile({
          id: user.uid,
          name: user.displayName || 'Mohit Upraity',
          role: 'AI / Distributed Systems Engineer',
          type: 'candidate',
          avatar: user.photoURL || 'https://github.com/mohitUpraity.png',
          githubUser: 'mohitUpraity'
        });
      } else {
        setActiveProfile(DEFAULT_CANDIDATE);
      }
    } else {
      setActiveProfile(COWORKER_BENCHMARK);
    }
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': activeProfile.id,
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    return headers;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        activeProfile,
        isLoggedIn: !!user,
        loginWithGoogle,
        logout,
        switchProfile,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
