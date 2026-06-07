# FE-Art 下一阶段工作计划

> **生成日期**: 2026-05-25  
> **基于**: `agent/frontend_detail.md` + `agent/frontend_task_plan.md` + 当前代码实际状态  
> **前置条件**: 阶段一~四已完成（主题系统、HUD、模态、FX），App.tsx 已接入三层路由

---

## 一、当前状态盘点

### 已完成的 GA 任务

| 编号 | 任务 | 状态 |
|------|------|------|
| GA-13 | 色彩体系 `theme/colors.ts` | ✅ 完成 |
| GA-14 | MUI 主题 `theme/theme.ts` | ✅ 完成 |
| GA-15 | 全局 CSS `theme/global.css` | ✅ 完成 |
| GA-16 | HUD 面板通用样式 | ✅ 完成 |
| GA-17 | `LoginScreen` 登录界面 | ✅ 完成 |
| GA-18 | `LobbyScreen` 大厅界面 | ✅ 完成 |
| GA-19 | `GameScene` 游戏容器（视觉框架） | ✅ 完成 |
| GA-20 | `TopHUD` 上侧边栏 | ✅ 完成 |
| GA-21 | `RightCargoPanel` 右侧货舱 | ✅ 完成 |
| GA-22 | `BottomInfoBar` 下侧信息栏 | ✅ 完成 |
| GA-23 | `RegionViewToggle` 区域视图按钮 | ✅ 按钮/Action 就绪，FC 接入渲染 |
| GA-24 | `TradeModal` 交易模态（含 MiniTradePanel） | ✅ 完成 |
| GA-25 | `MiniTradePanel` 小交易详情 | ✅ 完成 |
| GA-26 | `EncounterModal` 遭遇事件模态 | ✅ 完成 |
| GA-27 | `WarehousePanel` 仓库面板 | ✅ 完成 |
| GA-28 | `SettlementScreen` 结算界面 | ✅ 完成 |
| GA-29 | `LoadingSpinner` 科技加载动画 | ✅ 完成 |
| GA-30 | `AnimatedNumber` 数字滚动 | ✅ 完成 |
| GA-31 | `TradeParticles` 金币粒子 | ✅ 完成 |
| GA-32 | `ScreenFlash` 全屏事件闪烁 | ✅ 完成 |
| GA-34 | `RippleRing` + `useRippleSequence` | ✅ 完成 |
| GA-35 | `WorldEventToast` + `worldEventBus` | ✅ 完成 |

### 未完成的 GA 任务

| 编号 | 任务 | 原因 |
|------|------|------|
| GA-33 | `ShipTrail` 飞船拖尾粒子 | **阻塞**：依赖 GC-12 飞行动画 + PixiJS ParticleContainer（FC 负责） |
| GA-36 | `DevPanel` 开发者面板 UI | **待做**：可独立完成视觉部分，数据管线依赖 GC-31（FC） |

### 待解决的问题

| 问题 | 影响 |
|------|------|
| 旧文件残留（`components/PlayerPanel.tsx`、`TradeForm.tsx`、`EventModal.tsx`、`MainPage.tsx`、`App.css`） | 代码库冗余，可能引起混淆 |
| MiniTradePanel 价格趋势图只有相邻价格数字，缺少折线图可视化 | 不符合 frontend_detail.md §4.2 阶段C 设计 |
| 模态组件无法从 GameScene 中触发演示（缺少 mock 触发入口） | 无法在浏览器中看到 TradeModal/EncounterModal/WarehousePanel/SettlementScreen 的效果 |
| Lobby → GameScene 过渡无加载动画 | 违反 P0 第 9 条："LoadingScreen: 鹰角网络式科技加载（开局用）" |
| WorldEventToast 无法在浏览器中演示 | 缺少 mock 触发入口 |

---

## 二、下一阶段任务清单

按优先级分为三个子阶段。

### 子阶段 A：清理与可演示性（优先）

> **目标**：浏览器中可以完整演示所有 FE-Art 组件效果，清理死代码。

| 编号 | 任务 | 产出 | 预估工时 |
|------|------|------|---------|
| **NX-01** | 清理旧文件 | 删除 `components/PlayerPanel.tsx`、`components/TradeForm.tsx`、`components/EventModal.tsx`、`pages/MainPage.tsx`、`App.css` | 0.1h |
| **NX-02** | App.tsx 增加模态演示入口 | 在 GameScene 中通过键盘快捷键或左下角浮动按钮触发 TradeModal / EncounterModal / WarehousePanel / SettlementScreen 四种模态的 mock 演示 | 0.5h |
| **NX-03** | Lobby → Game 过渡加载 | 在 App.tsx 中插入 LoadingScreen（全屏遮罩 + LoadingSpinner + "正在初始化星图网络..."），模拟 1.5s 加载后切换到 GameScene | 0.3h |
| **NX-04** | WorldEventToast 演示入口 | 在 GameScene 中增加一个隐藏的演示按钮（或键盘快捷键如 `T`），调用 `pushWorldToast()` 展示所有 5 种事件类型的效果 | 0.3h |

### 子阶段 B：功能增强

> **目标**：完善 MiniTradePanel 的价格趋势图，提升组件完整度。

| 编号 | 任务 | 产出 | 预估工时 |
|------|------|------|---------|
| **NX-05** | `PriceTrendChart` mini 折线图组件 | 新建 `src/fx/PriceTrendChart.tsx`：SVG 迷你折线图，接收 `data: number[]` + `width/height`，绘制 fill 渐变区域 + 折线 + 端点，支持涨跌颜色自动切换（涨=绿，跌=红） | 1h |
| **NX-06** | 集成到 MiniTradePanel | 在 MiniTradePanel 的"价格趋势"区域替换占位文字为 `<PriceTrendChart data={priceHistory} />` | 0.2h |
| **NX-07** | TopHUD 资金变动动画增强 | 将 TopHUD 中资金显示从简单颜色切换改为 `<AnimatedNumber>` 组件驱动，数字从旧值滚动到新值 | 0.3h |

### 子阶段 C：开发者面板（GA-36）

> **目标**：完成 DevPanel 的完整 UI，预留数据 Props 接口供 FC 对接。

| 编号 | 任务 | 产出 | 预估工时 |
|------|------|------|---------|
| **NX-08** | `DevPanel` 主体结构 | 新建 `src/modals/DevPanel.tsx`：左侧滑出宽面板 600px，四分区（SQL 流 / 事务可视化 / 涟漪回溯 / 数据表快照），等宽字体，科技蓝关键字高亮，`Ctrl+Shift+~` 或 `Alt+D` 触发 | 1.5h |
| **NX-09** | `DevPanel` 子组件 | SQL 流区域：时间戳 + SQL 文本的纵向滚动列表。事务可视化区域：BEGIN → 操作步骤 → COMMIT 流程图（CSS 线条连接）。涟漪回溯区域：站点名称列表。数据表区域：简易表格（Players / StationInventory / TransactionLog）。全部接受 Props，当前用 mock 数据填充 | 2h |
| **NX-10** | 整合到 GameScene | GameScene 中挂载 DevPanel，组合键监听，通过 `isProcessing` 控制不影响游戏流程 | 0.3h |

---

## 三、各任务详细设计

### NX-01：清理旧文件

删除以下文件：
```
src/components/PlayerPanel.tsx     → 已迁移到 src/hud/TopHUD.tsx + src/hud/RightCargoPanel.tsx
src/components/TradeForm.tsx       → 已迁移到 src/modals/TradeModal.tsx
src/components/EventModal.tsx      → 已迁移到 src/modals/EncounterModal.tsx
src/pages/MainPage.tsx             → 已迁移到 src/pages/GameScene.tsx
src/App.css                        → 样式已全部迁移到 src/theme/global.css
```

删除后 `src/components/` 目录变为空目录，可一并删除。

### NX-02：模态演示入口

在 GameScene 中央区域（当前为空的星图占位区）增加一个**调试工具栏**：

```
┌─────────────────────────────────────────┐
│  [交易] [遭遇] [仓库] [结算] [Toast测试]  │  ← 半透明浮动按钮条
└─────────────────────────────────────────┘
```

- 每个按钮触发对应模态的 mock 数据渲染
- 仅在开发环境显示（可加 `import.meta.env.DEV` 判断）
- FE-Core 接入后可移除或保留为调试入口

### NX-03：开局加载过渡

App.tsx 中 LobbyScreen 点击"开始游戏"后：

1. 显示 `<LoadingScreen>`（全屏遮罩 + LoadingSpinner + 动态文字切换）
2. 文字序列：`正在初始化星图网络...` → `正在同步市场数据...` → `正在校准跃迁引擎...`
3. 总时长 1.5-2s（setTimeout 模拟）
4. 完成后切换到 GameScene

### NX-04：WorldEventToast 演示

在调试工具栏中增加按钮，点击后依次触发 5 种事件：

1. `route_blocked`: "⚠ 海盗封锁了阿尔法-贝塔航线"
2. `market_shock`: "📊 全星系晶体价格大幅波动"
3. `route_opened`: "🔗 新的贸易航线已解锁"
4. `wanted_change`: "🚨 你的可疑度上升至 Lv.2"
5. `monopoly_progress`: "🏆 暗物质核心持有率达到 91%，接近垄断！"

### NX-05：PriceTrendChart SVG 折线图

```typescript
interface PriceTrendChartProps {
  data: number[];      // 价格序列
  width?: number;      // 默认 280
  height?: number;     // 默认 100
  color?: string;      // 默认根据首尾价差自动选择涨跌色
}
```

实现细节：
- SVG `<polyline>` 绘制折线
- SVG `<linearGradient>` + `<polygon>` 填充折线下方区域（半透明渐变）
- 首尾端点用 `<circle>` 标出
- 第一个数据点为灰色参考线（虚线水平线）
- 动画：折线从左到右 `stroke-dasharray` 绘制动画

### NX-06：集成到 MiniTradePanel

在 MiniTradePanel 的 `{/* price info */}` 区域之后，`{/* adjacent prices */}` 区域之前，插入：

```tsx
{priceHistory && priceHistory.length > 1 && (
  <Box sx={{ mb: 2 }}>
    <Typography variant="caption" sx={{ color: colors.muted, mb: 0.5, display: 'block' }}>
      价格趋势
    </Typography>
    <PriceTrendChart data={priceHistory} />
  </Box>
)}
```

### NX-07：TopHUD 资金 AnimatedNumber

当前 TopHUD 资金显示为静态数字（仅颜色变化）。改为：

```tsx
<AnimatedNumber
  value={credits}
  duration={600}
  formatted
  style={{ color: creditDelta > 0 ? colors.accent : creditDelta < 0 ? colors.danger : colors.white }}
/>
```

### NX-08~10：DevPanel 开发者面板

**触发**: `Ctrl+Shift+~` 或 `Alt+D`

**面板结构**:
```
┌──────────────────────────────────────┐
│  DEV PANEL                      [X]  │
├──────────────────────────────────────┤
│ [SQL 流] [事务] [涟漪] [数据表]       │  ← Tab 切换栏
├──────────────────────────────────────┤
│                                      │
│  10:45:32.123                        │
│  SELECT * FROM v_station_prices      │
│  WHERE station_id = 5                │
│  ───────────────────────             │
│  10:45:32.456                        │
│  INSERT INTO transaction_logs (...)  │
│  ───────────────────────             │
│  10:45:32.789                        │
│  UPDATE station_inventory SET ...    │
│                                      │
├──────────────────────────────────────┤
│ 查询耗时: 12ms | 事务耗时: 45ms       │  ← 底部性能指标
└──────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface DevPanelProps {
  open: boolean;
  onClose: () => void;
  sqlLog: SqlEntry[];               // SQL 语句流
  transactionSteps?: TxStep[];      // 事务可视化
  rippleTrace?: string[];           // 涟漪回溯站点名
  tableSnapshots?: TableSnapshot[]; // 关键表快照
  perfMetrics?: PerfMetrics;        // 性能指标
}
```

---

## 四、与 FE-Core 的协作点

| 本阶段任务 | FE-Art 产出 | FE-Core 需对接 |
|-----------|------------|---------------|
| NX-02 演示入口 | 调试工具栏 UI | 后续可替换为游戏内实际交互触发 |
| NX-05 PriceTrendChart | 折线图组件 | 传入各商品的历史价格数组 |
| NX-07 AnimatedNumber | 已集成到 TopHUD | 在 patch 更新时传入 `previousCredits` |
| NX-08~10 DevPanel | 完整 UI + Props 接口 | GC-31 收集 SQL 日志 / 事务步骤 / 性能指标等数据 |
| GA-33 ShipTrail | 粒子纹理 + CSS 配置 | GC-12 飞行动画 + PixiJS ParticleContainer 集成 |

---

## 五、开发顺序建议

```
NX-01(清理) → NX-02(演示入口) → NX-03(加载过渡) → NX-04(Toast演示)
    ↓
NX-05(折线图) → NX-06(集成)
    ↓
NX-07(AnimatedNumber)
    ↓
NX-08/09/10(DevPanel)
```

预计总工时：约 **6 小时**。

---

*本文档基于当前代码实际状态编写，明确了 FE-Art 下一阶段需要完成的 10 项任务及详细设计方案。GA-33 ShipTrail 因阻塞于 FC，暂不纳入本阶段。*
