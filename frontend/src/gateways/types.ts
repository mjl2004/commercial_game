import type {
  AccountRecord,
  AuthResult,
  LeaderboardEntry,
  LoginPayload,
  RegisterPayload,
} from '../api/authApi';
import type {
  GameSessionData,
  PendingActionContext,
} from '../game/types';
import type { SettlementData } from '../game/settlement';
import type { TradeExecutionPayload, TradeExecutionResult } from '../api/sessionTradeApi';
import type { WarehousePayload, WarehouseResult } from '../api/sessionWarehouseApi';

export interface AuthGateway {
  register(payload: RegisterPayload): Promise<AuthResult>;
  login(payload: LoginPayload): Promise<AuthResult>;
  logout(): Promise<void>;
  restoreCurrentAccount(): Promise<AccountRecord | null>;
  getCurrentAccount(): AccountRecord | null;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  recordScore(accountId: string, score: number): Promise<AccountRecord | null>;
}

export interface StartMoveResult {
  session: GameSessionData;
  encounter: GameSessionData['ui']['encounter'] extends infer _T ? {
    id: string;
    title: string;
    description: string;
    choices: GameSessionData['ui']['encounter']['choices'];
  } | null : never;
}

export interface EncounterResolutionPayload {
  choiceId: number;
  pendingAction: PendingActionContext;
}

export interface GameGateway {
  startSession(playerName: string): Promise<GameSessionData>;
  restoreSession(): Promise<GameSessionData | null>;
  persistSession(session: GameSessionData): Promise<void>;
  clearSession(): Promise<void>;
  openMarket(session: GameSessionData, stationId: number): Promise<unknown>;
  executeTrade(session: GameSessionData, payload: TradeExecutionPayload): Promise<TradeExecutionResult>;
  depositWarehouse(session: GameSessionData, payload: WarehousePayload): Promise<WarehouseResult>;
  withdrawWarehouse(session: GameSessionData, payload: WarehousePayload): Promise<WarehouseResult>;
  startMove(session: GameSessionData, params: { stationId: number; targetStationId: number; yearsCost: number }): Promise<StartMoveResult>;
  resolveEncounterChoice(session: GameSessionData, payload: EncounterResolutionPayload): Promise<{ session: GameSessionData; result: { success: boolean; message: string } }>;
  finalizeEncounterAndAdvance(session: GameSessionData): Promise<GameSessionData>;
  advanceWorld(session: GameSessionData, yearsElapsed: number, source: 'move' | 'trade'): Promise<GameSessionData>;
  evaluateSettlement(session: GameSessionData): Promise<SettlementData>;
  completeSettlement(session: GameSessionData, accountId?: string): Promise<{ settlement: SettlementData; account: AccountRecord | null }>;
}
