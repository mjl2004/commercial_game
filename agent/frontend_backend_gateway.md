# 前端遭遇事件年份修正与前后端接口整理说明

## 1. 文档目的

这份文档用于整理本轮前端修改的两个核心方向：

1. 修复遭遇事件相关的世界年份结算问题。
2. 将当前仍由前端本地实现的数据计算与规则处理，统一整理为可切换 `mock / backend` 的 gateway 门面，方便后续后端完成后直接接入。

本文档聚焦三个问题：

- 这次具体改了什么。
- 前端目前有哪些接口需要和后端连接。
- 每一条前后端数据流应该如何对应。

---

## 2. 本轮问题背景

### 2.1 原有问题

在当前前端实现中，移动与遭遇事件存在两类时间结算问题：

1. 玩家沿航线移动时，如果触发了遭遇事件，航线本身需要消耗的世界年份没有被稳定结算。
2. 遭遇事件中的“额外扣留 1 世界年份”虽然已经从旧的“30 秒”文案调整过一次，但逻辑上仍然没有真实推进 `currentYear`，或者仍和 `detainedYears` 混用，导致行为和文案不一致。

同时，前端已有大量本地计算逻辑，例如：

- 新局生成
- 会话恢复
- 交易计算
- 仓库税费计算
- 移动与事件结算
- 世界推进
- 结算评分
- 认证与排行榜

这些逻辑虽然已经被分散放在 `src/api/*.ts` 或 `src/game/*.ts` 中，但页面层仍然直接依赖这些本地实现细节，不利于后端接管。

### 2.2 本轮目标

本轮修改的目标是：

- 修正遭遇事件中的时间结算链路。
- 统一前端与后端连接边界。
- 让页面层只调用门面接口，不直接关心当前是本地 mock 还是后端真实实现。

---


### 3.3 建立统一 gateway 门面

为了方便后端后续接入，本轮新建了 gateway 层，把页面直接依赖的本地规则收口起来。

新增目录：

- `frontend/src/gateways/`

新增文件：

- `frontend/src/gateways/types.ts`
- `frontend/src/gateways/index.ts`
- `frontend/src/gateways/mockAuthGateway.ts`
- `frontend/src/gateways/mockGameGateway.ts`

这一层的职责是：

- 对页面暴露统一接口
- 内部决定当前走 mock 还是 backend
- 后续只替换门面实现，不改页面调用方式

### 3.4 页面层改造

本轮重点改造了两个页面/容器入口：

#### `App.tsx`

现在 `App.tsx` 不再直接调用：

- `authApi`
- `sessionApi`
- `sessionTradeApi`
- `sessionWarehouseApi`
- `sessionEncounterApi`
- `sessionWorldApi`

而是统一改为通过：

- `authGateway`
- `gameGateway`

来处理：

- 登录注册
- 新局开始
- 会话恢复
- 排行榜
- 交易
- 仓储
- 遭遇事件确认
- 结算入榜

#### `StarMap.tsx`

现在 `StarMap.tsx` 不再自己拼接移动后的完整规则结算，而是只负责：

- 玩家点击航线目标
- 触发飞船动画
- 动画结束后调用 `gameGateway.startMove(...)`

真正的移动后结果由 gateway 统一返回：

- 新会话状态
- 是否触发遭遇事件

这为未来移动逻辑改成真实后端请求预留了完整接口边界。

---

## 4. 当前 gateway 结构说明

### 4.1 `authGateway`

职责：

- 登录
- 注册
- 登出
- 当前账号读取
- 排行榜读取
- 记录历史最高分

当前实现：

- `mockAuthGateway`

当前数据来源：

- `localStorage`

后续后端实现方式：

- 替换为 `backendAuthGateway`

### 4.2 `gameGateway`

职责：

- 新局生成
- 会话恢复与持久化
- 开市场
- 交易
- 仓储
- 移动
- 遭遇事件选择
- 遭遇事件确认后的世界推进
- 世界推进
- 胜负结算

当前实现：

- `mockGameGateway`

当前数据来源：

- 本地 `GameSessionData`
- 本地计算逻辑
- `localStorage`

后续后端实现方式：

- 替换为 `backendGameGateway`

### 4.3 切换方式

当前 `frontend/src/gateways/index.ts` 已经预留了：

- `VITE_DATA_MODE=mock|backend`

当前虽然 `backend` 分支还没有真实实现，但页面层已经不再依赖底层本地规则文件，因此后端接入时只需要补 gateway 内部实现。

---

## 5. 当前前后端接口清单

下面把“前端应该调用什么接口”和“当前本地 mock 对应的处理位置”全部列出来。

## 5.1 认证与排行榜接口

### 1. 注册账号

- 前端门面方法：
  - `authGateway.register(payload)`
- 前端请求数据：
  ```ts
  {
    email: string;
    password: string;
    nickname: string;
  }
  ```
- 当前 mock 实现：
  - `frontend/src/api/authApi.ts -> registerAccount`
- 后端建议接口：
  - `POST /api/auth/register`
- 后端建议响应：
  ```json
  {
    "ok": true,
    "account": {
      "id": "acc-001",
      "email": "pilot@galaxy.com",
      "nickname": "Pilot",
      "bestScore": 0,
      "createdAt": "2026-05-29T10:00:00Z",
      "updatedAt": "2026-05-29T10:00:00Z"
    }
  }
  ```

### 2. 登录账号

- 前端门面方法：
  - `authGateway.login(payload)`
- 前端请求数据：
  ```ts
  {
    email: string;
    password: string;
  }
  ```
- 当前 mock 实现：
  - `frontend/src/api/authApi.ts -> loginAccount`
- 后端建议接口：
  - `POST /api/auth/login`
- 后端建议响应：
  ```json
  {
    "ok": true,
    "account": {
      "id": "acc-001",
      "email": "pilot@galaxy.com",
      "nickname": "Pilot",
      "bestScore": 12500,
      "createdAt": "2026-05-29T10:00:00Z",
      "updatedAt": "2026-05-29T10:30:00Z"
    },
    "token": "future-jwt-or-session-token"
  }
  ```

### 3. 登出

- 前端门面方法：
  - `authGateway.logout()`
- 当前 mock 实现：
  - 清除本地登录态
- 后端建议接口：
  - `POST /api/auth/logout`

### 4. 获取当前账号

- 前端门面方法：
  - `authGateway.getCurrentAccount()`
- 当前 mock 实现：
  - `localStorage` 读取
- 后端建议接口：
  - `GET /api/auth/me`

### 5. 查询排行榜

- 前端门面方法：
  - `authGateway.getLeaderboard()`
- 当前 mock 实现：
  - `frontend/src/api/authApi.ts -> getLeaderboard`
- 后端建议接口：
  - `GET /api/leaderboard`
- 后端建议响应：
  ```json
  {
    "entries": [
      {
        "rank": 1,
        "accountId": "acc-001",
        "nickname": "Pilot",
        "emailMasked": "pi***@galaxy.com",
        "bestScore": 18200,
        "updatedAt": "2026-05-29T12:00:00Z"
      }
    ]
  }
  ```

### 6. 记录历史最高分

- 前端门面方法：
  - `authGateway.recordScore(accountId, score)`
- 当前 mock 实现：
  - `frontend/src/api/authApi.ts -> recordScore`
- 后端建议接口：
  - `POST /api/leaderboard/record`
- 前端请求数据：
  ```json
  {
    "accountId": "acc-001",
    "score": 18200
  }
  ```

---

## 5.2 会话与新局接口

### 1. 新建游戏会话

- 前端门面方法：
  - `gameGateway.startSession(playerName)`
- 当前 mock 实现：
  - `session-template.json`
  - `createGameSession`
  - `normalizeSession`
- 后端建议接口：
  - `POST /api/session/start`
- 前端请求数据：
  ```json
  {
    "nickname": "Pilot"
  }
  ```
- 后端建议响应：
  - 直接返回完整 `GameSessionData`

### 2. 恢复会话

- 前端门面方法：
  - `gameGateway.restoreSession()`
- 当前 mock 实现：
  - `restoreSession()`
- 后端建议接口：
  - `GET /api/session/current`

### 3. 持久化会话

- 前端门面方法：
  - `gameGateway.persistSession(session)`
- 当前 mock 实现：
  - `localStorage`
- 后端建议接口：
  - `PUT /api/session/current`

---

## 5.3 移动与遭遇事件接口

### 1. 发起移动

- 前端门面方法：
  - `gameGateway.startMove(session, { stationId, targetStationId, yearsCost })`
- 当前 mock 实现：
  - 本地更新玩家站点
  - 写入 `pendingAction`
  - 随机 `rollEncounter`
- 后端建议接口：
  - `POST /api/game/move`
- 前端请求数据：
  ```json
  {
    "sessionId": "session-123",
    "fromStationId": 2,
    "targetStationId": 5
  }
  ```
- 后端建议响应：
  ```json
  {
    "session": { "...完整或增量状态..." : true },
    "encounter": {
      "id": "enc-patrol-check",
      "title": "临检巡逻队",
      "description": "......",
      "choices": []
    }
  }
  ```

### 2. 提交遭遇事件选择

- 前端门面方法：
  - `gameGateway.resolveEncounterChoice(session, { choiceId, pendingAction })`
- 当前 mock 实现：
  - `frontend/src/api/sessionEncounterApi.ts -> resolveEncounter`
- 后端建议接口：
  - `POST /api/game/encounter/choice`
- 前端请求数据：
  ```json
  {
    "sessionId": "session-123",
    "choiceId": 2,
    "pendingAction": {
      "type": "move",
      "stationId": 2,
      "targetStationId": 5,
      "yearsCost": 3,
      "baseYearsSettled": false
    }
  }
  ```

### 3. 确认遭遇事件结果并推进世界

- 前端门面方法：
  - `gameGateway.finalizeEncounterAndAdvance(session)`
- 当前 mock 实现：
  - 根据 `pendingAction.baseYearsSettled`
  - 补扣移动基础年份
  - 执行世界推进
- 后端建议接口：
  - `POST /api/game/encounter/confirm`
- 前端请求数据：
  ```json
  {
    "sessionId": "session-123"
  }
  ```

---

## 5.4 交易接口

### 1. 打开市场

- 前端门面方法：
  - `gameGateway.openMarket(session, stationId)`
- 当前 mock 实现：
  - 校验当前站点
  - 本地延迟模拟
- 后端建议接口：
  - `GET /api/stations/{stationId}/market`

### 2. 执行交易

- 前端门面方法：
  - `gameGateway.executeTrade(session, payload)`
- 当前 mock 实现：
  - `frontend/src/api/sessionTradeApi.ts -> executeTrade`
- 当前本地做的计算包括：
  - 资金校验
  - 库存校验
  - 货舱容量校验
  - 买卖后资金变化
  - 货舱变化
  - 站点库存变化
  - 价格历史更新
  - 涟漪传播
  - 世界推进
- 后端建议接口：
  - `POST /api/game/trade`
- 前端请求数据：
  ```json
  {
    "sessionId": "session-123",
    "stationId": 5,
    "goodsId": 2,
    "quantity": 10,
    "tradeType": "buy"
  }
  ```

---

## 5.5 仓储接口

### 1. 存入仓库

- 前端门面方法：
  - `gameGateway.depositWarehouse(session, payload)`
- 当前 mock 实现：
  - `frontend/src/api/sessionWarehouseApi.ts -> depositToWarehouse`
- 当前本地做的计算包括：
  - 当前站点校验
  - 货舱数量校验
  - 仓库条目更新
- 后端建议接口：
  - `POST /api/game/warehouse/deposit`

### 2. 取出仓库

- 前端门面方法：
  - `gameGateway.withdrawWarehouse(session, payload)`
- 当前 mock 实现：
  - `frontend/src/api/sessionWarehouseApi.ts -> withdrawFromWarehouse`
- 当前本地做的计算包括：
  - 当前站点校验
  - 仓库存量校验
  - 货舱容量校验
  - 税费计算
  - 扣除资金
  - 合并货舱成本
- 后端建议接口：
  - `POST /api/game/warehouse/withdraw`

---

## 5.6 世界推进与胜负结算接口

### 1. 世界推进

- 前端门面方法：
  - `gameGateway.advanceWorld(session, yearsElapsed, source)`
- 当前 mock 实现：
  - `frontend/src/api/sessionWorldApi.ts -> advanceWorldState`
- 当前本地做的计算包括：
  - `currentYear` 增加
  - 仓库存放回合增加
  - `suspicion` 衰减
  - `wantedLevel` 下降
  - 随机世界提示
  - 胜负判定
- 后端建议接口：
  - `POST /api/game/world/advance`

### 2. 胜负与结算判定

- 前端门面方法：
  - `gameGateway.evaluateSettlement(session)`
- 当前 mock 实现：
  - `frontend/src/game/monopolyService.ts -> evaluateGameState`
- 当前本地做的计算包括：
  - 垄断持有率
  - 区域垄断
  - 胜利条件
  - 破产条件
  - 时间耗尽条件
- 后端建议接口：
  - `POST /api/game/settlement/evaluate`

### 3. 结算总分

当前结算总分仍然在 `App.tsx` 中根据现有规则生成：

- 资金加成
- 垄断加成
- 交易次数加成
- 事件次数加成

后端建议补接口：

- `POST /api/game/settlement/score`

请求数据：

```json
{
  "sessionId": "session-123"
}
```

返回数据：

```json
{
  "result": "won",
  "breakdown": {
    "creditsBonus": 8200,
    "monopolyBonus": 5000,
    "tradeBonus": 1200,
    "eventBonus": 600,
    "total": 15000
  }
}
```

---

## 6. 当前前后端数据流说明

下面按业务流程说明“前端发起 -> gateway -> mock/后端 -> 状态回流”的对应关系。

## 6.1 登录/注册数据流

### 注册

1. `LoginScreen` 收集邮箱、密码、昵称
2. 页面调用 `authGateway.register(payload)`
3. 当前 mock 中：
   - 校验邮箱唯一
   - 本地写入账号
   - 生成当前登录态
4. 返回 `account`
5. `App.tsx` 写入当前账号并进入大厅

后端接入后：

1. `authGateway.register`
2. 改为请求 `POST /api/auth/register`
3. 返回账号信息
4. 页面流程不变

### 登录

1. `LoginScreen` 收集邮箱、密码
2. 页面调用 `authGateway.login(payload)`
3. 当前 mock 中：
   - 本地校验邮箱和密码
   - 写入登录态
4. 返回账号信息
5. `App.tsx` 进入大厅

---

## 6.2 新局开始数据流

1. `LobbyScreen` 点击开始游戏
2. `App.tsx` 调用 `gameGateway.startSession(account.nickname)`
3. 当前 mock 中：
   - 读取 `session-template.json`
   - 随机生成星图和初始玩家状态
   - 规范化会话
   - 持久化到本地
4. 返回完整 `GameSessionData`
5. `App.tsx`：
   - 写入 Redux session
   - 写入星图 planets / connections
   - 切换到 `game`

后端接入后：

1. `gameGateway.startSession`
2. 改为请求 `POST /api/session/start`
3. 返回完整会话
4. 页面流程不变

---

## 6.3 移动与遭遇事件数据流

1. 玩家在 `StarMap` 中二次点击目标站点确认移动
2. `StarMap` 播放飞船动画
3. 动画结束后调用：
   - `gameGateway.startMove(session, { stationId, targetStationId, yearsCost })`
4. 当前 mock 中：
   - 先更新玩家位置
   - 生成 `pendingAction`
   - 决定是否触发遭遇事件
5. 返回：
   - `session`
   - `encounter | null`

### 如果没有遭遇事件

6. `StarMap` 调用 `gameGateway.advanceWorld(session, yearsCost, 'move')`
7. Redux 更新会话
8. HUD 和地图重新渲染

### 如果触发遭遇事件

6. `StarMap` 打开 `EncounterModal`
7. 玩家点击选项
8. `App.tsx` 调用：
   - `gameGateway.resolveEncounterChoice(session, { choiceId, pendingAction })`
9. 当前 mock 中：
   - 应用事件自己的效果
   - 更新事件结果
10. 玩家点击确认结果
11. `App.tsx` 调用：
   - `gameGateway.finalizeEncounterAndAdvance(session)`
12. 当前 mock 中：
   - 检查 `pendingAction.baseYearsSettled`
   - 若未结算，则补扣航线基础年份
   - 再执行世界推进
13. Redux 更新会话
14. 返回自由探索状态

---

## 6.4 交易数据流

1. 玩家点击当前站点打开市场
2. `App.tsx` 调用 `gameGateway.openMarket(session, stationId)`
3. 当前 mock 中：
   - 校验当前站点
   - 模拟加载延迟
4. 市场面板打开
5. 玩家在 `MiniTradePanel` 中确认买/卖
6. `App.tsx` 调用 `gameGateway.executeTrade(session, payload)`
7. 当前 mock 中执行：
   - 库存与资金校验
   - 更新货舱
   - 更新价格与价格历史
   - 生成涟漪影响
   - 推进世界时间
8. 返回新的 `session`
9. `App.tsx` 回写 Redux
10. HUD、地图、交易面板同时刷新

---

## 6.5 仓储数据流

### 存入

1. `WarehousePanel` 触发存入
2. `App.tsx` 调用 `gameGateway.depositWarehouse(session, payload)`
3. 当前 mock 中：
   - 校验当前站点
   - 扣减货舱
   - 增加仓库
4. 返回新会话
5. Redux 更新

### 取出

1. `WarehousePanel` 触发取出
2. `App.tsx` 调用 `gameGateway.withdrawWarehouse(session, payload)`
3. 当前 mock 中：
   - 校验当前站点
   - 校验仓库存量
   - 计算税费
   - 扣除资金
   - 合并货舱
4. 返回新会话与 `taxPaid`
5. Redux 更新

---

## 6.6 结算与排行榜数据流

1. 游戏状态变为 `WON / LOST / TIMEUP`
2. `App.tsx` 打开 `SettlementScreen`
3. 当前结算分数由前端本地按照规则生成
4. 结算页出现后，`App.tsx` 调用：
   - `authGateway.recordScore(account.id, settlementData.breakdown.total)`
5. 当前 mock 中：
   - 比较历史最高分
   - 若更高则覆盖
6. 玩家回到大厅后点击排行榜
7. `App.tsx` 调用：
   - `authGateway.getLeaderboard()`
8. 当前 mock 中：
   - 本地账号列表按最高分排序
   - 截取前十
9. `LeaderboardModal` 展示结果

---

## 7. 后端接入时的推荐落地顺序

为了让前端能最快切换到真实后端，建议后端按下面顺序提供接口：

### 第一优先级

1. 认证接口
   - `/api/auth/register`
   - `/api/auth/login`
   - `/api/auth/me`
   - `/api/auth/logout`

2. 会话接口
   - `/api/session/start`
   - `/api/session/current`
   - `/api/session/current` `PUT`

3. 排行榜接口
   - `/api/leaderboard`
   - `/api/leaderboard/record`

### 第二优先级

4. 交易接口
   - `/api/game/trade`
   - `/api/stations/{id}/market`

5. 仓储接口
   - `/api/game/warehouse/deposit`
   - `/api/game/warehouse/withdraw`

### 第三优先级

6. 移动与遭遇接口
   - `/api/game/move`
   - `/api/game/encounter/choice`
   - `/api/game/encounter/confirm`
   - `/api/game/world/advance`

7. 结算接口
   - `/api/game/settlement/evaluate`
   - `/api/game/settlement/score`

---

## 8. 当前仍在前端本地执行的规则计算

截至本轮，以下规则仍然是前端本地 mock：

- 新局随机星图生成
- 移动后的遭遇判定
- 遭遇事件效果结算
- 交易后价格波动与涟漪传播
- 仓储税费计算
- 世界年份推进
- 嫌疑值衰减
- 通缉等级衰减
- 垄断进度计算
- 区域垄断判定
- 胜负判定
- 结算总分计算

这些逻辑现在都已经具备“可迁移到后端”的门面边界，但算法本体还在前端。

---

## 9. 本轮修改对应的关键文件

### 新增 gateway 文件

- `frontend/src/gateways/types.ts`
- `frontend/src/gateways/index.ts`
- `frontend/src/gateways/mockAuthGateway.ts`
- `frontend/src/gateways/mockGameGateway.ts`

### 修改的核心业务文件

- `frontend/src/App.tsx`
- `frontend/src/canvas/StarMap.tsx`
- `frontend/src/store/sessionSlice.ts`
- `frontend/src/game/types.ts`
- `frontend/src/game/encounterPool.ts`
- `frontend/src/api/sessionEncounterApi.ts`
- `frontend/src/api/sessionApi.ts`

---

## 10. 结论

本轮之后，前端在结构上已经从“页面直接操作本地规则”前进到了“页面通过 gateway 门面驱动游戏逻辑”的阶段。

这带来两个直接收益：

1. 遭遇事件与移动年份结算链路更清晰，问题更容易定位和修复。
2. 后端准备完成后，前端不需要再大规模改页面流程，只需要逐步把 `mockAuthGateway` 和 `mockGameGateway` 替换成真实的后端实现即可。

因此，下一阶段前后端联调时，重点工作不再是重构页面，而是按本文档中的接口与数据流，把 gateway 的 `mock` 分支逐步切换到真实 HTTP 请求。
