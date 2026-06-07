# Backend README

## 后端概况

`backend/` 目录承载了 Commercial Game 的后端权威实现，技术栈为：

- FastAPI
- asyncpg
- openGauss / PostgreSQL 兼容数据库

当前后端已经完成从“早期接口壳层”到“主玩法、结算、账户读模型和排行榜后端权威化”的迁移，数据库不再只是存储层，也承担了大部分核心业务规则执行。

## 本阶段后端改动汇总

### 1. 会话后端化

已完成：

- 新增 `game_sessions` JSON 会话存储
- 支持从后端创建 session
- 支持从后端读取 session
- 支持删除 session
- 支持前端主动持久化当前 session

相关接口：

- `POST /api/session/start`
- `GET /api/session/{session_id}`
- `DELETE /api/session/{session_id}`
- `POST /api/session/{session_id}/persist`

说明：

- 当前仍以完整 session JSON 作为主要持久化结构
- 这是为了尽快完成从前端 mock 会话到后端会话的平滑迁移

### 2. 交易与仓储后端化

已完成：

- 交易规则后端执行
- 仓库存入后端执行
- 仓库取出后端执行
- 数据库存储与前端契约对齐

相关接口：

- `POST /api/session/{session_id}/trade`
- `POST /api/session/{session_id}/warehouse/deposit`
- `POST /api/session/{session_id}/warehouse/withdraw`

数据库原生执行已覆盖：

- `execute_trade`
- `deposit_warehouse`
- `withdraw_warehouse`

### 3. 移动 / 遭遇 / 世界推进后端化

已完成：

- 移动起点与目标校验
- 移动后的 pendingAction 状态写回
- 遭遇事件触发
- 事件 resolve
- 事件 finalize
- 世界年份推进
- 失败状态与事件统计更新

相关接口：

- `POST /api/session/{session_id}/move/start`
- `POST /api/session/{session_id}/encounter/resolve`
- `POST /api/session/{session_id}/encounter/finalize`
- `POST /api/session/{session_id}/world/advance`

数据库原生执行已覆盖：

- `advance_world`
- `start_move`
- `resolve_encounter`
- `finalize_encounter`

说明：

- 当前返回结构保留了前端既有契约形状
- `actionContext`
- `randomControl`
- `encounter`
- `result`

这些字段仍与前端联调协议兼容

### 4. 结算后端化

已完成：

- 结算评估
- 结算完成
- 结算归档查询
- 账户最佳成绩更新

相关接口：

- `GET /api/session/{session_id}/settlement`
- `POST /api/session/{session_id}/complete`
- `GET /api/session/{session_id}/archive`

数据库原生执行已覆盖：

- `evaluate_settlement`
- `complete_settlement`

### 5. 认证与排行榜后端化

已完成：

- 注册
- 登录
- 账户信息读取
- 账户结算历史读取
- 排行榜读取
- 分数记录

相关接口：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/accounts/{account_id}`
- `GET /api/auth/accounts/{account_id}/settlements`
- `GET /api/leaderboard`
- `POST /api/leaderboard/{account_id}/score`

数据库原生执行已覆盖：

- `get_account`
- `get_leaderboard`

### 6. 执行模式与灰度策略

后端保留了多执行模式设计：

- `database_native`
- `reference_python`
- `auto`

其意义是：

- `database_native`：优先使用数据库原生规则
- `reference_python`：保留 Python 参考实现，作为回退和 parity 基线
- `auto`：对已下放能力优先走数据库，否则回退 Python

这让当前后端既完成了数据库优先迁移，也保留了验证和回滚能力。

## 目录结构

```text
backend/
|-- app/
|   |-- api/                # HTTP / WebSocket 路由
|   |-- db/                 # 连接、初始化 SQL、数据库逻辑 SQL
|   |-- schemas/            # Pydantic 请求响应模型
|   |-- services/           # 会话、玩法、认证、结算等服务层
|   `-- main.py             # FastAPI 应用入口
|-- scripts/
|   `-- init_database.py    # 初始化数据库脚本
|-- tests/                  # 回归与 parity 测试
|-- API_PROGRESS.md         # 阶段性 API 推进记录
|-- requirements.txt
`-- start.py
```

## 启动所需环境

- Python 3.10+
- openGauss 5.x 或 PostgreSQL 兼容数据库

已声明的 Python 依赖见 [requirements.txt](/abs/path/c:/Users/Anson/Desktop/commercial_game/backend/requirements.txt)：

- `fastapi`
- `uvicorn`
- `asyncpg`
- `sqlalchemy`
- `apscheduler`
- `websockets`
- `pydantic-settings`
- `python-dotenv`

## 后端配置

在 `backend/.env` 中至少需要配置：

```env
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/<database>
DEBUG=True
```

当前项目默认读取：

- `DATABASE_URL`
- `DEBUG`

其中 `DATABASE_URL` 使用 PostgreSQL 风格 DSN，openGauss 兼容。

## 后端启动方式

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python scripts/init_database.py
```

该脚本会：

- 创建基础表
- 执行 `app/db/init_db.sql`
- 执行 `app/db/game_logic.sql` 中的数据库逻辑对象

### 3. 启动服务

```bash
python start.py
```

默认监听：

- `http://0.0.0.0:8000`

常用访问地址：

- API：`http://127.0.0.1:8000`
- Swagger：`http://127.0.0.1:8000/docs`
- Health：`http://127.0.0.1:8000/health`

## 数据库说明

### 当前数据库角色

数据库当前承担以下职责：

- 会话 JSON 持久化
- 核心玩法规则执行
- 结算评估与归档
- 账户读模型
- 排行榜读模型

### 当前数据库部署状态

当前仓库默认配置连接的是：

- `127.0.0.1:5432`

这说明默认是本机开发库，不是开箱即用的远程共享数据库部署。

### 是否支持跨机器

从后端实现上支持，只要：

1. 数据库部署在统一可访问主机
2. `DATABASE_URL` 改成该主机地址
3. 开放远程连接权限
4. 所有后端实例连接同一数据库

但当前项目还未补齐“按账号自动恢复进行中会话”的完整产品能力，因此跨机器共享数据可以做到，跨机器自动续玩当前局还需要后续能力补完。

## 主要接口清单

### 认证与排行榜

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/accounts/{account_id}`
- `GET /api/auth/accounts/{account_id}/settlements`
- `GET /api/leaderboard`
- `POST /api/leaderboard/{account_id}/score`

### 会话与玩法

- `POST /api/session/start`
- `GET /api/session/{session_id}`
- `DELETE /api/session/{session_id}`
- `POST /api/session/{session_id}/persist`
- `POST /api/session/{session_id}/trade`
- `POST /api/session/{session_id}/warehouse/deposit`
- `POST /api/session/{session_id}/warehouse/withdraw`
- `POST /api/session/{session_id}/move/start`
- `POST /api/session/{session_id}/encounter/resolve`
- `POST /api/session/{session_id}/encounter/finalize`
- `POST /api/session/{session_id}/world/advance`

### 结算

- `GET /api/session/{session_id}/settlement`
- `POST /api/session/{session_id}/complete`
- `GET /api/session/{session_id}/archive`

## 测试建议

代表性后端回归命令：

```bash
python -m unittest backend.tests.test_db_backend_parity_phase1 backend.tests.test_phase2_contracts backend.tests.test_db_gameplay_gateway_phase1 backend.tests.test_session_api_phase1 backend.tests.test_auth_db_phase2 backend.tests.test_settlement_db_phase2 backend.tests.test_settlement_api_phase2 backend.tests.test_auth_api_phase2
```

这些测试主要覆盖：

- DB / Python parity
- gateway 执行模式切换
- 主要 API 契约稳定性
- 认证 / 结算 / 排行榜链路

## 当前边界与后续建议

当前后端已经可以正式交接，但仍有一些边界需要明确：

- 当前会话仍以完整 JSON 为主，不是完全关系化模型
- Python 参考实现仍保留，不应误认为已彻底删除
- 跨设备恢复中的体验还未完整产品化

后续若继续演进，建议优先做：

1. 按账号恢复进行中 session
2. 更细粒度会话拆表
3. 更正式的数据库部署文档和运维脚本
4. 更系统的自动化回归组合

## 参考文档

- [API_PROGRESS.md](API_PROGRESS.md)
- [../agent/project_closeout.md](../agent/project_closeout.md)
- [../agent/backend_phase2_acceptance.md](../agent/backend_phase2_acceptance.md)
- [../agent/manual_acceptance_phase2_record.md](../agent/manual_acceptance_phase2_record.md)
