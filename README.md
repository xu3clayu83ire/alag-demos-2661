# alag-demos-2661 工作區

多專案工作區。每個專案放在獨立的子目錄，共用資料夾統一放根目錄。

## 工作區結構

```
alag-demos-2661/
├── _rule/                    ← 共用：流程規範 + 通用編碼規範
│   ├── workflow.md
│   └── coding-style.md
├── _note/                    ← 共用：通用技術筆記
│   └── mynote_*.md
├── _doc/                     ← 共用：展示文件（by 專案子目錄）
│   └── <專案>/
├── _idea/                    ← 共用：工作區層級的想法（需要時新增）
├── repo-radar/               ← 專案一
│   ├── _rule/                ← 專案專屬規範
│   │   ├── tech-stack.md
│   │   └── coding-style.md
│   ├── _spec/                ← 開發規格（by 主題）
│   ├── _note/                ← bugs、decisions、knowledge
│   ├── _idea/                ← 需求輸入
│   ├── backend/
│   ├── frontend/
│   └── infra/
└── <下一個專案>/             ← 專案二（同樣結構）
```

---

## Skills 使用流程

### 新專案：`/project-init`

**時機**：開始一個全新專案時

```
1. 在 <專案>/_idea/init.md 寫下需求（自由格式）
2. 執行 /project-init <專案名稱>
3. Claude 從 idea 推斷技術棧，列出確認清單 → 你確認
4. 產出：
   - <專案>/_rule/tech-stack.md
   - <專案>/_rule/coding-style.md
   - <專案>/_note/decisions.md（初始版）
   - 建立 _doc/<專案>/
5. 下一步：執行 /spec-writer 產出第一個功能規格
```

---

### 功能開發：`/spec-writer`

**時機**：開始開發一個新功能時

```
1. 在 <專案>/_idea/<需求檔>.md 描述需求
2. 執行 /spec-writer <idea檔名或模糊描述>
3. Claude 確認主題名稱 → 你確認
4. 產出 step1-requirements.md → Claude 詢問需求理解是否正確 → 你確認
5. 產出 step2-design.md
6. 產出 step3-tasks.md
7. 自動更新 <專案>/_note/decisions.md
8. 依 step3-tasks.md 逐項實作
```

規格放在：`<專案>/_spec/<主題>/step1~3.md`

---

### 驗證一致性：`/doc-checker`

**時機**：功能完成後，或懷疑文件與程式碼不同步時

> `/doc-checker` 是專案層級 skill，放在 `<專案>/.claude/skills/`，每個專案有自己的版本。

```
1. 執行 /doc-checker
2. Claude 掃描所有 .md 文件與實際程式碼
3. 回報三類差異：
   🔴 不符現況（需更新）
   🟡 可能過時（需確認）
   🟢 仍然正確
4. 告知 Claude 哪些需要更新
```

---

### 完整開發循環

```
新專案
  /project-init
      ↓
新功能
  /spec-writer → step1 確認 → step2 → step3 → 實作
      ↓
功能完成
  /doc-checker → 修正差異
```

---

## 開發前必讀（進入某專案前）

1. `_rule/workflow.md` — 共用流程規範
2. `_rule/coding-style.md` — 通用編碼規範
3. `<專案>/_rule/tech-stack.md` — 該專案技術棧
4. `<專案>/_rule/coding-style.md` — 該專案專屬程式碼風格（補充差異）

## 專案清單

| 專案 | 說明 |
|------|------|
| [repo-radar](repo-radar/) | GitHub Repo 分析工具，GraphQL + React + AWS Lambda |
