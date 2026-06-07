/**
 * 星际货运垄断者 — 色彩体系 (GA-13)
 *
 * 硬核科幻 HUD 风格，鹰角网络式科技平面：
 * - 深空背景 + 科技蓝主色 + 青绿强调 + 黄橙警告 + 玫红危险
 * - FE-Core 通过 import { colors } from 'theme/colors' 统一引用
 */

const colors = {
  /* ---- 背景 ---- */
  bg: {
    deep: '#0a0e1a',
    void: '#0d1117',
    panel: 'rgba(13, 17, 28, 0.85)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    paper: '#101423',
  },

  /* ---- 主色系 ---- */
  primary: '#00d4ff',       // 科技蓝（主强调色）
  accent: '#05ffa1',        // 青绿（成功/利润/垄断）
  warning: '#ff9f1c',       // 黄橙（违禁品/警告）
  danger: '#ff2a6d',        // 玫红（通缉/错误/锁定/封锁）

  /* ---- 设计文档精确语义色 ---- */
  successLow: '#00e5a0',    // 买入推荐/价格低位/操作成功
  dangerHigh: '#ff4757',    // 卖出推荐/价格高位/通缉警告
  textMain: '#e0e6ed',      // 正文冷白
  textSub: '#8b95a5',       // 次要灰蓝
  borderGlow: 'rgba(0, 212, 255, 0.3)', // 青色半透明边框
  wantedOrange: '#ff6b35',  // 通缉橙红

  /* ---- 灰度 ---- */
  white: '#ffffff',
  text: '#a0b0c0',
  muted: '#5a6a7a',

  /* ---- 边框与发光 ---- */
  border: 'rgba(0,212,255,0.2)',
  borderHover: 'rgba(0,212,255,0.4)',
  glow: 'rgba(0,212,255,0.15)',
  glowStrong: 'rgba(0,212,255,0.3)',

  /* ---- 语义别名 ---- */
  buy: '#00e5a0',
  sell: '#ff4757',
  locked: '#ff2a6d',
  contraband: '#ff9f1c',
} as const;

export default colors;
