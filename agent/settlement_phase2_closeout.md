# 结算后端化阶段正式收口

## 范围

本次收口覆盖以下内容：

- 认证接入后端
- 排行榜接入后端
- 结算统一由后端裁定
- 结算完成动作与成绩写入并轨
- 结算结果正式归档
- 会话清理与归档保留解耦
- 归档查询接口补齐
- 手动验收与结算说明文档落档

## 已完成能力

### 1. 账号与排行榜

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/accounts/{account_id}`
- `GET /api/leaderboard`
- `POST /api/leaderboard/{account_id}/score`

说明：

- 前端刷新时可从后端恢复当前账号
- 最佳成绩仍由后端作为唯一可信来源

### 2. 结算预览与正式完成

- `GET /api/session/{session_id}/settlement`
- `POST /api/session/{session_id}/complete`

说明：

- 未完成归档时返回实时结算结果
- 已完成归档时优先回读正式记录
- `complete` 接口幂等

### 3. 结算归档查询

- `GET /api/session/{session_id}/archive`
- `GET /api/auth/accounts/{account_id}/settlements`

说明：

- 可按会话读取正式归档
- 可按账号读取最近结算历史
- 为后续审计页、个人战绩页、后台排查预留接口基础

### 4. 会话生命周期

- `DELETE /api/session/{session_id}`

说明：

- 清理进行中的会话缓存
- 不影响 `settlement_records` 归档数据

## 数据落库

### 会话表

- `game_sessions`

用途：

- 保存当前进行中的局面

### 结算归档表

- `settlement_records`

用途：

- 保存正式完成后的结算记录

关键约束：

- `session_id` 唯一

关键字段：

- `record_id`
- `session_id`
- `account_id`
- `final_score`
- `result_code`
- `settlement_json`
- `created_at`

## 前端收口状态

前端已完成：

- 账号刷新恢复走后端确认
- 结算面板由后端正式结果驱动
- 结算面板展示 `recordId` 与 `finalizedAt`
- 回大厅、重开、登出时主动清理会话

## 文档落档

本阶段形成的正式文档：

- [manual_acceptance_phase2_record.md](/abs/path/c:/Users/Anson/Desktop/commercial_game/agent/manual_acceptance_phase2_record.md)
- [settlement_backend_formalization.md](/abs/path/c:/Users/Anson/Desktop/commercial_game/agent/settlement_backend_formalization.md)
- [settlement_phase2_closeout.md](/abs/path/c:/Users/Anson/Desktop/commercial_game/agent/settlement_phase2_closeout.md)

## 验证结果

已通过的关键验证：

- `backend.tests.test_auth_api_phase2`
- `backend.tests.test_settlement_api_phase2`
- `backend.tests.test_phase2_contracts`
- `frontend tsc --noEmit`

## 结论

这一部分可以正式收口。

当前状态已经从“前后端联通”推进到“后端主导、可归档、可回读、可审计的正式结算链路”：

- 有统一裁定
- 有正式归档
- 有幂等完成
- 有账号战绩查询入口
- 有会话清理边界
- 有文档与测试支撑

## 后续非阻塞项

后续仍可继续增强，但不再阻塞本阶段收口：

- 个人战绩前端页面
- 排行榜维度扩展
- 管理端归档检索
- 账号密码安全升级
