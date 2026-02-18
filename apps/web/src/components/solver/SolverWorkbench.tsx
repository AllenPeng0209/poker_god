'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import styles from './SolverWorkbench.module.css';

type SolverStreet = 'preflop' | 'flop' | 'turn' | 'river';
type DeckMode = 'holdem' | 'shortdeck';
type SolverAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
type SuitCode = 's' | 'h' | 'd' | 'c';

type SeatPlayer = {
  id: string;
  label: string;
};

type ActionEntry = {
  id: number;
  street: SolverStreet;
  playerId: string;
  playerLabel: string;
  action: SolverAction;
};

type BuilderState = {
  streetIndex: number;
  board: string[];
  activePlayerIds: string[];
  actedThisStreet: string[];
  selectedActorId: string | null;
  actions: ActionEntry[];
  handEnded: boolean;
};

type BoardPickerState = {
  street: Exclude<SolverStreet, 'preflop'>;
  required: number;
  selected: string[];
};

type SuitMeta = {
  code: SuitCode;
  icon: string;
  rowLabel: string;
};

const STREET_ORDER: SolverStreet[] = ['preflop', 'flop', 'turn', 'river'];
const HOLDEM_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SHORTDECK_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6'] as const;

const SUITS: SuitMeta[] = [
  { code: 's', icon: '♠', rowLabel: 'Spades' },
  { code: 'h', icon: '♥', rowLabel: 'Hearts' },
  { code: 'd', icon: '♦', rowLabel: 'Diamonds' },
  { code: 'c', icon: '♣', rowLabel: 'Clubs' },
];

const ACTION_BUTTONS: Array<{ id: SolverAction; label: string; tone: 'muted' | 'safe' | 'warn' | 'hot' }> = [
  { id: 'fold', label: 'FOLD', tone: 'muted' },
  { id: 'check', label: 'CHECK', tone: 'safe' },
  { id: 'call', label: 'CALL', tone: 'safe' },
  { id: 'bet', label: 'BET', tone: 'warn' },
  { id: 'raise', label: 'RAISE', tone: 'hot' },
  { id: 'allin', label: 'ALL-IN', tone: 'hot' },
];

const PLAYER_LIMITS = [2, 3, 4, 5, 6] as const;

const TABLE_LAYOUT: Record<number, Array<{ x: number; y: number }>> = {
  2: [
    { x: 22, y: 50 },
    { x: 78, y: 50 },
  ],
  3: [
    { x: 50, y: 16 },
    { x: 22, y: 74 },
    { x: 78, y: 74 },
  ],
  4: [
    { x: 50, y: 12 },
    { x: 18, y: 50 },
    { x: 50, y: 88 },
    { x: 82, y: 50 },
  ],
  5: [
    { x: 50, y: 8 },
    { x: 18, y: 28 },
    { x: 18, y: 72 },
    { x: 82, y: 72 },
    { x: 82, y: 28 },
  ],
  6: [
    { x: 50, y: 8 },
    { x: 18, y: 24 },
    { x: 18, y: 76 },
    { x: 50, y: 92 },
    { x: 82, y: 76 },
    { x: 82, y: 24 },
  ],
};

function streetName(street: SolverStreet): string {
  if (street === 'preflop') return 'Preflop';
  if (street === 'flop') return 'Flop';
  if (street === 'turn') return 'Turn';
  return 'River';
}

function actionName(action: SolverAction): string {
  if (action === 'allin') return 'ALL-IN';
  return action.toUpperCase();
}

function suitSymbol(suit: SuitCode): string {
  if (suit === 's') return '♠';
  if (suit === 'h') return '♥';
  if (suit === 'd') return '♦';
  return '♣';
}

function formatCard(code: string): string {
  const rank = code.slice(0, -1);
  const suit = code.slice(-1) as SuitCode;
  return `${rank}${suitSymbol(suit)}`;
}

function cloneBuilder(state: BuilderState): BuilderState {
  return {
    streetIndex: state.streetIndex,
    board: [...state.board],
    activePlayerIds: [...state.activePlayerIds],
    actedThisStreet: [...state.actedThisStreet],
    selectedActorId: state.selectedActorId,
    actions: state.actions.map((entry) => ({ ...entry })),
    handEnded: state.handEnded,
  };
}

function buildSeatLabels(count: number): string[] {
  if (count === 2) return ['SB', 'BB'];
  if (count === 3) return ['BTN', 'SB', 'BB'];
  if (count === 4) return ['CO', 'BTN', 'SB', 'BB'];
  if (count === 5) return ['HJ', 'CO', 'BTN', 'SB', 'BB'];
  return ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
}

function buildPlayers(count: number): SeatPlayer[] {
  return buildSeatLabels(count).map((label, index) => ({
    id: `p${index + 1}`,
    label,
  }));
}

function buildInitialState(players: SeatPlayer[]): BuilderState {
  const activePlayerIds = players.map((player) => player.id);
  return {
    streetIndex: 0,
    board: [],
    activePlayerIds,
    actedThisStreet: [],
    selectedActorId: activePlayerIds[0] ?? null,
    actions: [],
    handEnded: activePlayerIds.length <= 1,
  };
}

function nextActorId(activePlayerIds: string[], actedThisStreet: string[]): string | null {
  const next = activePlayerIds.find((playerId) => !actedThisStreet.includes(playerId));
  return next ?? null;
}

function sampleCards(cards: string[], count: number): string[] {
  const pool = [...cards];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  return pool.slice(0, count);
}

export function SolverWorkbench() {
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [deckMode, setDeckMode] = useState<DeckMode>('holdem');
  const [state, setState] = useState<BuilderState>(() => buildInitialState(buildPlayers(2)));
  const [snapshots, setSnapshots] = useState<BuilderState[]>([]);
  const [picker, setPicker] = useState<BoardPickerState | null>(null);

  const players = useMemo(() => buildPlayers(playerCount), [playerCount]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const ranks = deckMode === 'holdem' ? HOLDEM_RANKS : SHORTDECK_RANKS;
  const allCards = useMemo(
    () => SUITS.flatMap((suit) => ranks.map((rank) => `${rank}${suit.code}`)),
    [ranks],
  );

  const currentStreet = STREET_ORDER[state.streetIndex] ?? 'river';
  const availableActorIds = state.activePlayerIds.filter((id) => !state.actedThisStreet.includes(id));
  const selectedActorId =
    state.selectedActorId && availableActorIds.includes(state.selectedActorId)
      ? state.selectedActorId
      : availableActorIds[0] ?? null;

  const selectedActor = selectedActorId ? playerById.get(selectedActorId) ?? null : null;

  const boardByStreet = {
    flop: state.board.slice(0, 3),
    turn: state.board.slice(3, 4),
    river: state.board.slice(4, 5),
  };

  const lineByStreet = useMemo(
    () =>
      STREET_ORDER.map((street) => ({
        street,
        actions: state.actions.filter((entry) => entry.street === street),
      })),
    [state.actions],
  );

  const exportPreview = useMemo(() => {
    const blocks = STREET_ORDER.map((street) => {
      const actions = state.actions
        .filter((entry) => entry.street === street)
        .map((entry) => `${entry.playerLabel}:${actionName(entry.action)}`)
        .join(' > ');
      return `${street}=${actions || '-'}`;
    });
    return [`board=${state.board.join(',') || '-'}`, ...blocks].join('\n');
  }, [state.actions, state.board]);

  function resetBuilder(nextPlayerCount?: number) {
    const count = nextPlayerCount ?? playerCount;
    const nextPlayers = buildPlayers(count);
    setState(buildInitialState(nextPlayers));
    setSnapshots([]);
    setPicker(null);
  }

  function pushSnapshot() {
    setSnapshots((prev) => [...prev, cloneBuilder(state)].slice(-80));
  }

  function handleDeckModeChange(mode: DeckMode) {
    setDeckMode(mode);
    resetBuilder();
  }

  function handlePlayerCountChange(value: number) {
    setPlayerCount(value);
    resetBuilder(value);
  }

  function openBoardPicker() {
    const nextStreet = STREET_ORDER[state.streetIndex + 1];
    if (!nextStreet || nextStreet === 'preflop') {
      return;
    }
    setPicker({
      street: nextStreet,
      required: nextStreet === 'flop' ? 3 : 1,
      selected: [],
    });
  }

  function handlePickAction(action: SolverAction) {
    if (picker || state.handEnded || !selectedActorId) {
      return;
    }

    const actor = playerById.get(selectedActorId);
    if (!actor) {
      return;
    }

    const next = cloneBuilder(state);
    next.actions.push({
      id: next.actions.length + 1,
      street: currentStreet,
      playerId: actor.id,
      playerLabel: actor.label,
      action,
    });

    if (!next.actedThisStreet.includes(actor.id)) {
      next.actedThisStreet.push(actor.id);
    }

    if (action === 'fold') {
      next.activePlayerIds = next.activePlayerIds.filter((id) => id !== actor.id);
    }

    if (next.activePlayerIds.length <= 1) {
      next.handEnded = true;
      next.selectedActorId = null;
      pushSnapshot();
      setState(next);
      return;
    }

    const allActed = next.activePlayerIds.every((id) => next.actedThisStreet.includes(id));

    if (allActed) {
      if (currentStreet === 'river') {
        next.handEnded = true;
        next.selectedActorId = null;
        pushSnapshot();
        setState(next);
        return;
      }

      next.selectedActorId = next.activePlayerIds[0] ?? null;
      pushSnapshot();
      setState(next);
      openBoardPicker();
      return;
    }

    next.selectedActorId = nextActorId(next.activePlayerIds, next.actedThisStreet);
    pushSnapshot();
    setState(next);
  }

  function handleUndo() {
    if (snapshots.length === 0) {
      return;
    }
    const previous = snapshots[snapshots.length - 1];
    setSnapshots((prev) => prev.slice(0, -1));
    setState(cloneBuilder(previous));
    setPicker(null);
  }

  function handleSelectActor(playerId: string) {
    if (picker || state.handEnded) {
      return;
    }
    if (!availableActorIds.includes(playerId)) {
      return;
    }
    setState((prev) => ({ ...prev, selectedActorId: playerId }));
  }

  function handlePickCard(code: string) {
    if (!picker) {
      return;
    }
    if (state.board.includes(code) && !picker.selected.includes(code)) {
      return;
    }

    setPicker((prev) => {
      if (!prev) return prev;
      if (prev.selected.includes(code)) {
        return { ...prev, selected: prev.selected.filter((card) => card !== code) };
      }
      if (prev.selected.length >= prev.required) {
        return prev;
      }
      return { ...prev, selected: [...prev.selected, code] };
    });
  }

  function handleAutoPickCards() {
    if (!picker) {
      return;
    }
    const blocked = new Set(state.board);
    const available = allCards.filter((code) => !blocked.has(code));
    const sampled = sampleCards(available, picker.required);
    setPicker((prev) => (prev ? { ...prev, selected: sampled } : prev));
  }

  function handleConfirmBoard() {
    if (!picker || picker.selected.length !== picker.required) {
      return;
    }

    const next = cloneBuilder(state);
    next.board = [...next.board, ...picker.selected];
    const nextStreetIndex = STREET_ORDER.indexOf(picker.street);
    if (nextStreetIndex >= 0) {
      next.streetIndex = nextStreetIndex;
    }
    next.actedThisStreet = [];
    next.selectedActorId = next.activePlayerIds[0] ?? null;
    next.handEnded = next.activePlayerIds.length <= 1;

    pushSnapshot();
    setState(next);
    setPicker(null);
  }

  const pickerBlocked = new Set(state.board);
  const rankGridStyle = { '--rank-count': String(ranks.length) } as CSSProperties;

  return (
    <section className={styles.solverRoot} aria-labelledby="solver-lab-title">
      <header className={styles.solverHeader}>
        <div>
          <p className={styles.eyebrow}>Solver Lab</p>
          <h1 id="solver-lab-title">Action-Line Builder</h1>
          <p className={styles.lead}>
            桌面版 TexasSolver 本身是手动选 board。这里按你的要求改成 Web 自动流程：每个街道所有玩家选完动作后，自动进入选牌。
          </p>
        </div>
        <div className={styles.headerStats}>
          <span>Street: {streetName(currentStreet)}</span>
          <span>Alive: {state.activePlayerIds.length}</span>
          <span>Board: {state.board.length}/5</span>
        </div>
      </header>

      <div className={styles.workspaceGrid}>
        <aside className={styles.configPanel}>
          <h2>配置</h2>

          <label className={styles.fieldLabel}>
            游戏模式
            <select value={deckMode} onChange={(event) => handleDeckModeChange(event.target.value as DeckMode)}>
              <option value="holdem">Hold'em</option>
              <option value="shortdeck">Short Deck</option>
            </select>
          </label>

          <label className={styles.fieldLabel}>
            玩家数量
            <select value={playerCount} onChange={(event) => handlePlayerCountChange(Number(event.target.value))}>
              {PLAYER_LIMITS.map((count) => (
                <option key={count} value={count}>
                  {count} 人
                </option>
              ))}
            </select>
          </label>

          <div className={styles.boardStack}>
            <h3>公共牌</h3>
            <div className={styles.boardRows}>
              <div>
                <span>Flop</span>
                <div className={styles.boardPills}>
                  {boardByStreet.flop.length === 0 ? <em>-</em> : boardByStreet.flop.map((code) => <b key={code}>{formatCard(code)}</b>)}
                </div>
              </div>
              <div>
                <span>Turn</span>
                <div className={styles.boardPills}>
                  {boardByStreet.turn.length === 0 ? <em>-</em> : boardByStreet.turn.map((code) => <b key={code}>{formatCard(code)}</b>)}
                </div>
              </div>
              <div>
                <span>River</span>
                <div className={styles.boardPills}>
                  {boardByStreet.river.length === 0 ? <em>-</em> : boardByStreet.river.map((code) => <b key={code}>{formatCard(code)}</b>)}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.controlRow}>
            <button type="button" onClick={() => resetBuilder()}>
              重置
            </button>
            <button type="button" onClick={handleUndo} disabled={snapshots.length === 0 || picker !== null}>
              撤销一步
            </button>
          </div>

          <div className={styles.previewPanel}>
            <h3>导出预览</h3>
            <pre>{exportPreview}</pre>
          </div>
        </aside>

        <section className={styles.tablePanel} aria-label="table-workspace">
          <div className={styles.streetStepper}>
            {STREET_ORDER.map((street, index) => {
              const isActive = index === state.streetIndex;
              const isDone = index < state.streetIndex;
              return (
                <div
                  key={street}
                  className={`${styles.streetChip} ${isActive ? styles.streetChipActive : ''} ${isDone ? styles.streetChipDone : ''}`.trim()}
                >
                  {streetName(street)}
                </div>
              );
            })}
          </div>

          <div className={styles.tableArena}>
            <div className={styles.tableCore}>
              <p>{streetName(currentStreet)}</p>
              <strong>{state.handEnded ? 'Action Closed' : selectedActor ? `${selectedActor.label} 行动中` : '等待下一步'}</strong>
            </div>

            {(TABLE_LAYOUT[playerCount] ?? TABLE_LAYOUT[2]).map((point, index) => {
              const player = players[index];
              if (!player) return null;

              const isAlive = state.activePlayerIds.includes(player.id);
              const hasActed = state.actedThisStreet.includes(player.id);
              const isSelected = selectedActorId === player.id;
              const canSelect = availableActorIds.includes(player.id);

              return (
                <button
                  key={player.id}
                  type="button"
                  className={`${styles.seatToken} ${isAlive ? '' : styles.seatTokenFolded} ${hasActed ? styles.seatTokenActed : ''} ${isSelected ? styles.seatTokenSelected : ''}`.trim()}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => handleSelectActor(player.id)}
                  disabled={!canSelect || state.handEnded || picker !== null}
                >
                  <span>{player.label}</span>
                  <small>{isAlive ? (hasActed ? '已行动' : '可行动') : '已弃牌'}</small>
                </button>
              );
            })}
          </div>

          <div className={styles.actionDock}>
            <p>
              {state.handEnded
                ? '该条行动线已结束。'
                : selectedActor
                  ? `当前选择：${selectedActor.label} · ${streetName(currentStreet)}`
                  : '当前街道没有可行动玩家'}
            </p>
            <div className={styles.actionButtons}>
              {ACTION_BUTTONS.map((button) => (
                <button
                  key={button.id}
                  type="button"
                  className={`${styles.actionButton} ${styles[`actionTone${button.tone}`]}`}
                  disabled={state.handEnded || picker !== null || !selectedActor}
                  onClick={() => handlePickAction(button.id)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className={styles.linePanel}>
          <h2>行动线</h2>

          <div className={styles.streetLogs}>
            {lineByStreet.map((block) => (
              <section key={block.street}>
                <header>
                  <strong>{streetName(block.street)}</strong>
                </header>
                {block.actions.length === 0 ? (
                  <p className={styles.emptyLog}>-</p>
                ) : (
                  <ul>
                    {block.actions.map((entry) => (
                      <li key={entry.id}>
                        <span>{entry.playerLabel}</span>
                        <b>{actionName(entry.action)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </aside>
      </div>

      {picker ? (
        <div className={styles.pickerOverlay} role="dialog" aria-modal="true" aria-label="board-picker">
          <div className={styles.pickerDialog}>
            <header className={styles.pickerHeader}>
              <div>
                <p>CHOOSE BOARD</p>
                <h3>
                  {picker.street.toUpperCase()} · 需要 {picker.required} 张
                </h3>
              </div>
              <button type="button" className={styles.pickerClose} onClick={() => setPicker(null)}>
                ×
              </button>
            </header>

            <div className={styles.pickerTabs}>
              <span className={picker.street === 'flop' ? styles.pickerTabActive : styles.pickerTab}>FLOPS</span>
              <span className={picker.street === 'turn' ? styles.pickerTabActive : styles.pickerTab}>TURNS</span>
              <span className={picker.street === 'river' ? styles.pickerTabActive : styles.pickerTab}>RIVERS</span>
            </div>

            <div className={styles.selectedTray}>
              {picker.selected.length === 0 ? <em>未选择</em> : picker.selected.map((card) => <b key={card}>{formatCard(card)}</b>)}
            </div>

            <div className={styles.rankHeader} style={rankGridStyle}>
              <span />
              {ranks.map((rank) => (
                <strong key={rank}>{rank}</strong>
              ))}
            </div>

            <div className={styles.pickerGrid}>
              {SUITS.map((suit) => (
                <div key={suit.code} className={styles.suitRow} style={rankGridStyle}>
                  <span className={styles.suitBadge}>{suit.icon}</span>
                  {ranks.map((rank) => {
                    const code = `${rank}${suit.code}`;
                    const locked = pickerBlocked.has(code) && !picker.selected.includes(code);
                    const selected = picker.selected.includes(code);
                    const noRoom = !selected && picker.selected.length >= picker.required;
                    return (
                      <button
                        key={code}
                        type="button"
                        className={`${styles.cardCell} ${styles[`suit${suit.code}`]} ${selected ? styles.cardCellSelected : ''}`.trim()}
                        disabled={locked || noRoom}
                        onClick={() => handlePickCard(code)}
                        title={`${rank}${suit.icon} · ${suit.rowLabel}`}
                      >
                        {rank}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <footer className={styles.pickerFooter}>
              <button type="button" onClick={handleAutoPickCards}>
                RANDOM
              </button>
              <button type="button" onClick={() => setPicker((prev) => (prev ? { ...prev, selected: [] } : prev))}>
                CLEAR ALL
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                disabled={picker.selected.length !== picker.required}
                onClick={handleConfirmBoard}
              >
                CONFIRM
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
