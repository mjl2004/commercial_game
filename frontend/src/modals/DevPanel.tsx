import { useState } from 'react';
import { Box, Typography, IconButton, Tab, Tabs } from '@mui/material';
import {
  Close as CloseIcon,
  Storage as SqlIcon,
  AccountTree as TxIcon,
  Waves as RippleIcon,
  TableChart as TableIcon,
  Speed as PerfIcon,
} from '@mui/icons-material';
import colors from '../theme/colors';

/* ---- types ---- */
export interface SqlEntry {
  timestamp: string;
  sql: string;
  durationMs?: number;
}

export interface TxStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

export interface TableSnapshot {
  tableName: string;
  columns: string[];
  rows: string[][];
}

export interface DevPanelProps {
  open: boolean;
  onClose: () => void;
  sqlLog?: SqlEntry[];
  txSteps?: TxStep[];
  rippleTrace?: string[];
  tableSnapshots?: TableSnapshot[];
  queryTimeMs?: number;
  txTimeMs?: number;
}

/* ---- mock data for visual development ---- */
const MOCK_SQL: SqlEntry[] = [
  { timestamp: '10:45:32.123', sql: 'SELECT * FROM v_station_prices WHERE station_id = 5 AND goods_id IN (1,2,3,4,5,6,7,8)', durationMs: 12 },
  { timestamp: '10:45:32.234', sql: 'BEGIN TRANSACTION', durationMs: 0 },
  { timestamp: "10:45:32.345", sql: "INSERT INTO transaction_logs (player_id, station_id, goods_id, quantity, trade_type, unit_price, total_amount) VALUES (1, 5, 2, 10, 'buy', 340, 3400)", durationMs: 8 },
  { timestamp: '10:45:32.456', sql: 'UPDATE players SET credits = credits - 3400 WHERE player_id = 1', durationMs: 4 },
  { timestamp: '10:45:32.567', sql: 'UPDATE station_inventory SET stock_quantity = stock_quantity - 10 WHERE station_id = 5 AND goods_id = 2', durationMs: 5 },
  { timestamp: "10:45:32.678", sql: "SELECT fn_ripple_price(5, 2, 'buy', 10)", durationMs: 23 },
  { timestamp: '10:45:32.789', sql: 'UPDATE wanted_list SET suspicious_score = suspicious_score + 15 WHERE player_id = 1', durationMs: 6 },
  { timestamp: '10:45:32.890', sql: 'COMMIT TRANSACTION', durationMs: 0 },
];

const MOCK_TX: TxStep[] = [
  { label: 'BEGIN', status: 'done' },
  { label: 'INSERT transaction_logs', status: 'done' },
  { label: 'UPDATE players.credits', status: 'done' },
  { label: 'UPDATE station_inventory', status: 'done' },
  { label: 'fn_ripple_price (3 hops)', status: 'done' },
  { label: 'UPDATE wanted_list', status: 'done' },
  { label: 'COMMIT', status: 'done' },
];

const MOCK_RIPPLE: string[] = ['阿尔法空间站 (起点)', '贝塔贸易港 (1跳)', '伽马矿业站 (2跳)', '德尔塔枢纽 (3跳)', '埃普西隆哨站 (3跳)'];

/* ---- scanline bar ---- */
function ScanlineBar({ color = colors.primary }: { color?: string }) {
  return (
    <Box
      sx={{
        height: 2,
        background: `repeating-linear-gradient(90deg, transparent, transparent 8px, ${color}22 8px, ${color}22 9px)`,
        animation: 'scanLine 2s linear infinite',
      }}
    />
  );
}

/* ---- tab panel ---- */
function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>{children}</Box> : null;
}

export default function DevPanel({
  open,
  onClose,
  sqlLog = MOCK_SQL,
  txSteps = MOCK_TX,
  rippleTrace = MOCK_RIPPLE,
  tableSnapshots,
  queryTimeMs = 12,
  txTimeMs = 45,
}: DevPanelProps) {
  const [tab, setTab] = useState(0);

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 24, bgcolor: 'rgba(0,0,0,0.3)' }} />

      {/* panel */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 600,
          maxWidth: '92vw',
          zIndex: 25,
          bgcolor: 'rgba(13,17,28,0.96)',
          borderRight: `1px solid ${colors.borderGlow}`,
          boxShadow: `8px 0 32px rgba(0,0,0,0.5)`,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInLeft 0.3s ease',
        }}
      >
        <ScanlineBar />

        {/* ---- header ---- */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2,
            py: 1.25,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <Typography sx={{ flex: 1, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.06em', color: colors.primary }}>
            DEV PANEL
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: colors.textSub }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ---- tabs ---- */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 36,
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              minHeight: 36,
              fontSize: '0.62rem',
              fontFamily: 'var(--font-mono)',
              py: 0.5,
              px: 1.25,
              minWidth: 0,
              color: colors.textSub,
              '&.Mui-selected': { color: colors.primary },
            },
            '& .MuiTabs-indicator': { bgcolor: colors.primary, height: 2 },
          }}
        >
          <Tab label="SQL流" icon={<SqlIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
          <Tab label="事务" icon={<TxIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
          <Tab label="涟漪" icon={<RippleIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
          <Tab label="数据表" icon={<TableIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
        </Tabs>

        {/* ---- body ---- */}
        {/* Tab 0: SQL log */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {sqlLog.map((entry, i) => (
              <Box
                key={i}
                sx={{
                  px: 1.25,
                  py: 1,
                  borderRadius: '2px',
                  bgcolor: i % 2 === 0 ? 'rgba(0,212,255,0.02)' : 'transparent',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: colors.muted }}>
                    {entry.timestamp}
                  </Typography>
                  {entry.durationMs !== undefined && entry.durationMs > 0 && (
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: colors.accent }}>
                      {entry.durationMs}ms
                    </Typography>
                  )}
                </Box>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    color: entry.sql.includes('SELECT') ? colors.primary :
                           entry.sql.includes('INSERT') ? colors.warning :
                           entry.sql.includes('UPDATE') ? '#a855f7' :
                           entry.sql.includes('DELETE') ? colors.danger :
                           entry.sql.includes('BEGIN') || entry.sql.includes('COMMIT') ? colors.accent :
                           colors.textSub,
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                  }}
                >
                  {entry.sql}
                </Typography>
              </Box>
            ))}
          </Box>
        </TabPanel>

        {/* Tab 1: Transaction visualization */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ pl: 4, position: 'relative' }}>
            {/* vertical line */}
            <Box
              sx={{
                position: 'absolute',
                left: 12,
                top: 26,
                bottom: 26,
                width: 2,
                bgcolor: colors.border,
                borderRadius: '2px',
              }}
            />
            {txSteps.map((step, i) => (
              <Box key={i} sx={{ position: 'relative', mb: i < txSteps.length - 1 ? 2 : 0, pl: 2 }}>
                {/* node */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: -22,
                    top: 2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: step.status === 'done' ? colors.accent :
                             step.status === 'active' ? colors.primary : colors.muted,
                    border: `2px solid ${
                      step.status === 'done' ? colors.accent :
                      step.status === 'active' ? colors.primary : colors.muted
                    }66`,
                    boxShadow: step.status === 'active'
                      ? `0 0 8px ${colors.primary}66`
                      : 'none',
                  }}
                />
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: step.status === 'done' ? colors.accent : colors.textSub }}>
                  {step.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </TabPanel>

        {/* Tab 2: Ripple trace */}
        <TabPanel value={tab} index={2}>
          <Typography sx={{ color: colors.muted, display: 'block', mb: 1, fontSize: '0.65rem' }}>
            最近一次交易涟漪传播路径：
          </Typography>
          <Box sx={{ pl: 3, position: 'relative' }}>
            <Box
              sx={{
                position: 'absolute',
                left: 7,
                top: 14,
                bottom: 14,
                width: 2,
                bgcolor: `${colors.primary}44`,
                borderRadius: '2px',
              }}
            />
            {rippleTrace.map((name, i) => (
              <Box key={i} sx={{ position: 'relative', mb: i < rippleTrace.length - 1 ? 1.5 : 0, pl: 1.5 }}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: -20,
                    top: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: i === 0 ? colors.accent : colors.primary,
                    opacity: 1 - i * 0.15,
                  }}
                />
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: i === 0 ? colors.accent : colors.textSub }}>
                  {name}
                </Typography>
              </Box>
            ))}
          </Box>
        </TabPanel>

        {/* Tab 3: Table snapshots */}
        <TabPanel value={tab} index={3}>
          {tableSnapshots && tableSnapshots.length > 0 ? (
            tableSnapshots.map((snap) => (
              <Box key={snap.tableName} sx={{ mb: 2 }}>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: colors.primary, mb: 0.5 }}>
                  {snap.tableName}
                </Typography>
                <Box sx={{ overflow: 'auto' }}>
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.58rem' }}>
                    <thead>
                      <tr>
                        {snap.columns.map((col) => (
                          <th key={col} style={{ textAlign: 'left', padding: '4px 8px', fontFamily: 'var(--font-mono)', color: colors.primary, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {snap.rows.map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(0,212,255,0.02)' : 'transparent' }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ padding: '3px 8px', fontFamily: 'var(--font-mono)', color: colors.textSub, borderBottom: `1px solid ${colors.border}22`, whiteSpace: 'nowrap' }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                </Box>
              </Box>
            ))
          ) : (
            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.muted, textAlign: 'center', py: 4 }}>
              暂无数据 · 执行一次交易后可使用
            </Typography>
          )}
        </TabPanel>

        {/* ---- footer: perf metrics ---- */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <PerfIcon sx={{ fontSize: 14, color: colors.muted }} />
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: colors.muted }}>
            查询耗时: <span style={{ color: queryTimeMs > 50 ? colors.dangerHigh : colors.accent }}>{queryTimeMs}ms</span>
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: colors.muted }}>
            事务耗时: <span style={{ color: txTimeMs > 200 ? colors.dangerHigh : colors.accent }}>{txTimeMs}ms</span>
          </Typography>
        </Box>
      </Box>
    </>
  );
}
