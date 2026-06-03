# Step 3 — 任務拆解

> 每個任務設計為獨立可驗證，完成後有明確的檢查點。
> 建議順序：由上到下，完成一個再做下一個。

---

## Phase 0 — 專案骨架（~1.5h）✅

### T01 — 初始化 monorepo 目錄結構 ✅
建立以下空目錄與空 package.json：
```
repo-radar/
├── backend/
├── frontend/
└── infra/
```
**完成定義**：三個資料夾存在，各有 `package.json`

---

### T02 — 設定 backend TypeScript 環境 ✅
- 安裝：`typescript`, `ts-node`, `@types/node`
- 建立 `tsconfig.json`（target: ES2020, strict: true）
- 建立 `backend/src/index.ts`，內容只有 `console.log('hello')`
- 執行 `ts-node src/index.ts` 確認能跑

**完成定義**：`ts-node src/index.ts` 印出 hello，無 TypeScript 錯誤

---

### T03 — 設定 infra TypeScript 環境 ✅
- 安裝 AWS CDK CLI：`npm install -g aws-cdk`
- 在 `infra/` 執行 `cdk init app --language typescript`
- 確認 `cdk synth` 能執行（產出空 CloudFormation template）

**完成定義**：`cdk synth` 成功，無錯誤

---

## Phase 1 — 後端核心（~4h）✅

### T04 — 安裝後端依賴 ✅
```bash
npm install @apollo/server graphql graphql-ws graphql-subscriptions
npm install @anthropic-ai/sdk
npm install -D @types/node typescript ts-node
```
**完成定義**：`node_modules` 存在，`package.json` dependencies 正確

---

### T05 — 建立 GraphQL Schema ✅
建立 `backend/src/schema.ts`，定義：
- `Commit` type
- `RepoInfo` type
- `AnalysisChunk` type
- `Query.getRepo`
- `Mutation.analyzeRepo`
- `Subscription.onAnalysisUpdate`

**完成定義**：檔案無 TypeScript 錯誤，export `typeDefs`

---

### T06 — 建立 PubSub 實例 ✅
建立 `backend/src/pubsub.ts`：
```typescript
import { PubSub } from 'graphql-subscriptions';
export const pubsub = new PubSub();
```
**完成定義**：檔案存在，export `pubsub`

---

### T07 — 建立 GitHub Service ✅
建立 `backend/src/services/github.ts`：
- 函式 `getRepoInfo(owner: string, repo: string): Promise<RepoInfo>`
- 呼叫 GitHub REST API：`GET /repos/{owner}/{repo}` 取基本資訊
- 呼叫 GitHub REST API：`GET /repos/{owner}/{repo}/commits?per_page=10` 取 commits
- 使用環境變數 `GITHUB_TOKEN`

**完成定義**：本地執行測試腳本，`getRepoInfo('xu3clayu83ire', 'alag-repo-radar')` 回傳正確資料

---

### T08 — 建立 Query Resolver ✅
建立 `backend/src/resolvers/query.ts`：
- `getRepo` resolver 呼叫 `github.getRepoInfo()`

**完成定義**：檔案無 TypeScript 錯誤，export `queryResolvers`

---

### T09 — 建立 Apollo Server（HTTP + WebSocket，本地）✅
建立 `backend/src/server.ts`：
- 啟動 HTTP server + WebSocket server 共用 port 4000
- 掛載 Query / Mutation / Subscription resolver
- 內嵌 Apollo Sandbox（避免 mixed content 問題）
- `import 'dotenv/config'` 載入環境變數

**完成定義**：`ts-node src/server.ts` 啟動，`http://localhost:4000/` 開啟 Sandbox 正常

---

### T10 — 建立 Anthropic Service ✅
建立 `backend/src/services/anthropic.ts`：
- 函式 `streamAnalysis(sessionId: string, commits: Commit[]): Promise<void>`
- 呼叫 Anthropic API streaming（`claude-haiku-4-5`）
- 每個 chunk 發布到 `pubsub.publish('ANALYSIS_UPDATE', ...)`
- 結束時發布 `done: true`

**完成定義**：本地執行測試腳本，能看到 chunks 逐一印出，最後印出 done

---

### T11 — 建立 Mutation Resolver ✅
建立 `backend/src/resolvers/mutation.ts`：
- `analyzeRepo` resolver
- 接受可選 `sessionId` 參數（方便測試），預設 `session-${Date.now()}`
- **非同步**呼叫 `streamAnalysis()`（不 await）
- 立即 return sessionId

**完成定義**：Apollo Sandbox 執行 `analyzeRepo`，立即收到 sessionId

---

### T12 — 建立 Subscription Resolver ✅
建立 `backend/src/resolvers/subscription.ts`：
- `onAnalysisUpdate` resolver 訂閱 `pubsub.asyncIterableIterator('ANALYSIS_UPDATE')`
- filter：只回傳 sessionId 匹配的 chunks

**完成定義**：檔案無 TypeScript 錯誤，export `subscriptionResolvers`

---

### T13 — 整合 WebSocket + Subscription（本地）✅
`backend/src/server.ts` 整合：
- `graphql-ws` WebSocket server
- 掛載 Subscription resolver
- HTTP server + WebSocket server 共用 port 4000

**完成定義**：Apollo Sandbox 同時開啟 Mutation + Subscription，執行 `analyzeRepo` 後，Subscription 逐一收到 chunks，最終收到 `done: true`

---

## Phase 2 — 前端 UI（~3h）

> 前端先連本地 server（`http://localhost:4000/graphql` + `ws://localhost:4000/graphql`），Lambda 部署完成後再換 URL。

### T14 — 初始化 React 專案 ✅
```bash
cd frontend && npm create vite@latest . -- --template react-ts
npm install
npm install @apollo/client graphql graphql-ws
npm install -D tailwindcss @tailwindcss/vite
```
**完成定義**：`npm run dev` 啟動，瀏覽器開啟預設 Vite 畫面

---

### T15 — 設定 Apollo Client（HTTP + WebSocket）✅
建立 `frontend/src/graphql/client.ts`：
- HTTP link 指向 `http://localhost:4000/graphql`
- WebSocket link（graphql-ws）指向 `ws://localhost:4000/graphql`
- Split link：Subscription 走 WS，其餘走 HTTP

**完成定義**：檔案無 TypeScript 錯誤，export `apolloClient`

---

### T16 — 定義 GraphQL Operations ✅
建立 `frontend/src/graphql/operations.ts`：
- `GET_REPO` query
- `ANALYZE_REPO` mutation
- `ON_ANALYSIS_UPDATE` subscription

**完成定義**：檔案無 TypeScript 錯誤，三個 operation 定義正確

---

### T17 — 建立 RepoInput 元件 ✅
建立 `frontend/src/components/RepoInput.tsx`：
- owner / repo 兩個輸入欄位
- 送出按鈕，觸發 `GET_REPO` query
- loading / error 狀態顯示

**完成定義**：輸入 `xu3clayu83ire/alag-repo-radar` 按送出，收到 repo 資料

---

### T18 — 建立 CommitList 元件 ✅
建立 `frontend/src/components/CommitList.tsx`：
- 接收 `commits` array prop
- 顯示每筆：message、author、timestamp

**完成定義**：Query 回傳後，畫面顯示 10 筆 commits

---

### T19 — 建立 AiSummary 元件 ✅
建立 `frontend/src/components/AiSummary.tsx`：
- 接收 `sessionId` prop
- 訂閱 `ON_ANALYSIS_UPDATE`
- 每收到 chunk 追加到顯示文字（打字機效果）
- `done: true` 時停止，顯示完成狀態

**完成定義**：觸發分析後，文字逐字出現，最終顯示完整摘要，游標消失

---

### T20 — 整合 App.tsx ✅
修改 `frontend/src/App.tsx`：
- 串接 RepoInput → CommitList → AiSummary 完整流程
- 套用 Tailwind 樣式（深色主題，參考 step2-design.md UI 設計）
- 「AI 分析」按鈕觸發 `ANALYZE_REPO` mutation，拿到 sessionId 傳給 AiSummary

**完成定義**：完整走完輸入 → 查詢 → AI 分析 → 逐字顯示，無 console 錯誤

---

## Phase 3 — Lambda 化（~2h）

### T21 — 建立 Lambda Handler（HTTP）✅
建立 `backend/src/handler.ts`：
- 將 Apollo Server 包裝成 Lambda handler（使用 `@as-integrations/aws-lambda`）
- 處理 API Gateway HTTP event
- `import 'dotenv/config'` 載入環境變數

**完成定義**：本地用 `lambda-local` 或直接測試 handler function 可回傳 GraphQL response

---

### T22 — 建立 WebSocket Handler ✅
在 `backend/src/handler.ts` 加入 WebSocket 路由：
- `$connect`：將 `connectionId` 存入 DynamoDB
- `$disconnect`：從 DynamoDB 刪除 `connectionId`
- `$default`：處理 graphql-ws 訊息

**完成定義**：handler 檔案包含三個路由，無 TypeScript 錯誤

---

### T23 — 建立 WebSocket Service ✅
建立 `backend/src/services/websocket.ts`：
- 函式 `pushToConnections(sessionId: string, payload: AnalysisChunk)`
- 從 DynamoDB 查詢對應 sessionId 的所有 connectionId
- 用 `ApiGatewayManagementApiClient.postToConnection` 推送

**完成定義**：檔案無 TypeScript 錯誤，DynamoDB query 邏輯正確

---

### T24 — 修改 Anthropic Service 支援雙模式推送 ✅
修改 `backend/src/services/anthropic.ts`：
- Lambda 環境（`process.env.AWS_EXECUTION_ENV` 存在）改呼叫 `websocket.pushToConnections()`
- 本地開發保留 `pubsub.publish()`

**完成定義**：兩種模式的 streaming 推送邏輯都能運作

---

## Phase 4 — CDK 基礎設施（~2h）

### T25 — 建立 DynamoDB Table ✅
在 `infra/lib/repo-radar-stack.ts` 加入：
- `ConnectionsTable`：PK = `connectionId`，TTL 欄位 = `ttl`
- BillingMode: PAY_PER_REQUEST

**完成定義**：`cdk synth` 成功，CloudFormation template 含 DynamoDB resource

---

### T26 — 建立 Lambda Function ✅
在 stack 加入：
- Lambda function，指向 `backend/src/handler.ts`（bundled）
- 環境變數：`GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, `CONNECTIONS_TABLE_NAME`
- IAM 權限：DynamoDB read/write

**完成定義**：`cdk synth` 成功，Lambda + IAM role 出現在 template

---

### T27 — 建立 HTTP API Gateway ✅
在 stack 加入：
- HTTP API Gateway
- ANY `/graphql` → Lambda integration

**完成定義**：`cdk synth` 成功，HTTP API 出現在 template

---

### T28 — 建立 WebSocket API Gateway ✅
在 stack 加入：
- WebSocket API Gateway
- `$connect`, `$disconnect`, `$default` → Lambda integration
- 輸出 WebSocket endpoint URL

**完成定義**：`cdk synth` 成功，WebSocket API 出現在 template

---

### T29 — 建立 S3 + CloudFront（前端靜態託管）✅
在 stack 加入：
- S3 bucket（靜態網站）
- CloudFront distribution 指向 S3
- 輸出 CloudFront URL

**完成定義**：`cdk synth` 成功，S3 + CloudFront 出現在 template

---

### T30 — cdk deploy ✅
- 執行 `cdk deploy`
- 確認所有資源建立成功
- 記錄輸出的 HTTP API URL、WebSocket URL、CloudFront URL

**完成定義**：AWS Console 可看到所有資源，三個 URL 有效

---

## Phase 5 — 部署與收尾（~1h）

### T31 — 前端切換到 AWS endpoint ✅
修改 `frontend/src/graphql/client.ts`：
- HTTP link 改指向 AWS HTTP API URL
- WebSocket link 改指向 AWS WebSocket URL

**完成定義**：前端連到 AWS 後端，功能與本地一致

---

### T32 — 前端 build 並上傳 S3 ✅
```bash
cd frontend && npm run build
aws s3 sync dist/ s3://<bucket-name>
```
**完成定義**：CloudFront URL 開啟，畫面正常顯示

---

### T33 — 端到端驗收測試 ✅
使用真實 repo 執行完整流程：
1. 開啟 CloudFront URL
2. 輸入 owner / repo，點查詢
3. 看到 commits 列表
4. 點 AI 分析，看到文字逐字出現
5. 等待 `done: true` 完成

**完成定義**：五個步驟全部成功，無錯誤

---

### T34 — 撰寫 README ✅
`README.md` 包含：
- 架構圖（文字版）
- 技術決策說明
- 本地開發啟動步驟
- Live Demo URL
- 面試展示腳本

**完成定義**：README 存在，內容完整

---

## 時程總覽

| Phase | 內容 | 預估時間 | 狀態 |
|-------|------|---------|------|
| Phase 0 | 專案骨架 | 1.5h | ✅ |
| Phase 1 | 後端核心 | 4h | ✅ |
| Phase 2 | 前端 UI | 3h | ✅ |
| Phase 3 | Lambda 化 | 2h | ✅ |
| Phase 4 | CDK 基礎設施 | 2h | ✅ |
| Phase 5 | 部署與收尾 | 1h | ✅ |
| **合計** | | **~13.5h** | ✅ |
