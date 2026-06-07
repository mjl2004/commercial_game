# Commercial Game

## 项目概况

Commercial Game 是一个以太空贸易为主题的单局经营游戏项目，采用前后端分离架构：

- 前端：React + TypeScript + Vite
- 后端：FastAPI + asyncpg
- 数据库：openGauss / PostgreSQL 兼容环境

当前项目已完成约定范围内的正式交付。主玩法链路、事件链、仓储链、结算、认证账户读模型和排行榜能力已经后端化，数据库承担了持久化和大部分核心规则执行职责。

项目当前定位是：

- 可运行
- 可游玩
- 可验收
- 可继续维护和扩展

但这并不等同于“已经生产化到任意规模场景”。当前结果更适合作为课程项目、内部演示项目、阶段性交付版本和后续扩展基线。

## 当前能力范围

项目当前支持的主要能力包括：

- 登录、注册与账户信息读取
- 从后端创建和恢复游戏会话
- 星图移动、事件触发、事件结算和世界推进
- 站点交易、仓库存入、仓库取出
- 单局结算评估与结算归档
- 账户最佳成绩更新
- 排行榜读取
- `mock` / `backend` 两种前端运行模式

数据库原生执行当前已覆盖的主要动作包括：

- `start_session`
- `execute_trade`
- `deposit_warehouse`
- `withdraw_warehouse`
- `advance_world`
- `start_move`
- `resolve_encounter`
- `finalize_encounter`
- `evaluate_settlement`
- `complete_settlement`
- `get_account`
- `get_leaderboard`

Python 参考实现仍然保留，用于：

- 回退
- parity 对照
- 后续复杂规则继续迁移时的基线验证

## 项目结构

```text
commercial_game/
|-- agent/                   # 过程文档、验收记录、收口材料
|-- backend/                 # FastAPI 后端、数据库逻辑、测试与初始化脚本
|-- frontend/                # React + TypeScript 前端
|-- package-lock.json
`-- README.md
```

## 启动所需环境

本项目建议使用以下环境：

- Python 3.10 或更高版本
- Node.js 18 或更高版本
- npm 9 或更高版本
- openGauss 5.x，或 PostgreSQL 兼容数据库

本地开发默认使用：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8000`
- 数据库：`127.0.0.1:5432`

## 配置说明

### 1. 后端配置

在 `backend/.env` 中配置数据库连接：

```env
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/<database>
DEBUG=True
```

你当前仓库中的本地示例配置是连接本机数据库，因此默认是单机开发模式。

### 2. 前端配置

在 `frontend/.env.local` 中配置前端运行模式和 API 地址：

```env
VITE_DATA_MODE=backend
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_ENABLE_BACKEND_PARITY_CHECK=true
```

说明：

- `VITE_DATA_MODE=backend` 表示以前后端联调模式运行
- `VITE_DATA_MODE=mock` 表示只使用前端本地 mock 逻辑
- `VITE_API_BASE_URL` 指向后端 API 根地址

## 快速启动

### 1. 初始化并启动后端

```bash
cd backend
pip install -r requirements.txt
python scripts/init_database.py
python start.py
```

后端可访问地址：

- API 根地址：`http://127.0.0.1:8000`
- Swagger 文档：`http://127.0.0.1:8000/docs`
- 健康检查：`http://127.0.0.1:8000/health`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认访问地址：

- `http://127.0.0.1:5173`

## 如何快速游玩

推荐使用当前默认的 `backend` 模式游玩：

1. 确保数据库、后端、前端都已启动。
2. 打开 `http://127.0.0.1:5173`。
3. 注册或登录一个账户。
4. 进入大厅后开始新局。
5. 在星图上点击相邻站点进行移动。
6. 到站后可执行：
   - 交易
   - 仓库存入
   - 仓库取出
7. 若移动触发遭遇事件，按界面提示完成事件选择和收尾。
8. 当达到结算条件后进入结算页，完成归档并查看排行榜。

一个最短体验路径通常是：

1. 开新局
2. 移动到相邻站点
3. 做一次买卖
4. 存一次仓或取一次仓
5. 再移动一次并处理事件
6. 继续推进直到进入结算

## 数据保存与恢复

### 当前保存方式

在 `backend` 模式下，数据有两层保存：

- 后端会话数据保存在数据库
- 前端浏览器 `localStorage` 保存本地恢复信息和当前 `sessionId`

因此在同一台机器、同一浏览器中：

- 刷新页面后通常可以恢复当前进度
- 退出浏览器后重新进入，通常也可以恢复当前进度

前提是：

- 数据库中的会话未被删除
- 浏览器本地未清理对应缓存

### 当前恢复限制

当前跨浏览器、跨机器“自动续玩同一局”还不是完整产品能力。原因是前端恢复时仍依赖本地保存的后端 `sessionId`。

这意味着：

- 数据库里旧会话可能还在
- 但如果换了一台机器或换了浏览器，前端未必知道该恢复哪一个会话

当前项目已经支持：

- 会话持久化
- 会话刷新恢复
- 结算归档
- 账户成绩留存

但还没有完整做到：

- 按账号自动列出全部可恢复中的进行中会话
- 在任意机器无缝接续同一局游戏

## openGauss 与跨机器运行

### 当前数据库状态

当前仓库配置中的数据库地址默认是：

```env
127.0.0.1:5432
```

这表示项目当前默认连接“运行后端那台机器自己的本地数据库”，属于本机开发配置。

### 是否支持跨机器运行

支持，但要分开理解：

- 其他机器运行这套项目代码：支持
- 多台机器共享同一数据库：支持
- 其他机器自动续上之前那一局：当前不完全支持

如果希望跨机器共用同一套数据，需要：

1. 将 openGauss 部署到固定主机或服务器
2. 将 `DATABASE_URL` 中的 `127.0.0.1` 改为该数据库主机地址
3. 开放数据库监听、认证和端口访问
4. 让所有后端实例连接同一数据库

这样后，账户、排行榜、结算记录、会话数据都可以共用。

但如果要实现真正的“换机器继续同一局”，还需要后续再补：

- 按账号查询进行中 session
- 会话选择和恢复入口

## 后端接口概览

主要 API 范围包括：

- `/api/auth/*`
- `/api/leaderboard`
- `/api/session/start`
- `/api/session/{session_id}`
- `/api/session/{session_id}/trade`
- `/api/session/{session_id}/warehouse/deposit`
- `/api/session/{session_id}/warehouse/withdraw`
- `/api/session/{session_id}/move/start`
- `/api/session/{session_id}/encounter/resolve`
- `/api/session/{session_id}/encounter/finalize`
- `/api/session/{session_id}/world/advance`
- `/api/session/{session_id}/settlement`
- `/api/session/{session_id}/complete`
- `/api/session/{session_id}/archive`

后端详细说明见 [backend/README.md](backend/README.md)。

## 测试与验证

当前项目已补充数据库优先路径、后端契约和结算能力相关测试。

代表性回归命令：

```bash
python -m unittest backend.tests.test_db_backend_parity_phase1 backend.tests.test_phase2_contracts backend.tests.test_db_gameplay_gateway_phase1 backend.tests.test_session_api_phase1 backend.tests.test_auth_db_phase2 backend.tests.test_settlement_db_phase2 backend.tests.test_settlement_api_phase2 backend.tests.test_auth_api_phase2
```

项目过程中的手动验收重点覆盖了：

- 交易
- 仓库存取
- 移动触发事件
- 事件 resolve / finalize
- 刷新恢复
- 结算归档
- 排行榜读取

## 项目交付结论

在当前约定范围内，本项目可以正式视为“完成并收口”：

- 主玩法闭环已完成
- 后端权威化已完成
- 数据库存储与大部分核心规则下放已完成
- 验收材料与收口文档已补齐

如果继续迭代，后续优先方向建议是：

- 会话跨设备恢复
- 更细粒度的数据模型拆分
- 更完整的数据库部署文档
- 更系统化的自动化回归和运维脚本

## 参考文档

- [backend/README.md](backend/README.md)
- [backend/API_PROGRESS.md](backend/API_PROGRESS.md)
- [agent/project_closeout.md](agent/project_closeout.md)
- [agent/manual_acceptance_phase2_record.md](agent/manual_acceptance_phase2_record.md)
