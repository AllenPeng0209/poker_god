# 学习模块 vs 目标效果：差距与代码该怎么填

对照你截图里的「目标效果」（类似 GTOWizard 的 Turn XR Defense 节点），下面说明**当前实现和目标的差距**，以及**要在哪里填什么代码**才能接近那种效果。

---

## 一、目标效果 vs 你现在的效果（一句话）

| 维度 | 目标（截图里那种） | 你现在的实现 |
|------|-------------------|----------------|
| **数据来源** | Solver 真实求解结果（每手牌、每个节点的 GTO 频率） | 静态 Spot 元数据（`action_mix` + `ranges.buckets`） |
| **每手牌策略** | 混合策略：如 J7s 100% Fold、A7s 100% Jam，且每手牌可以是 70% Call 30% Fold 等 | 每手牌只属于一个桶：要么 100% 一个动作，要么 100% 另一个，没有「混合」 |
| **总体数字** | Jam 12%、Call 51%、Fold 37%，且来自求解器 | 总体数字已对齐 Spot（Call 51%、Jam 12%、Fold 37%），但矩阵是「按牌力 + 桶占比」推出来的，不是 solver 算的 |
| **UI 形态** | Spot Library + 筛选 + 13×13 矩阵 + 右侧总览/单手详情 | 你已有：Spot Library、筛选、13×13 矩阵、右侧总览和单手详情 |

所以：**UI 和交互你已经做得差不多了；差距主要在「数据是不是 solver 算出来的、以及每手牌是不是混合策略」**。

---

## 二、差距拆开看（3 层）

### 1. 数据层：你现在用的是什么

- **Spot 列表**：来自 API `GET /api/study/spots` 或本地 `studySpots.ts` 的 `STUDY_SPOTS`。
- **每个 Spot 的 node**：`action_mix`（如 Call 51%、Jam 12%、Fold 37%）+ `ranges.buckets`（如 Strong draws 28%、Top pair+ 33% 等）。
- **矩阵格子**：在 `StudySpotBrowser.tsx` 里用 `ranges.buckets` 的占比，按牌力排序把 169 手牌分成「纯 Raise / 纯 Call / 纯 Fold」，没有每手牌自己的频率。

目标效果需要的是：**同一个节点、每一手牌**都有「Jam % / Call % / Fold %」这种**真实 GTO 频率**，且总体加总起来就是 12% / 51% / 37%。

### 2. 数据层：目标需要什么

- 每个「节点」对应 TexasSolver（或任意 solver）**某次求解**的**某个决策点**。
- 该节点的策略 = 一棵子树上的策略表：**手牌 → 动作 → 频率**（例如 A7s → Jam 100%，J7s → Fold 100%，某手牌 → Call 70% Fold 30%）。
- 这些数据要么来自：
  - **预计算**：线下用 TexasSolver 算好，导出 JSON，再导入到你后端/前端；要么
  - **在线求解**：你后端调 TexasSolver（或别的 solver）现算，再把结果给前端。

你当前**没有**「节点 ↔ solver 结果」这一层，所以矩阵只能靠桶和牌力近似。

### 3. 前端展示层：还缺什么

- 你已经有「三个动作（Raise/Call/Fold 或 Jam/Call/Fold）」的总体百分比和组合数，也有 13×13 矩阵和单手详情。
- 要完全对齐目标，只差：**每个格子不再是一个桶的 0/100，而是 solver 给出的 0~100 的混合比例**（例如 70% Call、30% Fold）。  
  也就是说：**数据一旦是「每手牌 × 每动作频率」的格式，你前端的矩阵和右侧详情只需要接这个数据来展示，不用再按桶推算。**

---

## 三、代码该怎么填：按「谁来做、在哪填」分

下面按「你现在代码里缺的是哪一块」来说，方便你对着文件填。

### 1. 数据从哪来（必选一条路）

你要先决定：**节点策略是预计算好的，还是每次请求时现算？**

#### 方案 A：预计算（推荐先做）

- **谁做**：你本地用 TexasSolver GUI 建树、求解，然后在菜单里 **Strategy → export to file → json** 导出。
- **得到什么**：一个很大的 JSON，里面是整棵游戏树的策略（按节点、手牌、动作给频率）。
- **你要填的代码**：
  1. **解析 TexasSolver 的 JSON**  
     - 位置：可以新开一个包或 `apps/web/src/lib/` 下，例如 `parseTexasSolverJson.ts`。  
     - 做的事：读入导出的 JSON，按「节点标识（或 round + 动作序列）」找到你关心的那个节点，再把手牌 → 动作频率提出来，转成你前端需要的结构（见下）。
  2. **把「节点 ↔ 策略」存起来**  
     - 要么：在**后端**（例如 `services/api`）里，把解析好的「节点 → 每手牌频率」存成文件或 DB（例如按 `node_code` 或 `board+street+pot` 存）。  
     - 要么：在**前端**，把某次导出的 JSON 放到 `public/` 或通过 build 时注入，前端直接读、解析、按 spot 的 `node_code` 匹配。
  3. **API 或前端数据流**  
     - 若存后端：加一个接口，例如 `GET /api/study/spots/:spotId/node-strategy` 或把策略嵌在现有 `GET /api/study/spots` 的每个 spot 的 `node` 里，返回「每手牌、每动作频率」。  
     - 若只在前端：在 `StudySpotBrowser` 里，根据 `selectedSpot.node.node_code`（或 board+street）去加载对应的策略 JSON，再交给下面的「展示层」用。

#### 方案 B：在线求解（后面再做）

- **谁做**：后端服务调 TexasSolver 的**命令行/控制台**（见 `third_party/TexasSolver` 的 console 用法），传入 range、board、pot、stack、bet sizes 等，等算完再解析 stdout/结果文件。
- **你要填的代码**：
  1. 后端：一个「提交求解任务」的接口（写入参数到临时目录、调 TexasSolver、轮询或等结束）。
  2. 后端：解析 TexasSolver 输出（或 dump 出来的 JSON），转成统一格式。
  3. 同上：把「节点 → 每手牌频率」通过 API 给前端，或写入 DB 再被现有 study API 返回。

建议：**先做方案 A**，把「TexasSolver 导出的 JSON → 你前端的矩阵」这条链路打通，再考虑在线求解。

---

### 2. 前端：期望拿到的数据结构（你要「填」成什么样）

目标：**每个 Spot 的当前节点**，都有一份「手牌 → 动作频率」的表，这样矩阵和右侧详情就只做展示。

建议在**类型**里先定好（例如在 `studySpots.ts` 或 `contracts` 里）：

```ts
// 某个节点上，单手牌的策略
type HandStrategy = {
  hand: string;           // "A7s", "J7s", "22" 等
  actions: Array<{
    action: string;       // "Jam", "Call", "Fold"
    frequency_pct: number;
  }>;
};

// 节点策略：169 手牌各自的比例
type NodeStrategyMatrix = {
  node_code: string;      // 或 board+street+pot 等唯一标识
  hands: HandStrategy[];  // 长度 169，或用 Map<hand, HandStrategy>
};
```

- **有 API 时**：在 `StudySpotBrowser` 里，对 `selectedSpot` 请求该节点的 `NodeStrategyMatrix`（或从 spot 的 `node.strategy_matrix` 读），没请求到再回退到现在的「按桶推算」逻辑。
- **没有 API 时**：可以先用一份**静态的、从 TexasSolver 导出并解析好的** JSON 放在前端，例如只针对 `HU_BB_T_XR_DEF_Q83_6` 这一个 node，在 `StudySpotBrowser` 里 `import` 或 fetch 这份 JSON，再按 `node_code` 匹配，用来驱动矩阵和右侧单手牌详情。

这样你就知道「代码要填成什么样」：**最终把 `NodeStrategyMatrix` 交给当前负责画矩阵和详情的逻辑**。

---

### 3. 前端：矩阵和详情「怎么用」这份数据（具体填哪里）

文件：`apps/web/src/components/study/StudySpotBrowser.tsx`。

- **现在**：`matrixCells` 是用 `ranges.buckets` + 牌力排序算出来的，每个格子只有 0 或 100（`raisePct` / `allinPct` / `foldPct` 里两个 0、一个 100）。
- **改成**：
  - 若当前 spot 有 `node.strategy_matrix`（或你从 API/静态 JSON 拿到的 `NodeStrategyMatrix`）：
    - 遍历 169 手牌，对每手牌从 `strategy_matrix` 里取该手的 `actions`，转成 `raisePct` / `allinPct` / `foldPct`（对应 Jam/Call/Fold 或你当前用的三个槽位），赋给 `matrixCells`。
    - 右侧「总览」的 12% / 51% / 37% 可以继续用 spot 的 `action_mix`，或从 169 手牌频率加总再算一遍。
  - 若没有 `strategy_matrix`：保持现有逻辑（按桶 + 牌力），作为 fallback。

这样你**不需要大改 UI**，只是把 `matrixCells` 的数据源从「桶推算」换成「solver 结果」即可。

---

### 4. TexasSolver 导出 JSON 长什么样（方便你写解析）

TexasSolver 的 `dump_strategy` 产出的是**整棵树**的 JSON：按节点、可能按 deal（发牌）分，每个节点里有 `actions` 数组和 `strategy`。  
`strategy` 里通常是「该节点上、每个信息集或每手牌」的策略数组（具体键名要看他们代码里 `reConvertJson` / `dump_strategy` 的写法）。

你要写的解析逻辑只需要：

1. 根据「当前是哪个节点」定位到 JSON 里对应那一块（例如用 `node_code` 或 动作序列 + board + street）。
2. 从那一块里读出「手牌 → 动作概率」，映射成你前端的 169 手牌和三个动作（Jam/Call/Fold）。
3. 手牌在 TexasSolver 里一般是 13×13 的索引或 rank 字符串（如 "A7s"），需要和你前端的 `buildHandLabel` 顺序一致，做一一映射。

具体 JSON 结构建议你：用 TexasSolver 算一局，导出一份 JSON，打开看一层结构，再写一个最小的 `parseTexasSolverJson.ts`，只解析**一个节点**、输出成 `NodeStrategyMatrix`，再接到 `StudySpotBrowser` 试一条 spot。

---

## 四、总结：你要填的清单

| 要做的事 | 在哪里填 | 说明 |
|----------|----------|------|
| 定好「节点策略」的数据结构 | `studySpots.ts` 或 `@poker-god/contracts` | 如 `HandStrategy`、`NodeStrategyMatrix`，方便 API 和前端统一 |
| 解析 TexasSolver 导出的 JSON | 新文件，例如 `lib/parseTexasSolverJson.ts` 或后端脚本 | 输入：dump 的 JSON；输出：`NodeStrategyMatrix` 或按 node_code 分组的多个节点 |
| 把解析结果「挂」到节点上 | 二选一：后端 API 返回 / 前端静态 JSON + 按 node_code 匹配 | 让 `StudySpotBrowser` 能拿到 `strategy_matrix` |
| 用 solver 结果驱动矩阵 | `StudySpotBrowser.tsx` 里 `matrixCells` 的 useMemo | 有 `strategy_matrix` 就用它算每格的 raisePct/allinPct/foldPct；没有就保留现有桶逻辑 |
| （可选）总览数字也从 169 手加总 | 同上或右侧面板 | 和 `action_mix` 二选一或互为校验 |

按上面顺序做，你就知道「代码该怎么填」：**先打通「TexasSolver JSON → 解析 → 前端矩阵」这一条线，再考虑更多节点、在线求解和 API。**  
这样和「他的东西」的差距，就主要是**数据来源和每手牌混合策略**这两点，UI 不用大改。
