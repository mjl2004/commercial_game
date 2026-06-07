/**
 * 素材路径常量 (GA-01 ~ GA-12)
 *
 * 所有 PNG/JPG 放在 public/assets/ 下，通过绝对路径引用。
 * Vite 中 public/ 文件在打包时直接复制到 dist/ 根目录。
 */
import colors from './colors';

/* ---- 路径常量 ---- */
export const ASSET_PATHS = {
  sprites: {
    ship: '/assets/sprites/ship_spritesheet.png',
    // 加载动画保留纯 CSS 实现
  },
  stations: {
    normal:'/assets/stations/station_normal.png',
    hub:   '/assets/stations/station_hub.png',
    danger:'/assets/stations/station_danger.png',
  },
  goods: {
    1: '/assets/goods/goods_01_ore.png',
    2: '/assets/goods/goods_02_crystal.png',
    3: '/assets/goods/goods_03_parts.png',
    4: '/assets/goods/goods_04_chip.png',
    5: '/assets/goods/goods_05_medical.png',
    6: '/assets/goods/goods_06_sample.png',
    7: '/assets/goods/goods_07_darkmatter.png',
    8: '/assets/goods/goods_08_art.png',
  },
  icons: {
    contrabandWarning:'/assets/icons/contraband_warning.png',
    contrabandLocked: '/assets/icons/contraband_locked.png',
    wantedLv1:    '/assets/icons/wanted_lv1_eye.png',
    wantedLv2:    '/assets/icons/wanted_lv2_lock.png',
    wantedLv3:    '/assets/icons/wanted_lv3_chain.png',
    eventMarket:  '/assets/icons/event_market.png',
    eventRoute:   '/assets/icons/event_route.png',
    eventEncounter:'/assets/icons/event_encounter.png',
    uiCredits:    '/assets/icons/ui_credits.png',
    uiCargo:      '/assets/icons/ui_cargo.png',
    uiTime:       '/assets/icons/ui_time.png',       // 统一的时间/行动点图标
    uiEnd:        '/assets/icons/ui_end.png',
    uiSector:     '/assets/icons/ui_sector.png',     // 区域视图
  },
  backgrounds: {
    space: '/assets/backgrounds/space_bg.jpg',
  },
  textures: {
    hudScanline: '/assets/textures/hud_scanline.png',
  },
} as const;

/* ---- 商品通用数据 ---- */
export const GOODS_NAMES: Record<number, string> = {
  1: '标准矿石', 2: '高能晶体', 3: '精密零件', 4: '星际芯片',
  5: '医疗药剂', 6: '生物样本', 7: '暗物质核心', 8: '走私艺术品',
};

export const GOODS_SHORT_NAMES: Record<number, string> = {
  1: '矿石', 2: '晶体', 3: '零件', 4: '芯片',
  5: '药剂', 6: '样本', 7: '暗物质', 8: '艺术品',
};

/** 获取商品 PNG 路径 */
export function goodsSrc(id: number): string {
  return (ASSET_PATHS.goods as Record<number, string>)[id] ?? (ASSET_PATHS.goods as Record<number, string>)[1];
}

/** emoji 回退（PNG 加载失败时使用） */
const GOODS_EMOJI: Record<number, string> = {
  1: '\u{1FAA8}', 2: '\u{1F48E}', 3: '⚙️', 4: '\u{1F537}',
  5: '\u{1F48A}', 6: '\u{1F9EC}', 7: '⚛️', 8: '\u{1F3A8}',
};

export function goodsIconEmoji(id: number): string {
  return GOODS_EMOJI[id] ?? '\u{1F4E6}';
}

/* ---- 通缉等级 ---- */
export const WANTED_META: Record<number, { src: string; color: string; label: string; emoji?: string }> = {
  0: { src: '',                                emoji: '\u{2705}', color: colors.accent,  label: 'Clean' },
  1: { src: ASSET_PATHS.icons.wantedLv1, emoji: '\u{1F441}\u{FE0F}', color: colors.warning, label: 'Suspicious' },
  2: { src: ASSET_PATHS.icons.wantedLv2, emoji: '\u{1F512}', color: colors.danger,  label: 'Investigated' },
  3: { src: ASSET_PATHS.icons.wantedLv3, emoji: '\u{26D3}',   color: colors.danger,  label: 'Wanted' },
};

/* ---- 世界事件 ---- */
export const WORLD_EVENT_META: Record<string, { src: string; color: string; emoji: string }> = {
  route_blocked:     { src: ASSET_PATHS.icons.eventRoute,    color: colors.danger,  emoji: '⛔' },
  market_shock:      { src: ASSET_PATHS.icons.eventMarket,   color: colors.warning, emoji: '📊' },
  route_opened:      { src: ASSET_PATHS.icons.eventRoute,    color: colors.primary, emoji: '🔗' },
  wanted_change:     { src: ASSET_PATHS.icons.wantedLv2,     color: colors.danger,  emoji: '🚨' },
  monopoly_progress: { src: ASSET_PATHS.icons.uiSector,      color: colors.accent,  emoji: '🏆' },
};

/* ---- 结算结果 ---- */
export const SETTLEMENT_EMOJI: Record<string, string> = {
  won:    '\u{1F3C6}',
  lost:   '\u{1F480}',
  timeup: '\u{23F3}',
};
