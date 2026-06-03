# 🔭 RepoRadar

輸入任意 GitHub repo，即時查看最新 commits，並由 AI 生成開發動態摘要。

**展示技術**：GraphQL 三種操作（Query / Mutation / Subscription）+ AWS Serverless + AI Streaming

🌐 **Live Demo**：[https://d13smath40yexn.cloudfront.net](https://d13smath40yexn.cloudfront.net)

---

## 架構圖

```
瀏覽器
  │
  ├─── HTTP POST /graphql ──────► API Gateway HTTP API
  │                                       │
  └─── WebSocket wss:// ────────► API Gateway WebSocket API
                                          │
                                    Lambda（單一函式）
                                    ┌─────┴──────┐
                              GitHub API    Anthropic API
                                          (claude-haiku-4-5)
                                          streaming
                                    └─────┬──────┘
                                       DynamoDB
                                   (connectionId ↔ sessionId)

前端靜態資源：S3 ──► CloudFront ──► 瀏覽器
```

### 請求流程

**Query — getRepo**
```
瀏覽器 → HTTP POST → Lambda → GitHub REST API → 回傳 repo 資訊 + 最新 10 筆 commits
```

**Mutation + Subscription — analyzeRepo**
```
1. 瀏覽器建立 WebSocket 連線，訂閱 onAnalysisUpdate(sessionId)
2. 瀏覽器發送 analyzeRepo mutation → Lambda 立即回傳 sessionId
3. Lambda 非同步啟動 Anthropic streaming
4. 每個 AI chunk → 查 DynamoDB 找 connectionId → postToConnection 推送
5. 瀏覽器即時顯示文字，done: true 時結束
```

---

## 技術棧

### 前端
| 項目 | 技術 |
|------|------|
| 框架 | React + TypeScript |
| GraphQL Client | Apollo Client |
| WebSocket | graphql-ws |
| 樣式 | Tailwind CSS |
| 託管 | S3 + CloudFront |

### 後端
| 項目 | 技術 |
|------|------|
| GraphQL Server | Apollo Server 4 |
| 執行環境 | AWS Lambda (Node.js 22) |
| AI | Anthropic claude-haiku-4-5（streaming） |
| 外部 API | GitHub REST API |

### 基礎設施
| 項目 | 技術 |
|------|------|
| IaC | AWS CDK（TypeScript） |
| API | API Gateway HTTP API + WebSocket API |
| 資料庫 | DynamoDB（WebSocket 連線狀態，TTL 自動清除） |

---

## 關鍵技術決策

### 1. 兩個 API Gateway 分工
HTTP API 處理 Query/Mutation，WebSocket API 處理 Subscription。Lambda 無狀態無法維持長連線，兩者分工讓職責清晰，HTTP API 成本也更低。

### 2. 先 subscribe 再觸發 mutation
前端用 `wsClient.subscribe()` 直接建立訂閱後，才發送 `analyzeRepo` mutation。確保 WebSocket 握手在 Lambda 開始推送 chunks 前就完成，避免 race condition。

### 3. subscriptionId 存入 DynamoDB
graphql-ws 協定規範 `next` 訊息必須帶上對應 `subscribe` 訊息的 `id`，否則 client 以 code 4004 關閉連線。後端收到 `subscribe` 訊息時將 id 存入 DynamoDB，推送時帶入。

---

## 本地開發

### 環境需求

- Node.js 22+
- GitHub Personal Access Token（`repo` 讀取權限）
- Anthropic API Key

### 啟動後端

```bash
cd repo-radar/backend
cp .env.example .env   # 填入 GITHUB_TOKEN 與 ANTHROPIC_API_KEY
npm install
npm run dev
# GraphQL endpoint: http://localhost:4000/graphql
# WebSocket endpoint: ws://localhost:4000/graphql
# Apollo Sandbox: http://localhost:4000/
```

### 啟動前端

```bash
cd repo-radar/frontend
npm install
npm run dev
# 開啟 http://localhost:5173
```

> 本地前端預設連接 `localhost:4000`，無需額外設定。

### 環境變數（backend/.env）

| 變數 | 說明 |
|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `ANTHROPIC_API_KEY` | Anthropic API Key |

---

## 專案結構

```
repo-radar/
├── backend/          # Apollo Server + Lambda handler
│   └── src/
│       ├── handler.ts          # Lambda 入口（HTTP / WebSocket / streaming task）
│       ├── server.ts           # 本地開發用 HTTP + WebSocket server
│       ├── schema.ts           # GraphQL schema
│       ├── resolvers/          # Query / Mutation / Subscription resolvers
│       └── services/           # GitHub / Anthropic / WebSocket services
├── frontend/         # React + Apollo Client
│   └── src/
│       ├── components/         # RepoInput / CommitList / AiSummary
│       └── graphql/            # Apollo client 設定 + operations
└── infra/            # AWS CDK stack
    └── lib/
        └── repo-radar-stack.ts
```
