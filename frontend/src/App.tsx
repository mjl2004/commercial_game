import { useState, useCallback, useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import {
  store,
  setConnections,
  setPlanets,
  setSession,
  setSessionLoading,
  closeTradeModal,
  setTradeError,
  setTradeModalLoading,
  setTradeSelectedGoods,
  setTradeSubmitting,
  beginTradeAction,
  closeEncounter,
  finishTurnResolution,
  setEncounterResolving,
} from './store';
import theme from './theme/theme';
import './theme/global.css';
import LoginScreen from './pages/LoginScreen';
import LobbyScreen from './pages/LobbyScreen';
import GameScene from './pages/GameScene';
import LoadingSpinner from './fx/LoadingSpinner';
import SettlementScreen from './modals/SettlementScreen';
import DevPanel from './modals/DevPanel';
import TradeModal, { MiniTradePanel } from './modals/TradeModal';
import type { GoodsCard, CargoSlotItem } from './modals/TradeModal';
import WarehousePanel from './modals/WarehousePanel';
import EncounterModal from './modals/EncounterModal';
import LeaderboardModal from './modals/LeaderboardModal';
import { authGateway, gameGateway } from './gateways';
import type { AccountRecord, LeaderboardEntry, LoginPayload, RegisterPayload } from './api/authApi';
import { DEFAULT_SETTLEMENT, type SettlementData } from './game/settlement';
import type { RouteData, StationData, StationInventoryItem } from './game/types';
import { checkVictoryState, computeGalaxyMonopolyProgress, computeRegionMonopolyState } from './game/monopolyService';
import colors from './theme/colors';
import { useAppSelector } from './store/hooks';
import { pushWorldToast } from './fx/worldEventBus';

type Screen = 'login' | 'lobby' | 'loading' | 'game';

const LOADING_MESSAGES = [
  '正在初始化星图网络...',
  '正在同步星际航线...',
  '正在校准跃迁引擎...',
];

function mapRoutes(routes: RouteData[]) {
  return routes.map((route) => ({
    from: route.from,
    to: route.to,
    travelCost: route.travelCost,
  }));
}

function mapPlanets(stations: StationData[]) {
  return stations.map((station) => ({
    id: station.id,
    name: station.name,
    x: station.x,
    y: station.y,
    faction: station.faction,
  }));
}

function toCargoSlots(sessionCargo: CargoSlotItem[]) {
  return sessionCargo.length
    ? [...sessionCargo, ...Array.from({ length: Math.max(0, 8 - sessionCargo.length) }, () => null)].slice(0, 8)
    : Array.from({ length: 8 }, () => null);
}

function toGoodsCard(inventoryItem: StationInventoryItem, stationGoodsName: string, isContraband: boolean): GoodsCard {
  const previousPrice =
    inventoryItem.priceHistory.length > 1
      ? inventoryItem.priceHistory[inventoryItem.priceHistory.length - 2]
      : undefined;

  return {
    goodsId: inventoryItem.goodsId,
    goodsName: stationGoodsName,
    currentPrice: inventoryItem.currentPrice,
    previousPrice,
    avgPrice: inventoryItem.basePrice,
    stock: inventoryItem.stock,
    maxStock: Math.max(inventoryItem.stock, inventoryItem.basePrice > 800 ? 18 : inventoryItem.basePrice > 500 ? 48 : 120),
    isContraband,
    isLocked: false,
  };
}

function AppContent() {
  const session = useAppSelector((state) => state.session.current);
  const hoveredPlanetId = useAppSelector((state) => state.starMap.hoveredPlanetId);
  const hoveredMoveCost = useAppSelector((state) => state.starMap.hoveredMoveCost);
  const [screen, setScreen] = useState<Screen>('login');
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [regionViewActive, setRegionViewActive] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [scoreRecorded, setScoreRecorded] = useState(false);
  const [settlementData, setSettlementData] = useState<SettlementData>(DEFAULT_SETTLEMENT);
  const [settlementReady, setSettlementReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const currentAccount = await authGateway.restoreCurrentAccount();
      if (cancelled) return;

      if (currentAccount) {
        setAccount(currentAccount);
        setScreen('lobby');
      }

      const stored = await gameGateway.restoreSession();
      if (cancelled || !stored) return;

      store.dispatch(setSession(stored));
      store.dispatch(setPlanets(mapPlanets(stored.stations)));
      store.dispatch(setConnections(mapRoutes(stored.routes)));
      if (currentAccount) {
        setScreen('game');
      }
      if (stored.player.status === 'WON' || stored.player.status === 'LOST' || stored.player.status === 'TIMEUP') {
        setSettlementOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    void gameGateway.persistSession(session);
  }, [session]);

  useEffect(() => {
    if (screen !== 'game') return;

    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.ctrlKey || event.altKey) && (event.key === '`' || event.key === 'd' || event.key === 'D')) {
        event.preventDefault();
        setDevOpen((value) => !value);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  const handleLogin = useCallback(async (payload: LoginPayload) => {
    const result = await authGateway.login(payload);
    if (!result.ok) return result;
    setAccount(result.account);
    setScreen('lobby');
    return result;
  }, []);

  const handleRegister = useCallback(async (payload: RegisterPayload) => {
    const result = await authGateway.register(payload);
    if (!result.ok) return result;
    setAccount(result.account);
    setScreen('lobby');
    return result;
  }, []);

  const handleStartGame = useCallback(async () => {
    if (!account) return;
    setScreen('loading');
    store.dispatch(setSessionLoading(true));
    setScoreRecorded(false);
    let index = 0;
    const intervalId = window.setInterval(() => {
      index += 1;
      if (index < LOADING_MESSAGES.length) {
        setLoadingMsg(LOADING_MESSAGES[index]);
      }
    }, 500);

    try {
      const [sessionData] = await Promise.all([
        gameGateway.startSession(account.nickname),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);

      store.dispatch(setSession(sessionData));
      store.dispatch(setPlanets(mapPlanets(sessionData.stations)));
      store.dispatch(setConnections(mapRoutes(sessionData.routes)));
      setScreen('game');
      setSettlementOpen(false);
    } finally {
      window.clearInterval(intervalId);
      store.dispatch(setSessionLoading(false));
    }
  }, [account]);

  const handleEndGame = useCallback(() => {
    setSettlementOpen(true);
  }, []);

  const handleLogout = useCallback(() => {
    void gameGateway.clearSession();
    void authGateway.logout();
    setAccount(null);
    setScreen('login');
    setLeaderboardOpen(false);
    setSettlementOpen(false);
    setSettlementReady(false);
    setSettlementData(DEFAULT_SETTLEMENT);
  }, []);

  const handleOpenLeaderboard = useCallback(async () => {
    const entries = await authGateway.getLeaderboard();
    setLeaderboardEntries(entries);
    setLeaderboardOpen(true);
  }, []);

  const currentStation = session?.stations.find((station) => station.id === session.player.currentStationId);
  const hoveredStation = session?.stations.find((station) => station.id === hoveredPlanetId);

  useEffect(() => {
    if (!session?.ui.tradeModal.open || !session.ui.tradeModal.isLoading || !session.ui.tradeModal.stationId) {
      return;
    }

    let cancelled = false;
    void gameGateway.openMarket(session, session.ui.tradeModal.stationId)
      .then(() => {
        if (!cancelled) {
          store.dispatch(setTradeModalLoading(false));
        }
      })
      .catch(() => {
        if (!cancelled) {
          store.dispatch(closeTradeModal());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const monopolyProgress = session ? computeGalaxyMonopolyProgress(session) : [];
  const victoryState = session
    ? checkVictoryState(session)
    : { won: false, winningGoods: null, monopolyCount: 0, progress: [] };
  const regionState = session
    ? computeRegionMonopolyState(session)
    : { focusGoodsId: null, focusGoodsName: null, highlightedStations: [] };

  const monopolyItems = monopolyProgress.map((item) => ({
    goodsId: item.goodsId,
    goodsName: item.goodsName,
    shortName: item.shortName,
    icon: '',
    ratio: item.ratio,
  }));

  const cargoItems = useMemo<CargoSlotItem[]>(
    () =>
      session?.player.cargo.map((item) => ({
        goodsId: item.goodsId,
        goodsName: item.goodsName,
        quantity: item.quantity,
        avgCost: item.avgCost,
        isContraband: item.isContraband,
      })) ?? [],
    [session],
  );

  const cargoSlots = toCargoSlots(cargoItems);

  const warehouseItems = useMemo(() => {
    if (!session || !currentStation) return [];
    const entries = session.warehouses[currentStation.id] ?? [];
    return entries
      .map((entry) => {
        const goods = session.goods.find((item) => item.id === entry.goodsId);
        if (!goods) return null;
        const wantedMultiplier =
          session.player.wantedLevel <= 0 ? 1 : session.player.wantedLevel === 1 ? 1.35 : session.player.wantedLevel === 2 ? 1.9 : 2.6;
        const taxRate = Math.round(12 * (1 + entry.storedTurns * 0.12) * wantedMultiplier);
        return {
          goodsId: entry.goodsId,
          goodsName: goods.name,
          quantity: entry.quantity,
          stationName: currentStation.name,
          storedTurns: entry.storedTurns,
          taxRate,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [currentStation, session]);

  const tradeStation = session?.ui.tradeModal.stationId
    ? session.stations.find((station) => station.id === session.ui.tradeModal.stationId)
    : null;

  const stationGoods = useMemo<GoodsCard[]>(() => {
    if (!session || !tradeStation) return [];
    return tradeStation.inventory.map((inventoryItem) => {
      const goods = session.goods.find((entry) => entry.id === inventoryItem.goodsId)!;
      return toGoodsCard(inventoryItem, goods.name, goods.isContraband);
    });
  }, [session, tradeStation]);

  const selectedGoods = useMemo(() => {
    if (!tradeStation || !session?.ui.tradeModal.selectedGoodsId || !session) return null;
    const inventoryItem = tradeStation.inventory.find(
      (item) => item.goodsId === session.ui.tradeModal.selectedGoodsId,
    );
    const goods = session.goods.find((entry) => entry.id === session.ui.tradeModal.selectedGoodsId);
    if (!inventoryItem || !goods) return null;
    return {
      goods,
      inventoryItem,
      cargoItem: session.player.cargo.find((item) => item.goodsId === goods.id) ?? null,
    };
  }, [session, tradeStation]);

  const adjacentPrices = useMemo(() => {
    if (!session || !tradeStation || !selectedGoods) return [];
    const adjacentIds = session.routes.flatMap((route) => {
      if (route.from === tradeStation.id) return [route.to];
      if (route.to === tradeStation.id) return [route.from];
      return [];
    });
    return adjacentIds
      .map((stationId) => {
        const station = session.stations.find((entry) => entry.id === stationId);
        const inventory = station?.inventory.find((item) => item.goodsId === selectedGoods.goods.id);
        if (!station || !inventory) return null;
        return {
          stationName: station.name,
          price: inventory.currentPrice,
        };
      })
      .filter((entry): entry is { stationName: string; price: number } => entry !== null);
  }, [session, selectedGoods, tradeStation]);

  useEffect(() => {
    if (!settlementOpen || !session || scoreRecorded) return;
    setSettlementReady(false);
    let cancelled = false;
    void gameGateway.completeSettlement(session, account?.id).then(({ settlement, account: updatedAccount }) => {
      if (cancelled) return;
      setSettlementData(settlement);
      if (updatedAccount) {
        setAccount(updatedAccount);
      }
      setScoreRecorded(true);
      setSettlementReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [account?.id, scoreRecorded, session, settlementOpen]);

  const handleTradeExecute = useCallback(
    async (quantity: number, tradeType: 'buy' | 'sell') => {
      const current = store.getState().session.current;
      if (!current || !tradeStation || !selectedGoods) return;

      store.dispatch(beginTradeAction({ stationId: tradeStation.id }));
      store.dispatch(setTradeSubmitting(true));
      store.dispatch(setTradeError(null));

      const result = await gameGateway.executeTrade(current, {
        stationId: tradeStation.id,
        goodsId: selectedGoods.goods.id,
        quantity,
        tradeType,
      });

      if (!result.ok) {
        store.dispatch(setTradeSubmitting(false));
        store.dispatch(setTradeError(result.message));
        return;
      }

      store.dispatch(setSession(result.session));
      store.dispatch(setPlanets(mapPlanets(result.session.stations)));
      store.dispatch(setConnections(mapRoutes(result.session.routes)));
      pushWorldToast(
        `${selectedGoods.goods.name}${tradeType === 'buy' ? ' 买入完成' : ' 卖出完成'}`,
        'market_shock',
      );
    },
    [selectedGoods, tradeStation],
  );

  const handleDeposit = useCallback(async (goodsId: number, quantity: number) => {
    const current = store.getState().session.current;
    if (!current) return;

    const result = await gameGateway.depositWarehouse(current, {
      stationId: current.player.currentStationId,
      goodsId,
      quantity,
    });

    if (!result.ok) {
      store.dispatch(setTradeError(result.message));
      return;
    }

    store.dispatch(setSession(result.session));
    pushWorldToast('货物已存入当前站点仓库', 'route_opened');
  }, []);

  const handleWithdraw = useCallback(async (goodsId: number, quantity: number) => {
    const current = store.getState().session.current;
    if (!current) return;

    const result = await gameGateway.withdrawWarehouse(current, {
      stationId: current.player.currentStationId,
      goodsId,
      quantity,
    });

    if (!result.ok) {
      store.dispatch(setTradeError(result.message));
      return;
    }

    store.dispatch(setSession(result.session));
    pushWorldToast(
      `货物已取出${result.taxPaid ? `，税费 ${result.taxPaid} CR` : ''}`,
      'wanted_change',
    );
  }, []);

  const handleEncounterChoice = useCallback((choiceId: number) => {
    const current = store.getState().session.current;
    if (!current) return;
    store.dispatch(setEncounterResolving(true));
    void gameGateway.resolveEncounterChoice(current, {
      choiceId,
      pendingAction: current.ui.pendingAction,
    }).then((resolved) => {
      store.dispatch(setSession(resolved.session));
    });
  }, []);

  const handleEncounterConfirm = useCallback(() => {
    const current = store.getState().session.current;
    if (!current) return;
    void gameGateway.finalizeEncounterAndAdvance(current).then((advanced) => {
      store.dispatch(setSession(advanced));
      store.dispatch(closeEncounter());
      store.dispatch(finishTurnResolution());
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.player.status === 'WON' || session.player.status === 'LOST' || session.player.status === 'TIMEUP') {
      setSettlementOpen(true);
    }
  }, [session]);

  return (
    <>
      {screen === 'login' && <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />}

      {screen === 'lobby' && (
        <LobbyScreen
          playerName={account?.nickname ?? 'Pilot'}
          onStartGame={handleStartGame}
          onShowLeaderboard={handleOpenLeaderboard}
          onLogout={handleLogout}
        />
      )}

      {screen === 'loading' && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            bgcolor: colors.bg.deep,
          }}
        >
          <LoadingSpinner text={loadingMsg} size={64} />
        </Box>
      )}

      {screen === 'game' && session && (
        <>
          <GameScene
            topHUD={{
              credits: session.player.credits,
              previousCredits: session.player.credits,
              status:
                session.player.status === 'WON' || session.player.status === 'LOST' || session.player.status === 'TIMEUP'
                  ? 'EXPLORING'
                  : session.player.status,
              startYear: session.meta.startYear,
              currentYear: session.meta.currentYear,
              endYear: session.meta.endYear,
              wantedLevel: session.player.wantedLevel,
              onEndGame: handleEndGame,
            }}
            rightCargo={{
              cargoUsed: session.player.cargo.reduce((sum, item) => sum + item.quantity, 0),
              cargoCapacity: session.player.cargoCapacity,
              slots: cargoSlots,
              onSlotClick: () => setWarehouseOpen(true),
            }}
            bottomInfo={{
              monopolyItems,
              currentStationName: currentStation?.name,
              currentStationSecurity: currentStation?.security,
              hoveredStationName: hoveredStation?.name,
              hoveredMoveCost: hoveredMoveCost ?? undefined,
              regionFocusGoodsName: regionState.focusGoodsName ?? undefined,
            }}
            isProcessing={session.ui.moveState === 'traveling' || session.ui.moveState === 'event_blocking'}
            regionViewActive={regionViewActive}
            onRegionViewChange={setRegionViewActive}
          />

          <TradeModal
            open={session.ui.tradeModal.open}
            stationName={tradeStation?.name ?? ''}
            stationGoods={stationGoods}
            cargoItems={cargoItems}
            isLoading={session.ui.tradeModal.isLoading}
            errorMessage={session.ui.tradeModal.errorMessage}
            onClearError={() => store.dispatch(setTradeError(null))}
            onSelectGoods={(goods) => store.dispatch(setTradeSelectedGoods(goods.goodsId))}
            onClose={() => store.dispatch(closeTradeModal())}
          />

          {session.ui.tradeModal.open && !session.ui.tradeModal.isLoading && selectedGoods && (
            <Box
              sx={{
                position: 'fixed',
                inset: 0,
                zIndex: 25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.25)',
              }}
              onClick={() => store.dispatch(setTradeSelectedGoods(null))}
            >
              <MiniTradePanel
                goodsId={selectedGoods.goods.id}
                goodsName={selectedGoods.goods.name}
                currentPrice={selectedGoods.inventoryItem.currentPrice}
                previousPrice={
                  selectedGoods.inventoryItem.priceHistory.length > 1
                    ? selectedGoods.inventoryItem.priceHistory[selectedGoods.inventoryItem.priceHistory.length - 2]
                    : undefined
                }
                stock={selectedGoods.inventoryItem.stock}
                isContraband={selectedGoods.goods.isContraband}
                cargoQuantity={selectedGoods.cargoItem?.quantity ?? 0}
                maxBuy={Math.max(
                  0,
                  Math.min(
                    selectedGoods.inventoryItem.stock,
                    Math.floor(session.player.credits / selectedGoods.inventoryItem.currentPrice),
                    session.player.cargoCapacity - session.player.cargo.reduce((sum, item) => sum + item.quantity, 0),
                  ),
                )}
                maxSell={selectedGoods.cargoItem?.quantity ?? 0}
                priceHistory={selectedGoods.inventoryItem.priceHistory}
                adjacentPrices={adjacentPrices}
                isSubmitting={session.ui.tradeModal.isSubmitting}
                onExecute={handleTradeExecute}
                onClose={() => store.dispatch(setTradeSelectedGoods(null))}
              />
            </Box>
          )}

          <EncounterModal
            open={session.ui.encounter.open}
            title={session.ui.encounter.title}
            description={session.ui.encounter.description}
            choices={session.ui.encounter.choices}
            result={session.ui.encounter.result}
            onChoose={handleEncounterChoice}
            onConfirmResult={handleEncounterConfirm}
          />

          {settlementOpen && (
            <SettlementScreen
              data={settlementData}
              onReplay={() => {
                setSettlementOpen(false);
                void gameGateway.clearSession();
                void handleStartGame();
              }}
              onHome={() => {
                setSettlementOpen(false);
                void gameGateway.clearSession();
                setScreen('lobby');
              }}
            />
          )}

          <WarehousePanel
            open={warehouseOpen}
            cargoItems={cargoItems}
            warehouseItems={warehouseItems}
            cargoCapacity={session.player.cargoCapacity}
            cargoUsed={session.player.cargo.reduce((sum, item) => sum + item.quantity, 0)}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
            onClose={() => setWarehouseOpen(false)}
          />
        </>
      )}

      <LeaderboardModal open={leaderboardOpen} entries={leaderboardEntries} onClose={() => setLeaderboardOpen(false)} />

      {screen === 'game' && <DevPanel open={devOpen} onClose={() => setDevOpen(false)} />}
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
}
