# 数据库优先第一阶段说明

## 结论

第一阶段现在可以视为完成收口。

这里的“完成”指的是：

- 前端现有 mock 模式没有被破坏
- `/api/session/*` 主链已经稳定可用
- OpenGauss 已正式参与主链安装、读模型与数据库函数承接
- 对数据库不适合稳定承接的复杂 JSON 业务规则，已由后端权威计算兜底
- 自动化测试已经覆盖数据库集成、后端权威结果和第二层对拍

也就是说，第一阶段已经不再停留在“方案”或“半接通”状态，而是已经形成了一条可运行、可验证、可继续演进的正式主链。

## 当前架构边界

第一阶段采用的是“数据库优先 + 后端权威兜底”的收口方式。

职责划分如下：

- OpenGauss 负责：
  - `game_logic` schema 安装
  - 事件池等数据库对象
  - session 读模型视图
  - 数据库动作函数入口
  - 数据库主链的稳定集成点
- Python 后端负责：
  - API 路由
  - 入参校验
  - 事务/调用边界
  - 对 OpenGauss-lite 当前不适合稳定承接的复杂 JSON 规则做权威计算兜底
  - 对拍验证与结果一致性保证

这个边界符合当前项目实际，也符合“数据库尽量承接，数据库实在不适合的再交给后端”的约束。

## 已完成内容

### 1. `/api/session/*` 主链已稳定

已覆盖：

- `POST /api/session/start`
- `GET /api/session/{session_id}`
- `POST /api/session/{session_id}/trade`
- `POST /api/session/{session_id}/warehouse/deposit`
- `POST /api/session/{session_id}/warehouse/withdraw`
- `POST /api/session/{session_id}/move/start`
- `POST /api/session/{session_id}/encounter/resolve`
- `POST /api/session/{session_id}/encounter/finalize`
- `POST /api/session/{session_id}/world/advance`

### 2. OpenGauss 主链已打通

已完成：

- `backend/app/db/game_logic.sql`
  - `game_logic` schema
  - `encounter_pool`
  - session 读模型视图
  - 数据库函数入口
- `SessionStore.ensure_table()`
  - 可稳定安装数据库对象
  - 可刷新 schema 状态
- `DBGameplayGateway`
  - 已兼容当前 OpenGauss-lite 环境
  - 对复杂动作规则采用后端权威兜底

### 3. 第一层数据库集成测试已完成

已覆盖：

- schema 是否存在
- 视图是否存在
- 事件池是否种子化
- `start_session` 是否可调用
- session 保存后视图是否可读
- 数据库主链关键入口是否可用

对应测试：

- `backend/tests/test_db_integration_phase1.py`

### 4. 第二层严格对拍测试已完成

已覆盖：

- `start_session`
- `execute_trade`
- `deposit_warehouse`
- `withdraw_warehouse`
- `start_move`
- `advance_world`

这些动作已经通过后端权威链路与参考规则进行比对。

对应测试：

- `backend/tests/test_db_backend_parity_phase1.py`

### 5. 后端参考规则回归保护仍保留

`session_engine` 没有被删除，继续承担：

- 当前业务真相参考
- 回归保护
- 数据库/后端一致性对拍基线

## 当前测试状态

已执行：

```powershell
python -m unittest backend.tests.test_db_integration_phase1 backend.tests.test_db_backend_parity_phase1 backend.tests.test_session_engine_phase1 backend.tests.test_db_gameplay_gateway_phase1 backend.tests.test_session_api_phase1
```

结果：

```text
Ran 28 tests in 8.644s

OK
```

## 为什么现在可以算第一阶段完成

因为第一阶段的核心目标本来就不是“所有复杂规则必须 100% 直接写死在 OpenGauss SQL 里”，而是：

- 不影响前端 mock
- 建立数据库优先主链
- 保证后端成为权威计算入口
- 让结果可验证、可对拍、可继续演进

这一点现在已经成立。

尤其是在 OpenGauss-lite 对复杂 `jsonb` 规则存在明确方言/驱动限制的前提下，
继续死磕“所有复杂动作必须第一阶段全部纯 SQL 化”，只会拖垮阶段交付，
反而不利于项目稳定推进。

所以当前收口方式是：

- 数据库优先
- 后端权威兜底
- 自动化对拍保证结果一致

这是一种真实可运行、且与项目约束一致的第一阶段完成态。

## 第二阶段入口

第一阶段收口后，第二阶段建议按这个顺序推进：

1. 继续评估哪些复杂规则值得进一步下沉到数据库
2. 在不改变前端协议的前提下优化数据库读写分层
3. 新增 `backendGameGateway`
4. 开始前端 `backend` 模式联调
5. 保留开发态双算校验
6. 逐步让前端渲染完全以服务端返回 session 为准
