# 第二阶段手动验收记录

## 验收背景

本次验收目标是确认：

- 前端 `backend` 模式已经真实接通后端 `/api/session/*` 主链
- 页面渲染以服务端返回的 `session` 为准
- 核心游戏主流程在浏览器中可实际跑通

验收环境：

- 数据库：本地已启动 OpenGauss
- 后端：已启动，并可访问 Swagger
- 前端：已启动，`frontend/.env.local` 已配置
- 前端模式：`VITE_DATA_MODE=backend`
- 接口地址：`VITE_API_BASE_URL=http://127.0.0.1:8000`

## 验收结论

本次第二阶段手动验收结果为：

`通过`

## 验收项目与结果

### 1. 开局接后端

- 浏览器 `Network` 中可见 `POST /api/session/start`
- 状态码为 `200`
- 返回包含 `ok`、`sessionId`、`session`
- `localStorage.getItem('backend-session-id')` 返回：
  - `session-1385469783`

结论：

- 通过

### 2. 买入交易

操作：

- 在站点 `9` 买入 `goodsId=1`，数量 `3`

关键结果：

- `ok: true`
- `player.cargo` 新增矿石数量 `3`
- `player.credits = 9298`
- `meta.currentYear = 2101`
- `stats.tradeCount = 1`
- 返回 `rippleAffectedStationIds`

结论：

- 通过

### 3. 卖出交易

操作：

- 在站点 `9` 卖出 `goodsId=1`，数量 `1`

关键结果：

- `ok: true`
- `player.cargo.quantity: 3 -> 2`
- `player.credits = 9536`
- `meta.currentYear = 2102`
- `stats.tradeCount = 2`
- 返回 `rippleAffectedStationIds`
- 返回 `actionContext.action = execute_trade`

结论：

- 通过

### 4. 存仓

操作：

- 在站点 `9` 存入 `goodsId=1`，数量 `1`

关键结果：

- `ok: true`
- `player.cargo.quantity: 2 -> 1`
- `warehouses["9"]` 新增：
  - `goodsId = 1`
  - `quantity = 1`
  - `storedTurns = 0`
- `player.credits` 不变
- `meta.currentYear` 不变
- 返回 `actionContext.action = deposit_warehouse`

结论：

- 通过

### 5. 取仓

操作：

- 在站点 `9` 取出 `goodsId=1`，数量 `1`

关键结果：

- `ok: true`
- `player.cargo.quantity: 1 -> 2`
- `warehouses["9"]` 清空
- `taxPaid = 12`
- `player.credits: 9536 -> 9524`
- 实际扣减金额与 `taxPaid` 一致
- 返回 `actionContext.action = withdraw_warehouse`

结论：

- 通过

### 6. 移动并触发事件

操作：

- 从站点 `9` 移动到站点 `7`
- `yearsCost = 1`
- 触发事件 `enc-patrol-check`

#### 6.1 start_move

关键结果：

- `ok: true`
- `player.currentStationId = 7`
- `player.status = TRAVELING`
- `ui.moveState = traveling`
- `ui.pendingAction.type = move`
- `ui.pendingAction.baseYearsSettled = false`
- `meta.currentYear` 仍为 `2102`

结论：

- 通过

#### 6.2 resolve_encounter

操作：

- 选择事件选项 `choiceId = 1`

关键结果：

- `ui.encounter.open = true`
- `selectedChoiceId = 1`
- `result.success = true`
- 结果为扣除 `300 CR`
- `player.credits: 9524 -> 9224`
- `stats.eventCount: 0 -> 1`
- `meta.currentYear` 仍为 `2102`

结论：

- 通过

#### 6.3 finalize_encounter

关键结果：

- `meta.currentYear: 2102 -> 2103`
- `player.credits = 9224`
- `stats.eventCount = 1`
- 返回 `actionContext.action = finalize_encounter`

说明：

- 事件结算先执行
- 移动年份推进在 finalize 后执行
- 未发现重复推进或重复扣减

结论：

- 通过

### 7. 刷新恢复

操作：

- 在完成交易、仓储、移动、事件后刷新页面

检查结果：

- 页面刷新后状态基本无变化
- `Network` 中出现两个 `session-1385469783` 请求
- 两次返回的关键字段一致：
  - `sessionId = session-1385469783`
  - `currentYear = 2103`
  - `credits = 9224`
  - `eventCount = 1`
  - `currentStationId = 7`

说明：

- 虽然出现两次相同会话读取，但未造成状态回退或界面错乱
- 可以视为开发态可接受现象

结论：

- 通过

## 总体判断

本次手动验收已覆盖并确认通过以下主流程：

- 开局
- 后端会话建立
- 买入
- 卖出
- 存仓
- 取仓
- 移动
- 事件选择结算
- 事件确认后世界推进
- 刷新恢复

因此可以认定：

- 第二阶段“游戏主流程联调收口”已经通过手动验收

## 已知边界

本次验收未覆盖，且不作为当前失败项：

- `backendAuthGateway` 真实后端认证
- 排行榜后端化
- 结算统一后端化
- 复杂规则纯数据库化
