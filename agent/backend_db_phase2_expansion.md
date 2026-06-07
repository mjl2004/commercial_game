# 复杂规则继续数据库下放进展记录

## 结论

当前这一步已经把“核心玩法链继续下放数据库”的框架继续向前推进了一大截：

- 移动/事件链已经正式切到数据库原生并通过既有测试收口
- 交易/仓储链已经完成网关白名单扩展与 openGauss-lite 兼容性改造
- 交易/仓储链的真实数据库回归目前被本地 `127.0.0.1:5432` 连接拒绝阻塞，属于环境问题，不是已定位到的代码逻辑问题

换句话说，这一轮不是停在“计划”阶段，而是已经进入“代码已落地，等待数据库恢复后做最终 DB 真回归”的状态。

## 已完成内容

### 1. 移动事件链已下放数据库

已完成数据库原生化并接入 `DBGameplayGateway` 白名单：

- `advance_world`
- `start_move`
- `resolve_encounter`
- `finalize_encounter`

对应实现位于：

- [backend/app/db/game_logic.sql](/abs/path/c:/Users/Anson/Desktop/commercial_game/backend/app/db/game_logic.sql)
- [backend/app/services/db_gameplay_gateway.py](/abs/path/c:/Users/Anson/Desktop/commercial_game/backend/app/services/db_gameplay_gateway.py)

对应自动化测试已通过：

- [backend/tests/test_db_backend_parity_phase1.py](/abs/path/c:/Users/Anson/Desktop/commercial_game/backend/tests/test_db_backend_parity_phase1.py)
- [backend/tests/test_db_gameplay_gateway_phase1.py](/abs/path/c:/Users/Anson/Desktop/commercial_game/backend/tests/test_db_gameplay_gateway_phase1.py)
- [backend/tests/test_phase2_contracts.py](/abs/path/c:/Users/Anson/Desktop/commercial_game/backend/tests/test_phase2_contracts.py)

最近一次已知通过结果：

```text
Ran 17 tests in 2.898s

OK
```

### 2. 交易/仓储链已继续接入数据库白名单

`DBGameplayGateway.DATABASE_NATIVE_ACTIONS` 已扩展为包含：

- `execute_trade`
- `deposit_warehouse`
- `withdraw_warehouse`

这意味着在 `execution_mode="auto"` 下，这三条动作将按数据库原生路径执行。

### 3. openGauss-lite 兼容层已进一步补齐

为避免再次触发 openGauss-lite 对 PostgreSQL 常见 `jsonb` 语法的不兼容，本轮已继续清理以下风险点：

- 用 `append_jsonb_array(...)` 替代交易/仓储相关函数中大批 `jsonb || jsonb`
- 保持 JSON 结果拼装尽量走朴素、稳定的文本/数组方式
- 避免依赖 openGauss-lite 缺失或不稳定的 `jsonb_set`、`jsonb_build_object`、`jsonb` 拼接操作符

涉及主要函数：

- `update_station_inventory`
- `update_stations_inventory`
- `update_station_inventory_only_stock`
- `update_stations_inventory_only_stock`
- `update_cargo`
- `deposit_warehouse`
- `withdraw_warehouse`

## 本轮新增但尚未完成最终验证的内容

### 1. 交易/仓储链数据库真实回归被环境阻塞

当前阻塞现象：

- 本地数据库连接 `127.0.0.1:5432` 被拒绝
- `asyncpg.create_pool(...)` / `DBGameplayGateway.execute(..., execution_mode="database_native")` 无法建立连接

典型错误：

```text
ConnectionRefusedError: [WinError 1225] 远程计算机拒绝网络连接。
```

这意味着当前无法完成下面三项真实 DB 回归：

- `execute_trade` 数据库原生路径
- `deposit_warehouse` 数据库原生路径
- `withdraw_warehouse` 数据库原生路径

### 2. 测试已先行对齐灰度策略

由于 `execute_trade` 已被纳入数据库白名单，原先“默认走 reference fallback”的测试语义已不再准确，本轮已修正测试口径：

- 保留显式 `reference_python` 模式验证
- 新增交易/仓储动作在 `auto` 模式下应走 `database_native` 的网关断言

对应文件：

- [backend/tests/test_db_gameplay_gateway_phase1.py](/abs/path/c:/Users/Anson/Desktop/commercial_game/backend/tests/test_db_gameplay_gateway_phase1.py)

## 当前边界判断

需要明确区分两类“数据库下放”：

### 1. 已经属于玩法动作网关下放的内容

这类内容适合继续沿 `DBGameplayGateway + game_logic.sql + parity test` 路线推进：

- `execute_trade`
- `deposit_warehouse`
- `withdraw_warehouse`

### 2. 已经大量使用数据库，但尚未 SQL 化规则计算的内容

这类内容不适合简单类比“动作白名单切换”，因为它们本来就已经在数据库中做了持久化：

- 认证 `AuthService`
- 排行榜 `get_leaderboard / record_score`
- 结算归档 `SettlementService.complete / get_record / list_records_by_account`

它们的下一步更准确的目标应该是：

- 是否把结算 `evaluate(...)` 的核心计算迁到 SQL function
- 是否把排行榜更新与结算归档合并为更强事务性数据库入口
- 是否把账户读写进一步封装为 DB-side helper/function

## 下一步建议

数据库恢复后，建议按以下顺序继续：

1. 先恢复 openGauss 可连接状态并重新执行 `SessionStore.ensure_table()`
2. 直接验证三条数据库原生动作：
   - `execute_trade`
   - `deposit_warehouse`
   - `withdraw_warehouse`
3. 跑回归测试：
   - `backend.tests.test_db_backend_parity_phase1`
   - `backend.tests.test_db_gameplay_gateway_phase1`
   - `backend.tests.test_phase2_contracts`
   - `backend.tests.test_session_api_phase1`
4. 若交易/仓储 parity 全绿，再进入“认证/排行榜/结算规则 SQL 化”阶段

## 下一阶段正式范围建议

建议把“其他功能也尽量下放数据库”拆成两个子阶段：

### 子阶段 A：玩法动作链收口

目标：

- 完成 `execute_trade / deposit_warehouse / withdraw_warehouse` 的真实 DB 回归
- 让主要 session 玩法动作全部进入数据库原生白名单

### 子阶段 B：结算/排行榜规则下放

目标：

- 为结算增加数据库原生评估函数
- 将结算归档与排行榜更新收拢为更统一的数据库事务入口
- 在不改变前端协议的前提下，减少 Python 侧重复计算逻辑

