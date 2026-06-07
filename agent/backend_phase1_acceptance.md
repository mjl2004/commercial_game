# 后端权威计算第一阶段验收说明

## 结论
当前项目已经完成第一阶段的核心收尾，可以认为“后端权威计算第一阶段”达到可验收状态。

本阶段的目标不是让前端正式切到 backend 模式运行，而是：

- 保持前端现有 mock 模式不变
- 在后端补齐主流程权威计算能力
- 让后端结果与前端 mock 规则对齐
- 通过自动化测试验证规则和接口稳定性

## 已完成范围

### 1. 后端权威 session 主链
后端已实现以下主链能力：

- `POST /api/session/start`
- `GET /api/session/{session_id}`
- `POST /api/session/{session_id}/trade`
- `POST /api/session/{session_id}/warehouse/deposit`
- `POST /api/session/{session_id}/warehouse/withdraw`
- `POST /api/session/{session_id}/move/start`
- `POST /api/session/{session_id}/encounter/resolve`
- `POST /api/session/{session_id}/encounter/finalize`
- `POST /api/session/{session_id}/world/advance`

这些接口均围绕 session JSON 作为权威状态演进，不依赖前端页面语义。

### 2. 后端规则层拆分
`backend/app/services/session_engine/` 已拆分为独立规则模块，覆盖：

- 会话生成
- 交易规则
- 仓储规则
- 遭遇事件规则
- 世界推进规则
- 公共工具与共享逻辑

当前结构已具备继续扩展和局部测试的基础。

### 3. 随机可复现控制
第一阶段所需的可复现能力已具备：

- `startSession` 支持可选 `seed`
- 移动流程支持 `encounterRoll`
- 移动流程支持 `encounterIndex`

这使得对拍测试和问题复盘具备稳定输入条件。

### 4. 自动化测试体系
当前已有三层测试：

- 后端规则行为测试
  - 文件：`backend/tests/test_session_engine_phase1.py`
- 前后端跨语言严格对拍测试
  - 文件：`backend/tests/test_frontend_backend_parity.py`
- `/api/session/*` 接口级测试
  - 文件：`backend/tests/test_session_api_phase1.py`

已验证场景包括：

- 新局生成
- 买入交易
- 卖出交易
- 仓库存入
- 仓库取出
- 移动并触发事件
- 事件选项结算
- 事件确认后的世界推进
- 单独世界推进
- session 主链接口可用性

## 当前验收结果
已执行：

```powershell
python -m unittest backend.tests.test_session_engine_phase1 backend.tests.test_frontend_backend_parity backend.tests.test_session_api_phase1
```

结果：

```text
Ran 20 tests in 2.417s

OK
```

## 为第一阶段收尾补做的稳定性修复

### 1. 配置兼容性
`backend/app/config.py` 已补充 `debug` 字段的兼容解析，支持：

- `true/false`
- `debug/release`
- `dev/prod`
- `1/0`

避免环境变量格式导致应用或测试启动失败。

### 2. services 延迟导出
`backend/app/services/__init__.py` 已改为按需延迟导入，避免单元测试和接口测试因无关服务提前初始化而失败。

### 3. session 初始形状对齐
后端新局生成已对齐前端 `normalizeSession(createGameSession(...))` 的关键形状，尤其是 `priceHistory` 等结构字段。

## 本阶段未纳入完成标准的内容
以下内容不视为第一阶段阻塞项，留待第二阶段：

- 前端 `DATA_MODE=backend` 正式接通
- 页面层以服务端返回为唯一渲染来源
- backend gateway 联调
- 调试态双算校验开关
- WebSocket 推送主链接入
- 旧 `/trade`、`/move`、`/event/choice` 接口退场或彻底清理

## 第二阶段入口
第一阶段完成后，建议按以下顺序进入第二阶段：

1. 新增 `backendGameGateway` / `backendAuthGateway`
2. 接通 `startSession` / `getSession` / `persistSession`
3. 接通交易与仓储
4. 增加联调态前后端双算差异输出
5. 再接移动、事件和世界推进

## 风险提醒
- 前端源代码中仍存在部分历史乱码文本，但当前未改动其业务逻辑。
- 旧接口仍保留在项目中，文档上应继续明确其为非主流程接口。
- 当前 API 测试主要验证主链语义和返回结构，尚未接数据库真实集成环境做端到端持久化回归。
