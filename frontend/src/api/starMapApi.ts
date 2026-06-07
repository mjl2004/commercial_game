/**
 * 星图数据 API（模拟后端 GET /api/stations + GET /api/stations/{id}/routes）
 *
 * 返回 20 个空间站 + 贸易航线图。
 * FE-Core 接入真实后端时替换此文件即可。
 */
import type { Planet, Connection } from '../store/starMapSlice';

/* ---- 20 个空间站：名称 + 势力 + 位置 ---- */
const STATION_DEFS: Array<[string, string, number, number]> = [
  ['阿尔法枢纽',   '联邦',   420, 280],
  ['贝塔矿业站',   '联邦',   180, 200],
  ['伽马贸易港',   '中立',   620, 180],
  ['德尔塔哨站',   '联邦',   340, 420],
  ['埃普西隆港',   '中立',   680, 400],
  ['泽塔黑市',     '海盗',   520, 520],
  ['伊塔研究站',   '联邦',   120, 380],
  ['西塔中转站',   '中立',   780, 300],
  ['约塔前哨',     '海盗',    80, 100],
  ['卡帕矿场',     '中立',   280, 560],
  ['拉姆达工厂',   '联邦',   580, 560],
  ['缪空间站',     '中立',   860, 140],
  ['纽军港',       '联邦',   440, 100],
  ['克西农场',     '中立',   200, 480],
  ['奥米克戎港',   '海盗',   760, 500],
  ['派边境站',     '中立',   900, 380],
  ['罗贸易哨',     '中立',   500, 320],
  ['西格玛枢纽',   '联邦',   320, 140],
  ['陶前哨',       '海盗',   640, 540],
  ['宇普西隆站',   '中立',   140, 540],
];

const FACTION_COLORS: Record<string, string> = {
  '联邦': '#3b82f6',
  '中立': '#a0b0c0',
  '海盗': '#ff2a6d',
};

/* ---- 航线：邻近站点两两相连，最多 3 跳 ---- */
function generateConnections(count: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  const added = new Set<string>();
  const add = (a: number, b: number) => {
    const key = [a, b].sort().join('-');
    if (!added.has(key)) { added.add(key); pairs.push([a, b]); }
  };

  for (let i = 1; i <= count; i++) {
    // connect to nearby stations (nearest 2-4 neighbors)
    const others = Array.from({ length: count }, (_, j) => j + 1)
      .filter((j) => j !== i)
      .sort((a, b) => {
        const da = dist(i, a);
        const db = dist(i, b);
        return da - db;
      });
    for (let k = 0; k < Math.min(3, others.length); k++) {
      add(i, others[k]);
    }
  }
  return pairs;
}

function dist(a: number, b: number): number {
  const sa = STATION_DEFS[a - 1];
  const sb = STATION_DEFS[b - 1];
  const dx = sa[2] - sb[2];
  const dy = sa[3] - sb[3];
  return Math.sqrt(dx * dx + dy * dy);
}

/* ---- public API ---- */

export interface StarMapData {
  planets: Planet[];
  connections: Connection[];
}

/** 模拟 GET /api/stations → 返回星图完整数据 */
export async function fetchStarMap(): Promise<StarMapData> {
  // simulate network delay
  await new Promise((r) => setTimeout(r, 300));

  const planets: Planet[] = STATION_DEFS.map(([name, faction, x, y], i) => ({
    id: i + 1,
    name,
    x,
    y,
    faction,
  }));

  const connections: Connection[] = generateConnections(planets.length).map(
    ([from, to]) => ({ from, to }),
  );

  return { planets, connections };
}

export { FACTION_COLORS, STATION_DEFS };
