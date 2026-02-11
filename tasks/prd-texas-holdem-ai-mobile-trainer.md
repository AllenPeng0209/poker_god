# PRD: Texas Hold'em AI Mobile Trainer (Expo)

## Introduction

這是一款面向手機端（Expo/React Native）的德州撲克 AI 練習產品，目標是讓玩家從新手到高手，透過「高擬人 AI 對戰 + 即時解析 + 漸進打怪升級」快速建立可實戰的決策能力。產品核心同時覆蓋兩套思維：

- GTO（Game Theory Optimal）理論下法：降低被剝削風險
- Exploit（剝削）下法：針對對手破綻最大化收益

產品強調「像真人在打牌」：AI 會有性格、節奏、垃圾話，並可在關鍵節點打開解析，看到每一步為什麼要這樣下。

## Clarifying Questions (for next iteration)

1. 主要商業模式是？
   A. 先免費 MVP（不含付費）
   B. 訂閱制（解鎖高級 AI/高級解析）
   C. 單次買斷
   D. 其他

2. 目前版本重點是？
   A. 只做單機 AI 練習
   B. 單機 + 排行榜
   C. 先做教學關卡再開放自由對局
   D. 其他

3. 解析深度預設要到哪一層？
   A. 基礎（範圍、賠率、推薦動作）
   B. 進階（頻率混合、街道規劃）
   C. 專業（EV 拆解、範圍可視化、對手模型）
   D. 可切換

4. 垃圾話風格預設？
   A. 輕鬆搞笑
   B. 競技嗆聲
   C. 專業冷嘲
   D. 家長模式（文明版）

5. 首發語言與地區？
   A. 繁中優先
   B. 中英雙語
   C. 英文優先
   D. 其他

## Goals

- 讓新手在 14 天內建立 preflop/flop 基本決策框架
- 讓進階玩家能讀懂「GTO 與剝削策略何時切換」
- 每局提供可讀、可操作、可回放的決策解釋
- 提供關卡式成長，從小白區到大神區清楚可見
- 將學習轉化成可量化能力值（讀牌、下注尺度、抗壓）

## User Stories

### US-001: 即時對局與行動選擇
**Description:** As a player, I want to perform fold/call/raise actions in a hand so that I can practice core poker decisions.

**Acceptance Criteria:**
- [ ] 支援 preflop/flop/turn/river 四街狀態流轉
- [ ] 顯示底池、有效籌碼、位置、當前行動
- [ ] 玩家可執行 Fold/Call/Raise
- [ ] 系統可更新手牌結果與籌碼變化
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: 右上角解析開關（GTO + 剝削）
**Description:** As a player, I want a top-right analysis toggle so that I can learn optimal and exploitative lines during play.

**Acceptance Criteria:**
- [ ] 右上角可一鍵開啟/關閉解析面板
- [ ] 顯示 GTO 建議動作 + 原因
- [ ] 顯示 Exploit 建議動作 + 針對的對手破綻
- [ ] 顯示「當前最佳局面」與理由（EV/風險）
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: 高擬人 AI 與垃圾話系統
**Description:** As a player, I want AI opponents with personality and table talk so that games feel like real live poker.

**Acceptance Criteria:**
- [ ] AI 具備至少 4 種人格（Nit/TAG/LAG/Maniac）
- [ ] 每種人格有不同下注頻率與語氣
- [ ] AI 可在關鍵節點輸出垃圾話
- [ ] 提供文明模式開關可降低冒犯內容
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: 分區段位與打怪升級
**Description:** As a player, I want ranked training zones so that I can progress from beginner to expert in structured stages.

**Acceptance Criteria:**
- [ ] 區域至少包含：小白區、入門區、進階區、高手區、大神區
- [ ] 每區配置不同 AI 難度與破綻型態
- [ ] 過關條件包含勝率與決策品質分數
- [ ] 破關後解鎖下一區與新 AI 對手
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: 破綻導向訓練任務
**Description:** As a player, I want drills based on my leaks so that I can systematically fix weaknesses.

**Acceptance Criteria:**
- [ ] 系統追蹤玩家常見錯誤（過度跟注、錯誤下注尺度等）
- [ ] 每日生成 1-3 個修正任務
- [ ] 完成任務可獲得能力值與資源獎勵
- [ ] 提供錯誤前後對照（修正建議）
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: 系統必須提供可進行完整單手牌流程的對戰引擎（四街+攤牌）
- FR-2: 系統必須在 UI 右上角提供解析開關
- FR-3: 解析面板必須同時展示 GTO 與 Exploit 建議
- FR-4: 系統必須計算並呈現「當前最佳動作」及其依據
- FR-5: 系統必須提供 AI 人格模型並影響其決策頻率
- FR-6: 系統必須提供可配置的垃圾話輸出（含文明模式）
- FR-7: 系統必須提供五段以上訓練區與解鎖機制
- FR-8: 系統必須追蹤玩家破綻並生成修正任務
- FR-9: 系統必須保存玩家進度、段位與能力值
- FR-10: 系統必須允許對局回放與關鍵節點復盤

## Non-Goals

- 不在 v1 提供真人 PvP 桌
- 不在 v1 提供現金賽/真金交易
- 不在 v1 追求完全 solver 級別精度（先以可學習與可解釋為優先）
- 不在 v1 支援桌機與網頁完整版本（先專注手機）

## Design Considerations

- 核心心智：打牌中學習，而不是看完課再打牌
- 解析面板設計需「一眼可讀」，避免學術文字過載
- 垃圾話應可控：提供開關與強度分級
- 以卡牌桌氛圍建立沉浸感（節奏、語氣、回饋）

## Technical Considerations

- 前端：Expo + React Native + TypeScript
- 狀態管理：Zustand（建議）
- 本地資料：AsyncStorage（進度/設定）
- 決策引擎：Rule-based Heuristics（v1），後續可接 solver API
- 模型架構：
  - `strategy/gtoEngine.ts`
  - `strategy/exploitEngine.ts`
  - `strategy/bestActionResolver.ts`
- 內容安全：垃圾話詞庫分級 + 敏感詞過濾 + 家長模式

## Success Metrics

- D7 留存 > 25%
- 每位玩家每週完成至少 20 手練習
- 60% 以上玩家在 2 週內段位上升至少 1 級
- 新手區玩家 preflop 決策錯誤率下降 30%
- 解析面板開啟率 > 50%

## Open Questions

- v1 是否引入每日挑戰與排行榜，還是先專注單機迴圈？
- 是否需要導入語音垃圾話（TTS）或先文字版？
- 是否在高手區導入混合策略頻率可視化（例如 70/30）？
- 何時接入真正 solver 或雲端 AI 模型？
