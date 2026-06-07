import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface Planet {
  id: number;
  name: string;
  x: number;
  y: number;
  faction: string;
}

export interface Connection {
  from: number;
  to: number;
  travelCost?: number;
}

export interface HoverPreview {
  stationId: number | null;
  moveCost?: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface ActiveTravelPreview {
  from: number;
  to: number;
  progress: number;
}

export interface StarMapState {
  planets: Planet[];
  connections: Connection[];
  selectedPlanetId: number | null;
  hoveredPlanetId: number | null;
  hoveredMoveCost: number | null;
  camera: CameraState;
  activeTravel: ActiveTravelPreview | null;
  loading: boolean;
}

const initialState: StarMapState = {
  planets: [],
  connections: [],
  selectedPlanetId: null,
  hoveredPlanetId: null,
  hoveredMoveCost: null,
  camera: {
    x: 0,
    y: 0,
    zoom: 0.82,
    minZoom: 0.55,
    maxZoom: 1.85,
  },
  activeTravel: null,
  loading: false,
};

const starMapSlice = createSlice({
  name: 'starMap',
  initialState,
  reducers: {
    setPlanets(state, action: PayloadAction<Planet[]>) {
      state.planets = action.payload;
    },
    setConnections(state, action: PayloadAction<Connection[]>) {
      state.connections = action.payload;
    },
    selectPlanet(state, action: PayloadAction<number | null>) {
      state.selectedPlanetId = action.payload;
    },
    hoverPlanet(state, action: PayloadAction<HoverPreview>) {
      state.hoveredPlanetId = action.payload.stationId;
      state.hoveredMoveCost = action.payload.moveCost ?? null;
    },
    setCamera(state, action: PayloadAction<Partial<CameraState>>) {
      state.camera = {
        ...state.camera,
        ...action.payload,
      };
    },
    setActiveTravelPreview(state, action: PayloadAction<ActiveTravelPreview | null>) {
      state.activeTravel = action.payload;
    },
    setStarMapLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const {
  setPlanets,
  setConnections,
  selectPlanet,
  hoverPlanet,
  setCamera,
  setActiveTravelPreview,
  setStarMapLoading,
} = starMapSlice.actions;
export default starMapSlice.reducer;
