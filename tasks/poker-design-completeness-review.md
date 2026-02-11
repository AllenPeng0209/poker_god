# Texas Hold'em 遊戲設計完整度 Review（更新版）

日期：2026-02-07  
範圍：`mobile`（引擎、策略、桌面互動、訓練循環）

## 結論

目前版本已從教學型 heads-up 升級為「多人 action state machine + 逐步事件播放」：

- 已有多人玩家狀態（`players[]`）與行動輪（`actingPlayerId` / `pendingActors`）
- 已支援按鈕/盲注輪轉（每手牌切換 button）
- 已支援逐動作播放（發牌、盲注、每次行動、換街、公牌揭示）

但仍未達「競賽級完整德撲模擬器」，主要缺口在多人 solver tree 與完整規則變體。

## Findings（按嚴重度）

### High

1. 多人 preflop solver tree 尚未建模
- 現況：preflop 仍以原先 action code 思路為核心
- 影響：open/call/iso/squeeze/4bet 的多人線精度不足

### Medium

2. 動畫已可感知，但尚未做到完整「飛牌軌跡 + 推籌碼軌跡」
- 現況：已有收牌脈衝與底池脈衝
- 影響：操作節奏有了，但電影級桌感還可再提升

3. 規則變體尚未覆蓋
- 例如：ante、straddle、run-it-twice、dead blind

## 本輪已完成

1. 多人引擎 v2（核心）
- `mobile/src/types/poker.ts`
  - 新增 `TablePlayer`
  - 新增 `players[]`、`actingPlayerId`、`pendingActors`
  - 新增 `buttonPosition`、`smallBlindPosition`、`bigBlindPosition`
- `mobile/src/engine/game.ts`
  - `buildStreetQueue`
  - `buildReopenQueue`
  - `applyPlayerAction`
  - `runAiLoop`
  - `createNewHand` 支援 `tablePlayers/focusVillainId/buttonPosition`
  - `settleShowdown` 已支援主池/邊池（side pot）分配

2. 按鈕/盲注輪轉
- `mobile/App.tsx`
  - `nextButtonSeatId`
  - 每次 `startHand` 取下一個 button seat
  - 進桌與新手牌都帶入 `buttonPosition`

3. 每動作逐步可視（Action-by-Action）
- `mobile/App.tsx`
  - 事件佇列：`eventQueue`
  - 單步播放：`runNextEvent`
  - 逐步回放面板：`逐步動作回放`

4. 動畫層（本輪先做可感知版本）
- `mobile/App.tsx`
  - `animateSeatDeal`：收牌脈衝
  - `animateChipPush`：底池推籌碼脈衝
  - 桌面中央 `chipPulse` 動效

## 建議下一步（真・完整版）

1. 多人 preflop tree + solver abstraction（含 squeeze/4bet）
2. 完整飛牌路徑與籌碼路徑動畫（按座位向量）
3. 規則模組化（ante/straddle/變體桌）
