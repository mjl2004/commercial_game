import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  beginTravel,
  completeTravel,
  openTradeModal,
  startEncounter,
  setHoveredStation,
  setMoveState,
  setPlayerStatus,
  setSelectedTargetStation,
  hoverPlanet,
  selectPlanet,
  setActiveTravelPreview,
  setCamera,
  setSession,
  finishTurnResolution,
} from '../store';
import { ASSET_PATHS } from '../theme/assets';
import colors from '../theme/colors';
import type { RouteData, StationData } from '../game/types';
import { computeRegionMonopolyState } from '../game/monopolyService';
import { gameGateway } from '../gateways';

const STATION_HIT_RADIUS = 40;
const STATION_SIZE = 64;
const SHIP_FRAME_COUNT = 3;
const WORLD_PADDING = 180;
const CAMERA_SPEED = 12;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.85;
const BACKGROUND_PARALLAX = 0.15;
const RIPPLE_DURATION_MS = 1600;

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

function distance(a: Pick<StationData, 'x' | 'y'>, b: Pick<StationData, 'x' | 'y'>) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function drawArrowHead(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = 12;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function getRouteKey(from: number, to: number) {
  return from < to ? `${from}-${to}` : `${to}-${from}`;
}

function getStationColor(security: string) {
  if (security === 'A') return 'rgba(0, 212, 255, 0.9)';
  if (security === 'B') return 'rgba(5, 255, 161, 0.9)';
  if (security === 'C') return 'rgba(255, 159, 28, 0.9)';
  return 'rgba(255, 43, 109, 0.92)';
}

const stationImageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string) {
  if (!stationImageCache.has(src)) {
    const image = new Image();
    image.src = src;
    stationImageCache.set(src, image);
  }
  return stationImageCache.get(src)!;
}

function stationSpriteForIndex(index: number) {
  const spriteIndex = index % 3;
  if (spriteIndex === 0) return ASSET_PATHS.stations.normal;
  if (spriteIndex === 1) return ASSET_PATHS.stations.hub;
  return ASSET_PATHS.stations.danger;
}

function screenToWorld(screenX: number, screenY: number, camera: Camera, viewportWidth: number, viewportHeight: number) {
  return {
    x: camera.x + (screenX - viewportWidth / 2) / camera.zoom,
    y: camera.y + (screenY - viewportHeight / 2) / camera.zoom,
  };
}

function worldToScreen(worldX: number, worldY: number, camera: Camera, viewportWidth: number, viewportHeight: number) {
  return {
    x: (worldX - camera.x) * camera.zoom + viewportWidth / 2,
    y: (worldY - camera.y) * camera.zoom + viewportHeight / 2,
  };
}

interface StarMapProps {
  regionViewActive?: boolean;
}

export default function StarMap({ regionViewActive = false }: StarMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const drawErrorLoggedRef = useRef(false);
  const shipImageRef = useRef<HTMLImageElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const keyStateRef = useRef<Record<string, boolean>>({});
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.82 });
  const dispatch = useAppDispatch();

  const session = useAppSelector((state) => state.session.current);
  const selectedPlanetId = useAppSelector((state) => state.starMap.selectedPlanetId);
  const hoveredPlanetId = useAppSelector((state) => state.starMap.hoveredPlanetId);
  const storedCamera = useAppSelector((state) => state.starMap.camera);

  const routeMap = useMemo(() => {
    if (!session) return new Map<string, RouteData>();
    return new Map(session.routes.map((route) => [getRouteKey(route.from, route.to), route]));
  }, [session]);

  const stationMap = useMemo(() => {
    if (!session) return new Map<number, StationData>();
    return new Map(session.stations.map((station) => [station.id, station]));
  }, [session]);

  const adjacentStationIds = useMemo(() => {
    if (!session) return new Set<number>();
    const currentStationId = session.player.currentStationId;
    return new Set(
      session.routes.flatMap((route) => {
        if (route.from === currentStationId) return [route.to];
        if (route.to === currentStationId) return [route.from];
        return [];
      }),
    );
  }, [session]);

  const currentStation = session ? stationMap.get(session.player.currentStationId) ?? null : null;
  const targetStation = session?.ui.selectedTargetStationId
    ? stationMap.get(session.ui.selectedTargetStationId) ?? null
    : null;
  const activeRipple = session?.ui.ripple ?? { affectedStationIds: [], startedAt: null };
  const tradeModalOpen = session?.ui.tradeModal.open ?? false;

  const regionState = useMemo(() => {
    if (!session) {
      return { focusGoodsId: null, focusGoodsName: null, highlightedStations: [] };
    }
    try {
      return computeRegionMonopolyState(session);
    } catch (error) {
      if (!drawErrorLoggedRef.current) {
        console.error('StarMap region state failed:', error);
        drawErrorLoggedRef.current = true;
      }
      return { focusGoodsId: null, focusGoodsName: null, highlightedStations: [] };
    }
  }, [session]);

  const getRouteBetween = useCallback(
    (from: number, to: number) => routeMap.get(getRouteKey(from, to)) ?? null,
    [routeMap],
  );

  const startTravel = useCallback(
    (route: RouteData, fromStation: StationData, toStation: StationData) => {
      const durationMs = clamp(route.travelCost * 280, 1200, 2000);
      const startedAt = performance.now();

      dispatch(
        beginTravel({
          fromStationId: fromStation.id,
          toStationId: toStation.id,
          travelCost: route.travelCost,
          startedAt,
          durationMs,
        }),
      );
      dispatch(setPlayerStatus('TRAVELING'));

      window.setTimeout(() => {
        if (!session) return;
        dispatch(completeTravel({ stationId: toStation.id }));
        dispatch(setActiveTravelPreview(null));
        void gameGateway.startMove(session, {
          stationId: fromStation.id,
          targetStationId: toStation.id,
          yearsCost: route.travelCost,
        }).then((moveResult) => {
          const movedSession = moveResult.session;
          const encounter = moveResult.encounter;
          if (encounter) {
            dispatch(setSession(movedSession));
            dispatch(startEncounter({ event: encounter }));
            return;
          }

          void gameGateway.advanceWorld(movedSession, route.travelCost, 'move').then((advanced) => {
            dispatch(setSession(advanced));
            dispatch(finishTurnResolution());
          });
        });
      }, durationMs);
    },
    [dispatch, session],
  );

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);

    const backgroundImage = backgroundImageRef.current;
    if (!backgroundImage || !backgroundImage.complete) return;

    const drawWidth = width * 1.35;
    const drawHeight = height * 1.35;
    const offsetX = -((cameraRef.current.x * BACKGROUND_PARALLAX) % (drawWidth * 0.25));
    const offsetY = -((cameraRef.current.y * BACKGROUND_PARALLAX) % (drawHeight * 0.25));

    ctx.save();
    ctx.globalAlpha = regionViewActive ? 0.18 : 0.42;
    ctx.drawImage(backgroundImage, offsetX - drawWidth * 0.08, offsetY - drawHeight * 0.08, drawWidth, drawHeight);
    ctx.restore();
  }, [regionViewActive]);

  const drawStation = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      station: StationData,
      camera: Camera,
      viewportWidth: number,
      viewportHeight: number,
      time: number,
    ) => {
      const position = worldToScreen(station.x, station.y, camera, viewportWidth, viewportHeight);
      const isCurrent = session?.player.currentStationId === station.id;
      const isHovered = hoveredPlanetId === station.id;
      const isSelected = session?.ui.selectedTargetStationId === station.id || selectedPlanetId === station.id;
      const color = getStationColor(station.security);
      const rippleElapsed = activeRipple.startedAt !== null ? Date.now() - activeRipple.startedAt : null;
      const rippleActive =
        rippleElapsed !== null &&
        rippleElapsed >= 0 &&
        rippleElapsed < RIPPLE_DURATION_MS &&
        activeRipple.affectedStationIds.includes(station.id);
      const highlightedRegion = regionState.highlightedStations.find((item) => item.stationId === station.id);

      if (regionViewActive && highlightedRegion) {
        ctx.beginPath();
        ctx.arc(position.x, position.y, STATION_SIZE * 0.92, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(5,255,161,0.16)';
        ctx.fill();
      }

      if (isCurrent) {
        const pulseRadius = STATION_SIZE * 0.55 + Math.sin(time / 350) * 5;
        ctx.beginPath();
        ctx.arc(position.x, position.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 159, 28, 0.72)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(position.x, position.y, STATION_SIZE * 0.68, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.56)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(position.x, position.y, STATION_SIZE * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 159, 28, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (rippleActive) {
        const rippleProgress = clamp((Date.now() - activeRipple.startedAt!) / RIPPLE_DURATION_MS, 0, 1);
        const radius = STATION_SIZE * clamp(0.45 + rippleProgress * 0.55, 0.45, 1.1);
        const opacity = clamp(0.85 - rippleProgress, 0, 0.85);

        ctx.beginPath();
        ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(position.x, position.y, radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(5, 255, 161, ${opacity * 0.55})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      const sprite = loadImage(stationSpriteForIndex(station.id));
      if (sprite.complete) {
        ctx.save();
        ctx.globalAlpha = regionViewActive ? 0.7 : 0.95;
        ctx.drawImage(sprite, position.x - STATION_SIZE / 2, position.y - STATION_SIZE / 2, STATION_SIZE, STATION_SIZE);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(position.x, position.y, STATION_SIZE * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(position.x, position.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = highlightedRegion ? colors.accent : color;
      ctx.fill();

      ctx.fillStyle = '#e0e6ed';
      ctx.font = 'bold 12px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(station.name, position.x, position.y + STATION_SIZE * 0.72);
    },
    [activeRipple.affectedStationIds, activeRipple.startedAt, hoveredPlanetId, regionState.highlightedStations, regionViewActive, selectedPlanetId, session],
  );

  const drawRoutes = useCallback(
    (ctx: CanvasRenderingContext2D, camera: Camera, viewportWidth: number, viewportHeight: number) => {
      if (!session) return;

      for (const route of session.routes ?? []) {
        const fromStation = stationMap.get(route.from);
        const toStation = stationMap.get(route.to);
        if (!fromStation || !toStation) continue;

        const fromPos = worldToScreen(fromStation.x, fromStation.y, camera, viewportWidth, viewportHeight);
        const toPos = worldToScreen(toStation.x, toStation.y, camera, viewportWidth, viewportHeight);
        const isAdjacent = route.from === session.player.currentStationId || route.to === session.player.currentStationId;
        const isSelected =
          session.ui.selectedTargetStationId !== null &&
          getRouteKey(route.from, route.to) === getRouteKey(session.player.currentStationId, session.ui.selectedTargetStationId);

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.strokeStyle = regionViewActive
          ? 'rgba(0, 212, 255, 0.08)'
          : isSelected
            ? 'rgba(0, 212, 255, 0.9)'
            : isAdjacent
              ? 'rgba(125, 210, 255, 0.32)'
              : 'rgba(0, 212, 255, 0.18)';
        ctx.lineWidth = isSelected ? 2.8 : 1.1;
        ctx.setLineDash(isSelected ? [] : [6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (!currentStation || regionViewActive) return;

      for (const stationId of adjacentStationIds) {
        const station = stationMap.get(stationId);
        const route = getRouteBetween(currentStation.id, stationId);
        if (!station || !route) continue;

        const fromPos = worldToScreen(currentStation.x, currentStation.y, camera, viewportWidth, viewportHeight);
        const toPos = worldToScreen(station.x, station.y, camera, viewportWidth, viewportHeight);
        const hovered = hoveredPlanetId === stationId;

        ctx.strokeStyle = hovered ? 'rgba(255, 159, 28, 0.72)' : 'rgba(255, 159, 28, 0.28)';
        ctx.fillStyle = hovered ? 'rgba(255, 159, 28, 0.9)' : 'rgba(255, 159, 28, 0.5)';
        ctx.lineWidth = hovered ? 2.2 : 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        drawArrowHead(ctx, fromPos.x, fromPos.y, toPos.x, toPos.y);

        if (hovered) {
          const labelX = (fromPos.x + toPos.x) / 2;
          const labelY = (fromPos.y + toPos.y) / 2 - 12;
          ctx.fillStyle = '#ffcf82';
          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`消耗 ${route.travelCost} 年`, labelX, labelY);
        }
      }
    },
    [adjacentStationIds, currentStation, getRouteBetween, hoveredPlanetId, regionViewActive, session, stationMap],
  );

  const drawShip = useCallback(
    (ctx: CanvasRenderingContext2D, camera: Camera, viewportWidth: number, viewportHeight: number, time: number) => {
      if (!session || regionViewActive) return;

      const shipImage = shipImageRef.current;
      const current = stationMap.get(session.player.currentStationId);
      if (!shipImage || !shipImage.complete || !current) return;

      let shipX = current.x;
      let shipY = current.y;
      let frameIndex = 0;

      if (session.ui.activeTravel) {
        const fromStation = stationMap.get(session.ui.activeTravel.fromStationId);
        const toStation = stationMap.get(session.ui.activeTravel.toStationId);
        if (fromStation && toStation) {
          const elapsed = time - session.ui.activeTravel.startedAt;
          const progress = clamp(elapsed / session.ui.activeTravel.durationMs, 0, 1);
          shipX = fromStation.x + (toStation.x - fromStation.x) * progress;
          shipY = fromStation.y + (toStation.y - fromStation.y) * progress;
          frameIndex = progress < 0.25 ? 0 : progress < 0.85 ? 1 : 2;
          dispatch(setActiveTravelPreview({ from: fromStation.id, to: toStation.id, progress }));
        }
      } else {
        dispatch(setActiveTravelPreview(null));
      }

      const shipScreen = worldToScreen(shipX, shipY, camera, viewportWidth, viewportHeight);
      const frameWidth = shipImage.width / SHIP_FRAME_COUNT;
      const frameHeight = shipImage.height;
      const renderWidth = 72;
      const renderHeight = (frameHeight / frameWidth) * renderWidth;

      if (session.ui.activeTravel) {
        const trailAlpha = 0.24 + Math.sin(time / 120) * 0.04;
        ctx.beginPath();
        ctx.arc(shipScreen.x - 12, shipScreen.y + 10, 14, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${trailAlpha})`;
        ctx.fill();
      }

      ctx.save();
      ctx.translate(shipScreen.x, shipScreen.y);
      ctx.drawImage(
        shipImage,
        frameIndex * frameWidth,
        0,
        frameWidth,
        frameHeight,
        -renderWidth / 2,
        -renderHeight / 2,
        renderWidth,
        renderHeight,
      );
      ctx.restore();
    },
    [dispatch, regionViewActive, session, stationMap],
  );

  const drawTargetPrompt = useCallback(
    (ctx: CanvasRenderingContext2D, camera: Camera, viewportWidth: number, viewportHeight: number) => {
      if (!currentStation || !targetStation || !session?.ui.selectedTargetStationId || regionViewActive) return;
      const targetPos = worldToScreen(targetStation.x, targetStation.y, camera, viewportWidth, viewportHeight);
      const route = getRouteBetween(currentStation.id, targetStation.id);
      if (!route) return;

      const width = 176;
      const height = 34;
      const x = targetPos.x - width / 2;
      const y = targetPos.y - STATION_SIZE - 28;

      ctx.fillStyle = 'rgba(10, 14, 26, 0.86)';
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e8f6ff';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`再次点击确认移动 · ${route.travelCost} 年`, x + width / 2, y + 21);
    },
    [currentStation, getRouteBetween, regionViewActive, session?.ui.selectedTargetStationId, targetStation],
  );

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !session) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const dpr = window.devicePixelRatio || 1;
        const viewportWidth = canvas.width / dpr;
        const viewportHeight = canvas.height / dpr;
        const camera = cameraRef.current;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground(ctx, viewportWidth, viewportHeight);
        drawRoutes(ctx, camera, viewportWidth, viewportHeight);

        for (const station of session.stations ?? []) {
          if (!station) continue;
          drawStation(ctx, station, camera, viewportWidth, viewportHeight, time);
        }

        drawTargetPrompt(ctx, camera, viewportWidth, viewportHeight);
        drawShip(ctx, camera, viewportWidth, viewportHeight, time);
        drawErrorLoggedRef.current = false;
      } catch (error) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!drawErrorLoggedRef.current) {
          drawErrorLoggedRef.current = true;
          console.error('StarMap draw failed:', error, {
            stations: session.stations?.length ?? 0,
            routes: session.routes?.length ?? 0,
            highlightedStations: regionState.highlightedStations?.length ?? 0,
            camera: cameraRef.current,
          });
        }
      }
    },
    [drawBackground, drawRoutes, drawShip, drawStation, drawTargetPrompt, regionState.highlightedStations, session],
  );

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const context = canvas.getContext('2d');
    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);
    }
  }, []);

  const handleNativeWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || !session) return;

      const rect = canvas.getBoundingClientRect();
      const camera = cameraRef.current;
      const pointerBefore = screenToWorld(event.clientX - rect.left, event.clientY - rect.top, camera, rect.width, rect.height);
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = clamp(camera.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

      camera.zoom = nextZoom;
      const pointerAfter = screenToWorld(event.clientX - rect.left, event.clientY - rect.top, camera, rect.width, rect.height);
      camera.x += pointerBefore.x - pointerAfter.x;
      camera.y += pointerBefore.y - pointerAfter.y;
      camera.x = clamp(camera.x, WORLD_PADDING, session.meta.mapWidth - WORLD_PADDING);
      camera.y = clamp(camera.y, WORLD_PADDING, session.meta.mapHeight - WORLD_PADDING);

      dispatch(setCamera({ x: camera.x, y: camera.y, zoom: camera.zoom, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }));
    },
    [dispatch, session],
  );

  useEffect(() => {
    const shipImage = new Image();
    shipImage.src = ASSET_PATHS.sprites.ship;
    shipImageRef.current = shipImage;

    const backgroundImage = new Image();
    backgroundImage.src = ASSET_PATHS.backgrounds.space;
    backgroundImageRef.current = backgroundImage;
  }, []);

  useEffect(() => {
    if (!session || !currentStation) return;
    cameraRef.current = {
      x: storedCamera.x || currentStation.x,
      y: storedCamera.y || currentStation.y,
      zoom: storedCamera.zoom || 0.82,
    };
  }, [currentStation, session, storedCamera.x, storedCamera.y, storedCamera.zoom]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        keyStateRef.current[key] = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        keyStateRef.current[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const tick = (timestamp: number) => {
      const activeCanvas = canvasRef.current;
      if (activeCanvas && session) {
        const delta = lastTimestampRef.current ? timestamp - lastTimestampRef.current : 16;
        lastTimestampRef.current = timestamp;

        const camera = cameraRef.current;
        const movementScale = (CAMERA_SPEED / camera.zoom) * (delta / 16);
        if (keyStateRef.current.w) camera.y -= movementScale;
        if (keyStateRef.current.s) camera.y += movementScale;
        if (keyStateRef.current.a) camera.x -= movementScale;
        if (keyStateRef.current.d) camera.x += movementScale;

        camera.x = clamp(camera.x, WORLD_PADDING, session.meta.mapWidth - WORLD_PADDING);
        camera.y = clamp(camera.y, WORLD_PADDING, session.meta.mapHeight - WORLD_PADDING);
        dispatch(setCamera({ x: camera.x, y: camera.y, zoom: camera.zoom, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }));

        draw(timestamp);
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleNativeWheel);
      }
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [dispatch, draw, handleNativeWheel, resize, session]);

  const handlePointerMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !session) return;
      const rect = canvas.getBoundingClientRect();
      const camera = cameraRef.current;
      const world = screenToWorld(event.clientX - rect.left, event.clientY - rect.top, camera, rect.width, rect.height);

      let hoveredStation: StationData | null = null;
      for (const station of session.stations) {
        if (distance(station, world) <= STATION_HIT_RADIUS) {
          hoveredStation = station;
          break;
        }
      }

      if (!hoveredStation) {
        dispatch(setHoveredStation(null));
        dispatch(hoverPlanet({ stationId: null }));
        return;
      }

      const route = currentStation ? getRouteBetween(currentStation.id, hoveredStation.id) : null;
      dispatch(setHoveredStation(hoveredStation.id));
      dispatch(
        hoverPlanet({
          stationId: hoveredStation.id,
          moveCost: route?.travelCost,
        }),
      );
    },
    [currentStation, dispatch, getRouteBetween, session],
  );

  const handlePointerLeave = useCallback(() => {
    dispatch(setHoveredStation(null));
    dispatch(hoverPlanet({ stationId: null }));
  }, [dispatch]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !session || !currentStation) return;
      if (session.ui.moveState === 'traveling' || session.ui.moveState === 'event_blocking') return;
      if (tradeModalOpen) return;

      const rect = canvas.getBoundingClientRect();
      const world = screenToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
        cameraRef.current,
        rect.width,
        rect.height,
      );

      let clickedStation: StationData | null = null;
      for (const station of session.stations) {
        if (distance(station, world) <= STATION_HIT_RADIUS) {
          clickedStation = station;
          break;
        }
      }

      if (!clickedStation) {
        dispatch(selectPlanet(null));
        dispatch(setSelectedTargetStation(null));
        dispatch(setMoveState('idle'));
        return;
      }

      dispatch(selectPlanet(clickedStation.id));

      if (clickedStation.id === currentStation.id) {
        dispatch(setSelectedTargetStation(null));
        dispatch(setMoveState('idle'));
        dispatch(openTradeModal({ stationId: clickedStation.id }));
        return;
      }

      if (!adjacentStationIds.has(clickedStation.id)) return;

      const route = getRouteBetween(currentStation.id, clickedStation.id);
      if (!route) return;

      if (session.ui.selectedTargetStationId === clickedStation.id && session.ui.moveState === 'targeting') {
        startTravel(route, currentStation, clickedStation);
        return;
      }

      dispatch(setSelectedTargetStation(clickedStation.id));
      dispatch(setMoveState('targeting'));
    },
    [adjacentStationIds, currentStation, dispatch, getRouteBetween, session, startTravel, tradeModalOpen],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: 'pointer',
        background: 'transparent',
      }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      onClick={handleClick}
    />
  );
}
