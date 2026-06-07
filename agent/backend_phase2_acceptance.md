# 第二阶段验收说明

## 结论

当前第二阶段已经完成到“游戏主流程联调收口”的状态。

这里的“完成”指的是：

- 前端 `mock` 模式保持不变
- 前端 `backend` 模式已经接通真实 `/api/session/*` 主链
- 页面主流程开始以服务端返回的 `session` 为准渲染
- 后端内部已经具备统一执行器入口，未来可继续把复杂 JSON 连锁计算逐步下放数据库
- 开发态可以开启前后结果只读对拍，不影响真实联调流程

这里不包含：

- 认证与排行榜正式后端化
- `evaluateSettlement` 迁移到服务端
- 所有复杂业务规则已经纯数据库化

## 当前第二阶段已落地内容

### 1. 前端 backend gateway 已接通

已新增：

- `frontend/src/gateways/backendGameGateway.ts`
- `frontend/src/gateways/backendAuthGateway.ts`

当前状态：

- `VITE_DATA_MODE=mock` 时继续走 mock gateway
- `VITE_DATA_MODE=backend` 时游戏主流程走真实 backend gateway
- 页面层仍只依赖 `authGateway` / `gameGateway` 契约，不需要重写页面结构

说明：

- `backendAuthGateway` 当前仍复用 mock auth
- 这是刻意保留的阶段边界，不视为第二阶段失败

### 2. 游戏主链已切到后端 session 接口

当前已接通：

- `POST /api/session/start`
- `GET /api/session/{session_id}`
- `POST /api/session/{session_id}/persist`
- `POST /api/session/{session_id}/trade`
- `POST /api/session/{session_id}/warehouse/deposit`
- `POST /api/session/{session_id}/warehouse/withdraw`
- `POST /api/session/{session_id}/move/start`
- `POST /api/session/{session_id}/encounter/resolve`
- `POST /api/session/{session_id}/encounter/finalize`
- `POST /api/session/{session_id}/world/advance`

当前前端在 `backend` 模式下，以下流程都已走服务端：

- 开新局
- 恢复会话
- 持久化当前会话
- 交易
- 存仓
- 取仓
- 移动
- 事件确认
- 世界推进

### 3. 后端执行器与未来数据库下放入口已标准化

当前后端已经收敛为：

- `GameplayService` 负责读取会话、保存会话、控制事务边界
- `DBGameplayGateway.execute(...)` 负责统一动作执行入口
- `execution_mode` 已支持：
  - `auto`
  - `reference_python`
  - `database_native`

当前实际策略：

- `start_session` 继续通过数据库主链进入
- 复杂动作仍允许走 Python 权威兜底
- 对前端完全透明

这意味着未来继续把复杂 JSON 连锁计算下放数据库时，主要是替换后端内部执行器归属，而不是重做前后端协议。

### 4. 随机上下文已经为联调和未来下放预留

移动事件链路已补齐随机上下文回传：

- 后端会记录真实使用到的 `encounterRoll`
- 后端会记录真实使用到的 `encounterIndex`
- 这些值通过 `actionContext.randomControl` 回传

作用：

- 联调时的对拍不再强行修改真实行为
- 前端开发态校验可以读取后端真实随机输入做只读比对
- 未来数据库函数接管移动/事件逻辑时，也有稳定的显式随机入参标准

### 5. 开发态双算校验已接入，但不会干扰真实流程

当前支持：

- `VITE_ENABLE_BACKEND_PARITY_CHECK=true`

打开后：

- 页面仍以服务端返回结果渲染
- 前端会额外用本地 mock 规则做只读比对
- 若发现差异，只在控制台打印字段路径和前后值
- 不会阻断用户操作
- 不会回写 mock 结果

## 当前第二阶段验证结果

已通过：

```powershell
python -m unittest backend.tests.test_db_gameplay_gateway_phase1 backend.tests.test_db_backend_parity_phase1 backend.tests.test_session_api_phase1
```

结果：

```text
Ran 18 tests

OK
```

已通过：

```powershell
node frontend/node_modules/typescript/bin/tsc -p frontend/tsconfig.json --noEmit
```

结果：

- 通过，无类型错误

## 第二阶段验收标准与当前判断

### 已满足

- `mock` 和 `backend` 两种模式可共存
- `backend` 模式下主流程至少覆盖开局、交易、仓储
- 移动、事件确认、世界推进也已接入服务端主链
- 页面已开始以服务端返回 `session` 为准
- 对拍能力存在，且不会影响正常联调

### 尚未纳入本阶段完成标准

- `backendAuthGateway` 的真实后端认证实现
- 排行榜后端化
- 结算统一后端化
- 复杂规则纯数据库化

## 手动验收建议

建议在 `VITE_DATA_MODE=backend` 下手动跑以下链路：

1. 开新局，确认会话可正常生成
2. 买入一次货物，确认资金、货舱、年份、交易次数变化正确
3. 存仓一次，再取仓一次，确认仓库与税费变化正确
4. 做一次无事件移动，确认年份推进和站点切换正确
5. 做一次有事件移动，确认事件选择、确认结果和世界推进顺序正确
6. 刷新页面，确认会话可从后端恢复

如果以上链路都正常，可以视为第二阶段已经完成“游戏主流程联调收口”。
