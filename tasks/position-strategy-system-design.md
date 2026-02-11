# Texas Hold'em 位置與下注策略系統設計（手機訓練版）

## 1. 目標

把目前訓練引擎從「泛用建議」升級為「位置驅動建議」：

- 明確區分 UTG(+1)、LJ(+2)、HJ(+3)、CO(+4)、BTN、SB、BB
- 納入盲注（SB/BB）與 preflop 行動順序
- 同一牌力在 IP（In Position）與 OOP（Out of Position）給出不同建議
- 讓玩家理解：位置本身就是 EV 引擎

## 2. 位置模型

### 2.1 位置定義

- UTG(+1)：最早位置，開池範圍最緊
- LJ(+2)：早中位置，略放寬
- HJ(+3)：中後位置，可增加隔離與3bet機會
- CO(+4)：晚位，偷盲與施壓頻率上升
- BTN(Dealer)：最晚位，IP 優勢最大
- SB：小盲，翻後常 OOP，需更高紀律
- BB：大盲，preflop 有價格優勢但翻後多數 OOP

### 2.2 行動順序

- Preflop：UTG → LJ → HJ → CO → BTN → SB → BB
- Postflop：SB → BB → UTG → LJ → HJ → CO → BTN（BTN 最後行動）

## 3. 盲注與投注結構

- v1 盲注固定：`1/2`
- 每手牌記錄：
  - `smallBlind`
  - `bigBlind`
  - `heroPosition`
  - `villainPosition`
  - `heroInPositionPostflop`
- preflop 建議至少考慮：
  - 當前 toCall
  - 最小再加注增量
  - 有效籌碼（BB）
  - 位置組合（例如 BTN vs UTG）

## 4. 策略層設計

### 4.1 GTO 層（本地準 Solver）

- Preflop：CFR 查表（20/40/100bb）+ 插值
- Postflop：抽象 bucket CFR 查表
- 位置修正：
  - IP：邊緣防守門檻可適度放寬
  - OOP：邊緣跟注與高變異唬牌門檻上調

### 4.2 Exploit 層（針對破綻）

- 基於 leak profile（over-fold、call too wide、over-bluff river 等）
- 位置修正：
  - IP 對 over-fold 可擴大施壓頻率
  - OOP 對高變異 exploit 要降低頻率、提高牌力門檻

### 4.3 Best Mode 決策

- 同時計算 GTO 與 Exploit
- 若 exploit 相對 GTO 有明顯優勢且風險可控才切換
- 否則回歸 GTO 基線

## 5. AI 玩家行為設計（位置化）

- 同一 AI 風格，在不同位置需有不同 open size / open 頻率
- 基本原則：
  - 早位（UTG/LJ）範圍更緊、尺寸更穩定
  - 晚位（CO/BTN）偷盲頻率更高
  - SB 在 OOP 場景減少無腦延續下注

## 6. UI / UX 設計

### 6.1 桌面資訊（必顯）

- 盲注：`SB/BB`
- 當前局面：`HeroPosition vs VillainPosition`
- Preflop 行動路徑（例如 `UTG → ... → BTN`）
- 玩家是否 IP/OOP

### 6.2 小燈泡解析（必顯）

- GTO 建議（含位置理由）
- Exploit 建議（含位置理由）
- 最佳局面選擇原因
- 位置模型說明（+1/+2/盲位）

## 7. 訓練產品化設計

- 每個關卡至少覆蓋一組核心位置對抗：
  - 小白：BTN vs BB、CO vs BB
  - 入門：HJ vs BB、CO vs BTN 3bet 防守
  - 進階：UTG vs BTN、SB vs BTN
  - 高手/大神：多條 3bet/4bet 線
- 任務分成兩類：
  - 決策正確率
  - 位置紀律（OOP 不亂跟、IP 不漏 value）

## 8. 驗收標準

- 功能驗收：
  - 可在對局中明確看到 +1/+2、盲注、IP/OOP
  - 相同牌力在 IP/OOP 時建議可觀察到差異
- 教學驗收：
  - 小燈泡能解釋「為什麼同牌在不同位置打法不同」
- 數據驗收：
  - 玩家 OOP 過度跟注錯誤率逐週下降
  - 晚位主動施壓率逐週上升

## 9. 下一階段（v2）

- 真正多人同手牌引擎（不只是 Hero vs 單一對手）
- 全桌盲注輪轉與按鈕輪轉
- 可回放每手牌的 position-aware EV loss 熱點
