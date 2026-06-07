import { httpClient } from '../api/http';
import type {
  AccountRecord,
  AuthResult,
  LeaderboardEntry,
  LoginPayload,
  RegisterPayload,
} from '../api/authApi';
import type { AuthGateway } from './types';

const AUTH_SESSION_STORAGE_KEY = 'mock-auth-session';
const AUTH_ACCOUNT_STORAGE_KEY = 'backend-auth-account';

interface AuthSession {
  accountId: string;
  email: string;
  nickname: string;
  loggedInAt: string;
}

function saveAuthSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function saveAccount(account: AccountRecord | null) {
  if (!account) {
    localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_ACCOUNT_STORAGE_KEY, JSON.stringify(account));
}

function loadAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

function loadAccount(): AccountRecord | null {
  const raw = localStorage.getItem(AUTH_ACCOUNT_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AccountRecord;
  } catch {
    localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY);
    return null;
  }
}

export const backendAuthGateway: AuthGateway = {
  async register(payload: RegisterPayload): Promise<AuthResult> {
    const response = await httpClient.post<{ ok: boolean; account?: AccountRecord; message?: string }>('/api/auth/register', payload);
    if (!response.data.ok || !response.data.account) {
      return { ok: false, message: response.data.message ?? '注册失败' };
    }
    const account = response.data.account;
    saveAuthSession({
      accountId: account.id,
      email: account.email,
      nickname: account.nickname,
      loggedInAt: new Date().toISOString(),
    });
    saveAccount(account);
    return { ok: true, account };
  },

  async login(payload: LoginPayload): Promise<AuthResult> {
    const response = await httpClient.post<{ ok: boolean; account?: AccountRecord; message?: string }>('/api/auth/login', payload);
    if (!response.data.ok || !response.data.account) {
      return { ok: false, message: response.data.message ?? '登录失败' };
    }
    const account = response.data.account;
    saveAuthSession({
      accountId: account.id,
      email: account.email,
      nickname: account.nickname,
      loggedInAt: new Date().toISOString(),
    });
    saveAccount(account);
    return { ok: true, account };
  },

  async logout(): Promise<void> {
    saveAuthSession(null);
    saveAccount(null);
  },

  async restoreCurrentAccount(): Promise<AccountRecord | null> {
    const session = loadAuthSession();
    if (!session) return null;

    try {
      const response = await httpClient.get<{ ok: boolean; account: AccountRecord }>(`/api/auth/accounts/${session.accountId}`);
      if (!response.data.ok) {
        saveAuthSession(null);
        saveAccount(null);
        return null;
      }
      saveAccount(response.data.account);
      return response.data.account;
    } catch {
      const cached = loadAccount();
      if (cached && cached.id === session.accountId) {
        return cached;
      }
      saveAuthSession(null);
      saveAccount(null);
      return null;
    }
  },

  getCurrentAccount(): AccountRecord | null {
    const session = loadAuthSession();
    if (!session) return null;
    const account = loadAccount();
    if (!account || account.id !== session.accountId) {
      saveAuthSession(null);
      saveAccount(null);
      return null;
    }
    return account;
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const response = await httpClient.get<{ ok: boolean; entries: LeaderboardEntry[] }>('/api/leaderboard');
    return response.data.entries;
  },

  async recordScore(accountId: string, score: number): Promise<AccountRecord | null> {
    const response = await httpClient.post<{ ok: boolean; account: AccountRecord }>(`/api/leaderboard/${accountId}/score`, { score });
    saveAccount(response.data.account);
    return response.data.account;
  },
};
