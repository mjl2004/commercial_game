# 前后端待对接点总览

## 1. 现状结论

当前项目的前后端边界已经初步抽象出来，但还没有真正联通。整体上需要对接的地方主要集中在三层：

- `gateway` 层：前端已经定义了 `authGateway` 和 `gameGateway` 两套入口，是真正的对接总开关。
- `frontend/src/api/*` 层：一部分文件是旧版 HTTP API 包装，一部分文件承载了当前真实运行中的本地 session/mock 规则。
- 页面与状态层：`App.tsx`、`StarMap.tsx`、交易/仓储/结算/排行榜等 UI 已经通过 gateway 间接依赖业务数据，但仍有少量本地计算逻辑没有迁移。

当前代码中的关键事实如下：

- 前端默认运行在 `mock` 模式，`frontend/src/gateways/index.ts` 中 `DATA_MODE=backend` 分支仍然返回 mock 实现。
- 当前真正驱动主流程的是 `mockGameGateway`，它内部依赖：
  - `sessionApi.ts`
  - `sessionTradeApi.ts`
  - `sessionWarehouseApi.ts`
  - `sessionEncounterApi.ts`
  - `sessionWorldApi.ts`
- 认证、登录态和排行榜仍然完全依赖 `authApi.ts` 与 `mockAuthGateway.ts` 的 `localStorage` mock。
- 旧版 HTTP API 文件依然存在，但没有驱动当前主流程：
  - `playerApi.ts`
  - `tradeApi.ts`
  - `moveApi.ts`
  - `eventApi.ts`
  - `starMapApi.ts`
  - `websocket.ts`

结论上，当前真正需要与后端对接的，不是某一个页面，而是：

`gateway -> session/mock 规则 -> 页面消费`

这一整条链路。

---

## 2. 现行主流程边界与遗留边界

### 2.1 现行主流程边界

当前主流程以 `frontend/src/gateways/types.ts` 为前端契约中心，以 `authGateway` 和 `gameGateway` 为唯一业务入口。

主要调用点：

- `App.tsx`
  - 登录 / 注册
  - 新局开始
  - 会话恢复
  - 排行榜展示
  - 交易
  - 仓储
  - 遭遇事件确认
  - 结算分数记录
- `StarMap.tsx`
  - 移动主流程
  - 打开交易弹窗

这里是后端接入时最优先要保持稳定的边界。

### 2.2 遗留 / 占位边界

以下文件使用了 `httpClient` 或 WebSocket，但当前没有进入主流程，属于遗留接口或占位实现：

- `frontend/src/api/playerApi.ts`
- `frontend/src/api/tradeApi.ts`
- `frontend/src/api/moveApi.ts`
- `frontend/src/api/eventApi.ts`
- `frontend/src/api/starMapApi.ts`
- `frontend/src/api/websocket.ts`

这些文件说明项目早期曾尝试按传统 REST API 拆分接口，但现在真实运行逻辑已经转移到 `mockGameGateway + session*Api` 链路。后续联调应优先按 `gateway` 契约推进，而不是继续以旧 `api/*.ts` 为主线扩展。

---

## 3. 所有待对接点盘点

### 3.1 认证与排行榜

前端入口：

- `authGateway.register`
- `authGateway.login`
- `authGateway.logout`
- `authGateway.getCurrentAccount`
- `authGateway.getLeaderboard`
- `authGateway.recordScore`

当前实现：

- `frontend/src/api/authApi.ts`
- `frontend/src/gateways/mockAuthGateway.ts`
- 数据存储在 `localStorage`

后端应承接的行为：

- 用户注册
- 用户登录
- 当前用户信息读取
- 用户登出
- 排行榜查询
- 结算分数上报

当前状态：

- 后端尚未提供这一组正式接口雏形
- 前端尚未存在 `backendAuthGateway`

### 3.2 会话与新局

前端入口：

- `gameGateway.startSession`
- `gameGateway.restoreSession`
- `gameGateway.persistSession`

当前实现：

- `frontend/src/api/sessionApi.ts`
- `frontend/src/game/sessionGenerator.ts`
- `frontend/public/data/session-template.json`
- `localStorage`

当前本地承担的职责：

- 新局模板读取
- 随机星图生成
- 玩家初始状态生成
- 会话规范化
- 会话本地持久化与恢复

后端应承接的行为：

- 创建新局
- 读取当前局
- 持久化当前局

当前状态：

- 后端已经开始提供 `/api/session/*` 主链接口雏形
- 前端还没有 `backendGameGateway` 去调用这些接口

### 3.3 交易与市场

前端入口：

- `gameGateway.openMarket`
- `gameGateway.executeTrade`

当前实现：

- `frontend/src/api/sessionTradeApi.ts`

当前本地规则包括：

- 当前站点校验
- 资金校验
- 站点库存校验
- 货舱容量校验
- 买卖后 `credits` / `cargo` 更新
- 站点库存更新
- 价格历史更新
- 涟漪传播
- 交易后世界推进

UI 消费位置：

- `App.tsx`
- `TradeModal.tsx`
- `MiniTradePanel`

后端应承接的行为：

- 市场读取
- 买入 / 卖出结算
- 价格与库存变动
- 涟漪传播结果返回
- 交易后的 session 更新

当前状态：

- 后端已经开始提供 `/api/session/{session_id}/trade`
- 前端尚未接通真实接口

### 3.4 仓储

前端入口：

- `gameGateway.depositWarehouse`
- `gameGateway.withdrawWarehouse`

当前实现：

- `frontend/src/api/sessionWarehouseApi.ts`

当前本地规则包括：

- 当前站点限制
- 仓库存货 / 取货
- 货舱容量校验
- 取货税费计算
- `wantedLevel` 与 `storedTurns` 联动

UI 消费位置：

- `WarehousePanel.tsx`
- `App.tsx`

后端应承接的行为：

- 仓库存入
- 仓库取出
- 税费计算
- 仓库状态更新

当前状态：

- 后端已经开始提供：
  - `/api/session/{session_id}/warehouse/deposit`
  - `/api/session/{session_id}/warehouse/withdraw`
- 前端尚未接通真实接口

### 3.5 移动、遭遇事件、世界推进

前端入口：

- `gameGateway.startMove`
- `gameGateway.resolveEncounterChoice`
- `gameGateway.finalizeEncounterAndAdvance`
- `gameGateway.advanceWorld`

当前实现：

- `frontend/src/gateways/mockGameGateway.ts`
- `frontend/src/api/sessionEncounterApi.ts`
- `frontend/src/api/sessionWorldApi.ts`
- `frontend/src/game/encounterPool.ts`

当前本地规则包括：

- 目标站移动
- `pendingAction` 写入
- 随机遭遇事件
- 事件选项结算
- 世界年份推进
- 仓库存放年数增长
- suspicion / wanted 变化

UI 消费位置：

- `StarMap.tsx`
- `EncounterModal.tsx`
- `App.tsx`

后端应承接的行为：

- 移动发起
- 是否遭遇事件的判定
- 事件选择结算
- 事件确认后的世界推进
- 非事件情况下的世界推进

当前状态：

- 后端已经开始提供：
  - `/api/session/{session_id}/move/start`
  - `/api/session/{session_id}/encounter/resolve`
  - `/api/session/{session_id}/encounter/finalize`
  - `/api/session/{session_id}/world/advance`
- 前端尚未接通真实接口

### 3.6 结算与胜负判定

前端入口：

- `gameGateway.evaluateSettlement`

当前实现：

- `frontend/src/game/monopolyService.ts`
- `App.tsx` 中的结算拆分与总分计算

当前仍在前端计算的内容：

- 垄断进度
- 区域垄断高亮
- 胜负状态
- 结算得分拆解

UI 消费位置：

- `SettlementScreen.tsx`
- `BottomInfoBar.tsx`
- `App.tsx`

后端应承接的行为：

- 如需服务端统一判定，则应承接：
  - 胜负判断
  - 结算拆分
  - 总分计算

说明：

- 即使短期内不迁移到后端，这一块也应被记录为业务边界点，因为它直接影响排行榜分数与最终玩家状态。

### 3.7 WebSocket 与推送

当前占位：

- `frontend/src/api/websocket.ts`
- `backend/app/api/websocket.py`

当前状态：

- 前端主流程未真正接入 WebSocket
- 后端存在 WebSocket 路由与广播管理器雏形

潜在后端用途：

- 市场价格更新广播
- 世界事件推送
- 通缉等级变化推送
- 多客户端同步场景预留

---

## 4. 推荐对接顺序

建议按下面顺序推进，避免同时改页面、协议和规则导致失焦。

### 1. 认证与排行榜

前端入口方法：

- `authGateway.*`

当前依赖文件：

- `authApi.ts`
- `mockAuthGateway.ts`

后端应承接：

- 注册
- 登录
- 当前用户
- 登出
- 排行榜查询
- 结算分数写入

后端雏形：

- 暂无正式雏形

### 2. 会话 start / get / persist

前端入口方法：

- `gameGateway.startSession`
- `gameGateway.restoreSession`
- `gameGateway.persistSession`

当前依赖文件：

- `sessionApi.ts`
- `sessionGenerator.ts`

后端应承接：

- 创建新局
- 读取当前局
- 保存当前局

后端雏形：

- 已有 `/api/session/start`
- 已有 `/api/session/{session_id}`
- session JSON 持久化链路已开始搭建

### 3. 交易与市场

前端入口方法：

- `gameGateway.openMarket`
- `gameGateway.executeTrade`

当前依赖文件：

- `sessionTradeApi.ts`

后端应承接：

- 市场读取
- 买卖结算
- 交易后 session 返回

后端雏形：

- 已有 `/api/session/{session_id}/trade`
- 市场单独读取接口仍未成型

### 4. 仓储

前端入口方法：

- `gameGateway.depositWarehouse`
- `gameGateway.withdrawWarehouse`

当前依赖文件：

- `sessionWarehouseApi.ts`

后端应承接：

- 仓库存货
- 仓库取货
- 税费与容量校验

后端雏形：

- 已有 deposit / withdraw 雏形

### 5. 移动 / 遭遇 / 世界推进

前端入口方法：

- `gameGateway.startMove`
- `gameGateway.resolveEncounterChoice`
- `gameGateway.finalizeEncounterAndAdvance`
- `gameGateway.advanceWorld`

当前依赖文件：

- `mockGameGateway.ts`
- `sessionEncounterApi.ts`
- `sessionWorldApi.ts`

后端应承接：

- 移动发起
- 遭遇结算
- 世界推进

后端雏形：

- 已有 `/api/session/{session_id}/move/start`
- 已有 `/api/session/{session_id}/encounter/*`
- 已有 `/api/session/{session_id}/world/advance`

### 6. 结算与排行榜落分

前端入口方法：

- `gameGateway.evaluateSettlement`
- `authGateway.recordScore`

当前依赖文件：

- `monopolyService.ts`
- `App.tsx`

后端应承接：

- 胜负判定统一口径
- 结算得分拆分
- 排行榜落分

后端雏形：

- 暂无正式结算接口

### 7. WebSocket 推送

前端入口方法：

- `connectWebSocket`

当前依赖文件：

- `websocket.ts`

后端应承接：

- 价格广播
- 世界事件推送
- 通缉等级推送

后端雏形：

- 已有 `backend/app/api/websocket.py` 占位实现

---

## 5. 关键结论与风险点

### 5.1 关键结论

- 当前真正要接的是 `gateway -> 本地 session/mock 规则 -> 页面消费` 的整条链，而不是单个页面按钮。
- `frontend/src/gateways/index.ts` 是 mock/backend 切换总开关，但 `backend` 分支尚未接真实实现。
- `frontend/src/gateways/types.ts` 是当前最重要的前端契约来源，应作为前后端对齐的第一参考。
- 当前后端已经开始实现 `/api/session/*` 主链，因此前端优先级应是补 `backendAuthGateway` / `backendGameGateway`，而不是继续扩散页面层 HTTP 调用。

### 5.2 风险点

- 旧 `api/*.ts` 与现行 gateway 流程脱节，若继续扩展旧接口，容易造成两套对接方式并存。
- 当前不少规则仍在前端本地计算，若后端开始接管，必须明确“谁是最终状态来源”。
- `httpClient` 当前的返回结构假设为 `ApiResponse<T> = { data: T }`，而新后端 session 接口目前是直接返回对象，联调时需要统一。
- `openMarket` 目前本地只有延时与站点校验，没有真正的独立后端协议，后续需要明确是否保留为单独接口。
- 结算与排行榜存在跨域依赖：如果分数仍由前端算，而排行榜由后端存，就需要明确服务端是否复核分数。

---

## 6. 对接建议

建议下一步从以下两个动作开始：

1. 新增 `backendAuthGateway` 与 `backendGameGateway`
   - 保持页面层完全不变
   - 只替换 gateway 内部实现

2. 优先打通 session 主链
   - `startSession`
   - `restore/getSession`
   - `persistSession`
   - `executeTrade`
   - `depositWarehouse`
   - `withdrawWarehouse`

这样可以最小成本验证“前端是否能脱离本地 mock，开始使用后端 authoritative session”。

