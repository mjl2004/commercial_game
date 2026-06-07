export type PlayerStatus = 'EXPLORING' | 'TRAVELING' | 'TRADING' | 'DETAINED' | 'WON' | 'LOST' | 'TIMEUP';

export type MoveState = 'idle' | 'targeting' | 'traveling' | 'event_blocking';

export interface EncounterChoiceEffect {
  creditsDelta?: number;
  yearDelta?: number;
  endYearDelta?: number;
  wantedLevelDelta?: number;
  detainedYearsDelta?: number;
}

export interface EncounterChoiceData {
  choiceId: number;
  text: string;
  consequenceHint: string;
  effect: EncounterChoiceEffect;
}

export interface EncounterEventData {
  id: string;
  type: 'profit' | 'risk' | 'detention';
  title: string;
  description: string;
  choices: EncounterChoiceData[];
}

export interface GoodsDefinition {
  id: number;
  name: string;
  shortName: string;
  isContraband: boolean;
  basePrice: number;
  priceVariance: number;
  stockMin: number;
  stockMax: number;
}

export interface StationInventoryItem {
  goodsId: number;
  stock: number;
  basePrice: number;
  currentPrice: number;
  priceHistory: number[];
}

export interface StationData {
  id: number;
  name: string;
  x: number;
  y: number;
  security: string;
  faction: string;
  independenceFactor: number;
  inventory: StationInventoryItem[];
}

export interface RegionMonopolyNode {
  stationId: number;
  goodsId: number;
  ratio: number;
}

export interface RouteData {
  from: number;
  to: number;
  travelCost: number;
  status: 'ACTIVE';
}

export interface CargoItem {
  goodsId: number;
  goodsName: string;
  quantity: number;
  avgCost: number;
  isContraband: boolean;
}

export interface PlayerGameState {
  id: number;
  name: string;
  credits: number;
  currentStationId: number;
  cargo: CargoItem[];
  cargoCapacity: number;
  wantedLevel: number;
  suspicion: number;
  detainedYears: number;
  status: PlayerStatus;
}

export interface WarehouseEntry {
  goodsId: number;
  quantity: number;
  storedTurns: number;
}

export type StationWarehouseState = Record<number, WarehouseEntry[]>;

export interface ActiveTravel {
  fromStationId: number;
  toStationId: number;
  travelCost: number;
  startedAt: number;
  durationMs: number;
}

export interface PendingActionContext {
  type: 'move' | 'trade' | null;
  stationId: number | null;
  targetStationId?: number | null;
  yearsCost?: number;
  baseYearsSettled?: boolean;
}

export interface MoveSelectionState {
  hoveredStationId: number | null;
  selectedTargetStationId: number | null;
  moveState: MoveState;
  activeTravel: ActiveTravel | null;
  pendingAction: PendingActionContext;
  tradeModal: {
    open: boolean;
    stationId: number | null;
    isLoading: boolean;
    selectedGoodsId: number | null;
    isSubmitting: boolean;
    errorMessage: string | null;
  };
  ripple: {
    affectedStationIds: number[];
    startedAt: number | null;
  };
  encounter: {
    open: boolean;
    eventId: string | null;
    title: string;
    description: string;
    choices: EncounterChoiceData[];
    selectedChoiceId: number | null;
    result: { success: boolean; message: string } | null;
    isResolving: boolean;
  };
}

export interface MapCameraState {
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface SessionMeta {
  sessionVersion: number;
  sessionId: string;
  seed: number;
  generatedAt: string;
  lastPersistedAt?: string;
  startYear: number;
  currentYear: number;
  endYear: number;
  mapWidth: number;
  mapHeight: number;
}

export interface GameSessionData {
  meta: SessionMeta;
  goods: GoodsDefinition[];
  stations: StationData[];
  routes: RouteData[];
  player: PlayerGameState;
  warehouses: StationWarehouseState;
  ui: MoveSelectionState;
  stats: {
    tradeCount: number;
    eventCount: number;
  };
}

export interface SessionTemplateMeta {
  mapWidth: number;
  mapHeight: number;
  stationCount: number;
  minStationDistance: number;
  camera: {
    minZoom: number;
    maxZoom: number;
    defaultZoom: number;
  };
}

export interface SessionTemplate {
  meta: SessionTemplateMeta;
  goods: GoodsDefinition[];
  stationNames: string[];
  securityLevels: string[];
  factions: string[];
}
