export interface AccountRecord {
  id: string;
  email: string;
  passwordMock: string;
  nickname: string;
  createdAt: string;
  updatedAt: string;
  bestScore: number;
  bestScoreUpdatedAt: string | null;
}

export interface AuthSession {
  accountId: string;
  email: string;
  nickname: string;
  loggedInAt: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LeaderboardEntry {
  rank: number;
  accountId: string;
  nickname: string;
  emailMasked: string;
  bestScore: number;
  updatedAt: string | null;
}

export interface AuthFailure {
  ok: false;
  message: string;
}

export interface AuthSuccess {
  ok: true;
  account: AccountRecord;
}

export type AuthResult = AuthFailure | AuthSuccess;

const ACCOUNTS_STORAGE_KEY = 'mock-auth-accounts';
const AUTH_SESSION_STORAGE_KEY = 'mock-auth-session';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function loadAccounts(): AccountRecord[] {
  const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as AccountRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    return [];
  }
}

function saveAccounts(accounts: AccountRecord[]) {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function saveAuthSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
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

function toMaskedEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] ?? '*'}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

export function getCurrentAccount(): AccountRecord | null {
  const session = loadAuthSession();
  if (!session) return null;

  const account = loadAccounts().find((item) => item.id === session.accountId);
  if (!account) {
    saveAuthSession(null);
    return null;
  }

  return account;
}

export async function registerAccount(payload: RegisterPayload): Promise<AuthResult> {
  const accounts = loadAccounts();
  const email = normalizeEmail(payload.email);

  if (accounts.some((item) => normalizeEmail(item.email) === email)) {
    return { ok: false, message: '该邮箱已注册，请直接登录。' };
  }

  const now = new Date().toISOString();
  const account: AccountRecord = {
    id: `acc-${Date.now()}`,
    email,
    passwordMock: payload.password,
    nickname: payload.nickname.trim(),
    createdAt: now,
    updatedAt: now,
    bestScore: 0,
    bestScoreUpdatedAt: null,
  };

  accounts.push(account);
  saveAccounts(accounts);
  saveAuthSession({
    accountId: account.id,
    email: account.email,
    nickname: account.nickname,
    loggedInAt: now,
  });

  return { ok: true, account };
}

export async function loginAccount(payload: LoginPayload): Promise<AuthResult> {
  const email = normalizeEmail(payload.email);
  const account = loadAccounts().find((item) => normalizeEmail(item.email) === email);

  if (!account) {
    return { ok: false, message: '该邮箱尚未注册。' };
  }

  if (account.passwordMock !== payload.password) {
    return { ok: false, message: '密码错误，请重新输入。' };
  }

  saveAuthSession({
    accountId: account.id,
    email: account.email,
    nickname: account.nickname,
    loggedInAt: new Date().toISOString(),
  });

  return { ok: true, account };
}

export async function logoutAccount() {
  saveAuthSession(null);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const accounts = loadAccounts()
    .filter((item) => item.bestScore > 0)
    .sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return (b.bestScoreUpdatedAt ?? '').localeCompare(a.bestScoreUpdatedAt ?? '');
    })
    .slice(0, 10);

  return accounts.map((account, index) => ({
    rank: index + 1,
    accountId: account.id,
    nickname: account.nickname,
    emailMasked: toMaskedEmail(account.email),
    bestScore: account.bestScore,
    updatedAt: account.bestScoreUpdatedAt,
  }));
}

export async function recordScore(accountId: string, score: number): Promise<AccountRecord | null> {
  const accounts = loadAccounts();
  const index = accounts.findIndex((item) => item.id === accountId);
  if (index === -1) return null;

  const current = accounts[index];
  if (score <= current.bestScore) {
    return current;
  }

  const updated: AccountRecord = {
    ...current,
    bestScore: score,
    bestScoreUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  accounts[index] = updated;
  saveAccounts(accounts);
  return updated;
}
