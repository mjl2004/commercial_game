# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## 前端开发阶段总结

这部分总结基于当前前端代码的实际实现，而不是最初的任务拆解文档。当前项目已经形成从登录、大厅、会话生成、星图交互、交易与仓储、遭遇事件、世界推进到胜负结算的完整前端闭环，其中一部分 API 仍属于前端侧会话模拟与本地逻辑编排。

### 第一阶段：随机星图数据驱动 + 相机控制 + 飞船移动闭环

#### 目标

完成游戏主场景的最小可玩闭环，让玩家能够进入星图、浏览站点网络、控制视角，并通过点击完成一次完整移动。

#### 实现内容

当前前端已经建立了完整的会话生成与星图展示基础。`src/game/sessionGenerator.ts` 会根据模板数据生成站点、库存、航线、出生点和初始玩家状态；`src/game/types.ts` 则把站点、航线、货舱、仓库、移动状态、事件状态和会话元信息统一成了一套前端会话模型。  

在渲染层，`src/canvas/StarMap.tsx` 使用 Canvas 绘制星图背景、站点、航线、飞船和高亮提示，并接入 WASD 平移、滚轮缩放、悬停预览、相邻航线提示、目标站点二次确认等交互。移动逻辑已经形成闭环：第一次点击相邻站点进入 targeting，第二次点击确认后触发飞船航行动画，更新当前位置与年份，再根据结果继续进入遭遇事件或世界推进。  

页面容器层由 `src/pages/GameScene.tsx` 承接，负责把星图画布、顶部 HUD、右侧货舱栏、底部信息栏和全局 Toast 叠到统一场景里，并在处理中的状态下加锁界面。`src/store/starMapSlice.ts` 和会话状态一起保存相机、悬停、选中目标、旅行预览等前端交互状态，保证地图操作和主流程同步。

#### 代码落点

- `src/game/sessionGenerator.ts`
- `src/game/types.ts`
- `src/canvas/StarMap.tsx`
- `src/store/starMapSlice.ts`
- `src/pages/GameScene.tsx`

#### 阶段结果

第一阶段完成后，前端已经不再只是静态原型，而是具备了随机生成星图、进入游戏主场景、操作视角、预览航线并完成移动的核心可玩框架，为后续交易、仓库和事件系统提供了稳定承载层。

### 第二阶段：交易打开流程、市场数据读取、MiniTradePanel、买卖请求 mock、涟漪受影响站点高亮

#### 目标

把“到站后交易”从单纯的界面打开，扩展为包含商品读取、买卖执行、局部刷新和市场反馈的完整前端交易流程。

#### 实现内容

当前实现中，玩家点击当前站点即可打开交易面板，交易界面由 `src/modals/TradeModal.tsx` 承载，包含站点商品列表、货舱列表、加载态、错误提示和商品详情入口。选中商品后会弹出 `MiniTradePanel`，展示价格趋势、邻站价格对比、可买可卖数量与总价预估，形成更完整的交易决策界面。  

交易执行逻辑收敛在 `src/api/sessionTradeApi.ts`。这里并不是直接请求真实后端，而是基于当前 `GameSessionData` 在前端侧完成一次交易模拟：校验资金、库存和货舱容量，更新玩家资金与货物、站点库存、价格历史、交易统计，并根据交易站点向外计算最多三跳的价格涟漪影响。交易成功后会把受影响站点写入 `session.ui.ripple`，并通过世界事件通知条反馈交易完成。  

视觉反馈层也已经成型。`src/fx/WorldEventToast.tsx` 提供顶部世界事件通知；`src/fx/useRippleSequence.ts` 和 `StarMap` 内部的 ripple 绘制逻辑一起负责涟漪扩散表现；价格趋势图、商品卡片涨跌、持仓标记和 HUD 资金变化则让交易结果可以被直观看到。

#### 代码落点

- `src/modals/TradeModal.tsx`
- `src/api/sessionTradeApi.ts`
- `src/fx/WorldEventToast.tsx`
- `src/fx/useRippleSequence.ts`
- `src/canvas/StarMap.tsx`

#### 阶段结果

第二阶段完成后，前端已经能够独立支撑一套“开市场、看商品、做买卖、刷新库存、传播价格影响、通知玩家”的交易闭环，且交易结果不只体现在数值变化上，也会回流到星图和通知系统中。

### 第三阶段：仓库面板、分站仓储、取货税/没收前端表现、货舱与仓库状态同步

#### 目标

补齐货物管理能力，让玩家能在不同站点之间进行本地仓储操作，并把货舱与站点仓库状态联动起来。

#### 实现内容

`src/modals/WarehousePanel.tsx` 已经实现为从右侧滑出的仓库管理面板，左侧展示当前飞船货舱，右侧展示当前站点仓库，并分别支持选中、数量调整、存入与取出操作。界面会即时显示货舱占用、仓储货物数量、已存放回合数以及预计取货税费。  

仓储数据本身归属于会话状态。`src/store/sessionSlice.ts` 统一管理交易弹窗、遭遇弹窗、涟漪状态、旅行状态等 UI 信息，货舱与仓库的数据则落在 `GameSessionData` 中，由 `App.tsx` 根据当前站点解析成面板可直接消费的结构。`src/api/sessionWarehouseApi.ts` 则在前端侧模拟仓储操作：存入时校验当前站点和货舱数量，取出时校验仓库数量、货舱容量和可支付税费，并按存放时长与通缉等级计算取货成本。  

目前代码已经真实体现了“分站仓储”的规则。仓库是按站点 ID 分开的，不同空间站各自维护自己的存货列表；玩家必须到达对应站点才能取出。文档里提到的“没收”在当前实现中还没有独立的执法没收流程，但高通缉下的取货税会随等级增加而抬高，因此 README 中需要如实描述为税费表现和风险成本，而不是已经落地的没收机制。

#### 代码落点

- `src/modals/WarehousePanel.tsx`
- `src/api/sessionWarehouseApi.ts`
- `src/store/sessionSlice.ts`
- `src/App.tsx`

#### 阶段结果

第三阶段让前端从单一货舱买卖扩展到了“飞船货舱 + 分站仓库”的双库存结构。玩家现在可以把货物转为中长期存放资产，仓储成本也会随着时间和风险状态变化，进一步丰富了经营层决策。

### 第四阶段：遭遇事件接入、移动后严格结算顺序、世界回合推进、全局事件通知

#### 目标

在移动与交易主链路上接入事件系统和世界推进逻辑，让游戏节奏从“单次动作响应”升级为“动作后驱动世界变化”的回合式前端体验。

#### 实现内容

遭遇事件已经接入移动链路。`src/canvas/StarMap.tsx` 在旅行动画完成后会调用 `rollEncounter`，若命中事件则把移动结果先写回会话，再通过 `startEncounter` 打开事件弹窗。`src/modals/EncounterModal.tsx` 已经支持事件标题、描述、选项、禁用态和结算结果展示，玩家处理完事件后才会继续完成本回合收尾。  

事件解析和世界推进分成了两层：`src/api/sessionEncounterApi.ts` 负责从事件池抽取事件、应用选项效果、更新金钱、年份、终止年份、通缉等级、拘留年数和事件统计；`src/api/sessionWorldApi.ts` 则负责在动作结束后推进世界年份、增加仓库存放回合、衰减嫌疑值、处理通缉等级下降，并随机推送路线或市场类全局通知。这样移动、交易、事件和世界变化之间形成了清晰的前端顺序。  

全局通知体系已经统一到 `pushWorldToast` 和 `WorldEventToast` 上。移动后可能出现路线情报更新，交易后可能出现市场震荡扩散，仓储后也会推送对应反馈。前端因此具备了“动作触发世界响应”的持续反馈能力，而不只是局部面板变更。

#### 代码落点

- `src/modals/EncounterModal.tsx`
- `src/api/sessionEncounterApi.ts`
- `src/api/sessionWorldApi.ts`
- `src/canvas/StarMap.tsx`
- `src/fx/WorldEventToast.tsx`

#### 阶段结果

第四阶段完成后，前端已经拥有严格的动作结算节奏：移动不只是位移，交易不只是改数值，所有关键操作都会回流到事件系统、时间推进和世界通知中，游戏整体节奏也因此完整建立起来。

### 第五阶段：垄断进度实时计算、区域视图、胜负结算、断线/恢复策略、API 形态向后端契约收敛

#### 目标

收束整条前端主流程，补齐胜负判定、区域垄断视图、会话恢复和统一会话 API，使项目从“可玩 Demo”进入“具备完整单局生命周期”的状态。

#### 实现内容

垄断相关逻辑已经集中在 `src/game/monopolyService.ts`。这里会计算每种商品的银河系持有率、区域垄断高亮状态以及最终胜利条件，并在世界推进后统一评估当前局势。`StarMap` 和 `BottomInfoBar` 会消费这些结果：底部 HUD 展示所有商品的实时垄断进度，地图则能切换到区域视图并标记局部垄断站点。  

结算流程已经落地到 `src/modals/SettlementScreen.tsx` 和 `src/App.tsx`。当玩家达成胜利、破产、拘留超限或年份耗尽时，前端会打开结算页，展示资金、垄断、交易、事件等维度的分项得分和总分，并支持重开或返回大厅。`App.tsx` 也已经把登录、进入大厅、加载、新局开始、游戏进行中、结算回退等主流程串成了单一入口。  

恢复策略则采用了前端本地会话持久化，而不是后端断线重连。`src/api/sessionApi.ts` 负责读取模板、生成新局、规范化旧数据、写入 `localStorage`、恢复已存会话，并用版本号兼容字段演进。也就是说，当前“恢复”能力是浏览器本地会话恢复与刷新后续玩，不是网络断线后的服务端状态重建。与此同时，这一层 API 也已经把“创建会话、恢复会话、标准化会话数据”的前端契约收敛到了统一入口，方便未来继续向后端正式接口迁移。

#### 代码落点

- `src/game/monopolyService.ts`
- `src/modals/SettlementScreen.tsx`
- `src/api/sessionApi.ts`
- `src/App.tsx`
- `src/canvas/StarMap.tsx`

#### 阶段结果

第五阶段完成后，前端已经具备单局游戏的完整生命周期管理能力：能开局、能持续推进、能实时评估垄断进度、能在达成条件后结算，也能在刷新后从本地恢复当前会话继续体验。

### 整体完成度与当前前端能力

截至当前代码，前端已经形成一条完整的单局体验闭环。玩家可以从登录进入大厅，启动新局后进入加载态，再进入由星图、HUD、交易、仓库、事件和通知系统共同构成的游戏主场景，最后在胜利、失败或时间耗尽时进入结算页。  

在数据层，前端已经建立了统一的 `GameSessionData` 会话模型，并通过 `persistSession` / `restoreSession` 完成本地持久化与恢复；在交互层，星图浏览、移动确认、交易执行、仓储转移、事件处理、世界推进和胜负判定已经全部串联起来；在表现层，HUD、涟漪扩散、价格趋势、顶部通知和结算动画也已经把这些机制转换成了可视化反馈。  

因此，这套前端实现已经不是零散的界面集合，而是一套可运行、可继续扩展、并且具备完整节奏组织能力的游戏前端骨架。后续如果继续推进到真实后端联调，主要工作会集中在把当前前端侧的会话模拟 API 逐步替换成正式服务接口，而不是从头重搭界面和交互框架。


### 修复移动遇到遭遇事件时的年份结算

原先移动逻辑中，正常移动和“移动后触发遭遇事件”的处理路径不一致：

- 不触发事件时，会直接执行世界推进，正常扣除航线年份。
- 触发事件时，会先进入事件弹窗，后续确认时再补推进时间，但这段逻辑不稳定，导致航线基础年份可能没有被结算。

本轮的处理方式是把“移动基础年份消耗”和“事件额外年份效果”拆开管理：

- 移动到目标站点后，前端保留一份 `pendingAction`。
- `pendingAction` 中至少记录：
  - `type`
  - `stationId`
  - `targetStationId`
  - `yearsCost`
  - `baseYearsSettled`
- 如果未触发事件：
  - 直接执行世界推进，`yearsElapsed = route.travelCost`
- 如果触发事件：
  - 先进入事件选择流程
  - 事件选择时只应用事件本身的效果
  - 玩家确认事件结果后，再统一补结算这条航线的基础年份

这样可以保证：

- 航线基础年份只结算一次
- 事件额外年份和航线年份分别可控
- 后续后端接管时，可以直接把这两段结算顺序映射到服务端事务流程

### 修复“额外扣留 1 世界年份”的实际含义

原先事件效果里一度使用了类似 `detainedSecondsDelta` 或 `detainedYearsDelta` 的字段，容易和真正的拘留惩罚链路混淆。

本轮统一后的规则是：

- “额外扣留 1 世界年份”本质上是：
  - `currentYear += 1`
- 它不是：
  - `detainedYears += 1`

因此本轮做了两项调整：

1. 巡检事件池中的该选项改为使用 `yearDelta: 1`
2. 遭遇事件结算逻辑中，只要选项携带 `yearDelta`，就直接推进 `currentYear`

这意味着：

- 玩家会真实消耗 1 世界年份
- 不会因为这条事件直接触发拘留超限失败
- 只有真正的拘留惩罚事件，才应该增加 `detainedYears`