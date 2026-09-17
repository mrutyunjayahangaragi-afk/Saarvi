// DocEase Phase 6 Auth and Workspace Types

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'PENDING';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  status?: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConversionHistoryRecord {
  id: string;
  userId: string;
  toolId: string;
  toolName?: string;
  inputFilename: string;
  outputFilename: string;
  inputSize: number;
  outputSize: number;
  status: 'Completed' | 'Failed';
  processingTimeMs: number;
  createdAt: string;
}

export interface SavedResumeDraft {
  id: string;
  userId: string;
  title: string;
  template: string;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  userId: string;
  autoDownload: boolean;
  theme: 'light';
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  status?: UserAccountStatus;
  createdAt: string;
}
