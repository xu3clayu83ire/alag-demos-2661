# Step 1 — 需求理解與驗收條件

## 需求理解

RepoRadar 是一個 GitHub repo 即時監控 + AI 摘要助理。

使用者輸入任意 GitHub repo（owner/name），系統會：
1. 即時查詢該 repo 的基本資訊與最新 commits
2. 讓使用者觸發 AI 分析，AI 以 streaming 方式逐字推送開發摘要與風險提示
3. 前端即時顯示 AI 逐字輸出（字字浮現效果）

整個系統以 GraphQL 三種操作（Query / Mutation / Subscription）為核心展示，
部署於 AWS（Lambda + API Gateway + DynamoDB + CloudFront）。

---

## 功能清單

### F1 — 查詢 Repo 資訊（Query）
- 輸入：GitHub owner + repo name
- 呼叫 GitHub REST API
- 回傳：repo 基本資訊（名稱、描述、stars、forks、open issues 數量）
- 回傳：最新 10 筆 commits（message、author、timestamp）

### F2 — 觸發 AI 分析（Mutation）
- 輸入：GitHub owner + repo name
- 取得最近 commits message 作為 context
- 呼叫 Anthropic API（claude-haiku-4-5），streaming 模式
- 回傳：sessionId（用於後續 Subscription 訂閱）
- AI prompt：產出本週開發摘要 + 潛在風險提示

### F3 — 即時接收 AI 串流（Subscription）
- 輸入：sessionId
- 透過 WebSocket 接收 AI streaming chunks
- 每個 chunk 包含：sessionId、chunk text、done flag
- done: true 時串流結束

### F4 — 前端 UI
- RepoInput：輸入 owner/repo，觸發 Query
- CommitList：顯示最新 10 筆 commits
- AiSummary：即時顯示 AI streaming 文字（字字浮現）
- 連線狀態指示（WebSocket 連線中 / 已斷線）

### F5 — AWS 部署
- 後端 Lambda 處理 HTTP GraphQL 請求
- 後端 Lambda 處理 WebSocket 連線管理
- DynamoDB 儲存 WebSocket connectionId（含 TTL 自動清除）
- 前端靜態檔案部署至 S3 + CloudFront

---

## 非功能需求

| 項目 | 要求 |
|------|------|
| 回應時間 | Query 在 GitHub API 回應內完成（< 3s） |
| AI streaming | 首個 chunk 延遲 < 2s |
| WebSocket | 支援連線斷線自動清除（DynamoDB TTL） |
| 安全性 | GitHub Token / Anthropic Key 存於 Lambda 環境變數，不暴露前端 |
| TypeScript | strict mode，禁止 `any` |
| 成本 | 採用 pay-per-request（DynamoDB on-demand），無閒置費用 |

---

## 範圍邊界（不做）

- **不做**使用者登入 / 帳號系統
- **不做** repo 資料持久化（每次查詢都即時呼叫 GitHub API）
- **不做** AI 分析歷史紀錄儲存
- **不做**多人同時分析同一 repo 的衝突處理
- **不做** GitHub Webhook（主動推送），只做被動查詢
- **不做**錯誤重試機制（Demo 等級，手動重新操作即可）
- **不做**前端路由（單頁，無多頁切換）

---

## 驗收條件

| 功能 | Done Criteria |
|------|---------------|
| F1 Query | Apollo Sandbox 執行 `getRepo`，正確回傳 repo 資訊 + 10 筆 commits |
| F2 Mutation | Apollo Sandbox 執行 `analyzeRepo`，回傳有效 sessionId |
| F3 Subscription | Apollo Sandbox 訂閱 `onAnalysisUpdate`，能收到逐一 chunk，最終收到 `done: true` |
| F4 前端 | 瀏覽器開啟 Demo URL，完整走完輸入 → 查詢 → AI 分析 → 逐字顯示流程 |
| F5 部署 | `cdk deploy` 成功，Live Demo URL 可公開存取 |
| 整合 | 以 `facebook/react` 為測試輸入，完整流程無錯誤 |
