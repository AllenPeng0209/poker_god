'use client';

import { useMemo, useState } from 'react';
import styles from './AnalyzeWorkbench.module.css';

type AnalyzeView = 'hands' | 'stats';
type GtoResult = 'good' | 'neutral' | 'bad';
type RowStatus = 'ok' | 'warn';

type AnalyzeRow = {
  id: string;
  status: RowStatus;
  date: string;
  format: string;
  site: string;
  position: 'SB' | 'BB';
  hand: [string, string];
  board: string[];
  potType: string;
  preflop: string;
  flop: string;
  turn: string;
  river: string;
  potBb: number;
  winLossBb: number;
  evLossBb: number;
  evLossPct: number;
  gtoResult: GtoResult;
  gtoScore: number;
  frequencyDiff: number;
  stakes: string;
  rake: string;
  source: string;
  nickname: string;
  fileName: string;
  effectiveStack: number;
  players: number;
};

type ScoreLine = {
  label: string;
  value: number;
  tone: 'mint' | 'yellow' | 'red';
};

const FILTER_CHIPS = [
  '街道动作',
  '手牌细节',
  '统计与结果',
  '底牌',
  '游戏类型',
  '其他',
] as const;

const ANALYZE_ROWS: AnalyzeRow[] = [
  {
    id: 'h1',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'BB',
    hand: ['A', '4'],
    board: [],
    potType: 'Preflop',
    preflop: 'R F',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 3,
    winLossBb: -1,
    evLossBb: 1.35,
    evLossPct: 22.5,
    gtoResult: 'bad',
    gtoScore: -100,
    frequencyDiff: 100,
    stakes: '20/40',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_01',
    effectiveStack: 5.13,
    players: 2,
  },
  {
    id: 'h2',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'SB',
    hand: ['4', '3'],
    board: [],
    potType: 'Preflop',
    preflop: 'F',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 1.5,
    winLossBb: -0.5,
    evLossBb: 0,
    evLossPct: 0,
    gtoResult: 'good',
    gtoScore: 100,
    frequencyDiff: 0,
    stakes: '15/30',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_01',
    effectiveStack: 7.5,
    players: 2,
  },
  {
    id: 'h3',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'BB',
    hand: ['Q', 'J'],
    board: [],
    potType: 'Preflop',
    preflop: '-',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 1.5,
    winLossBb: 0.5,
    evLossBb: 0,
    evLossPct: 0,
    gtoResult: 'neutral',
    gtoScore: 0,
    frequencyDiff: 0,
    stakes: '15/30',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_01',
    effectiveStack: 6.83,
    players: 2,
  },
  {
    id: 'h4',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'SB',
    hand: ['4', '2'],
    board: [],
    potType: 'Preflop',
    preflop: 'F',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 1.5,
    winLossBb: -0.5,
    evLossBb: 0,
    evLossPct: 0,
    gtoResult: 'good',
    gtoScore: 100,
    frequencyDiff: 0,
    stakes: '15/30',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_01',
    effectiveStack: 7.5,
    players: 2,
  },
  {
    id: 'h5',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'BB',
    hand: ['A', '8'],
    board: ['Q', 'T', '9', '4', '2'],
    potType: 'Preflop',
    preflop: 'R R C',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 40.67,
    winLossBb: -20.33,
    evLossBb: 0,
    evLossPct: 0,
    gtoResult: 'good',
    gtoScore: 100,
    frequencyDiff: 0,
    stakes: '15/30',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_01',
    effectiveStack: 13,
    players: 2,
  },
  {
    id: 'h6',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'SB',
    hand: ['A', '5'],
    board: [],
    potType: 'Preflop',
    preflop: 'R F',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 30.5,
    winLossBb: 1,
    evLossBb: 0.15,
    evLossPct: 9.9,
    gtoResult: 'bad',
    gtoScore: -100,
    frequencyDiff: 93.3,
    stakes: '10/20',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_02',
    effectiveStack: 21,
    players: 2,
  },
  {
    id: 'h7',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'BB',
    hand: ['7', '5'],
    board: [],
    potType: 'Preflop',
    preflop: '-',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 1.5,
    winLossBb: 0.5,
    evLossBb: 0,
    evLossPct: 0,
    gtoResult: 'neutral',
    gtoScore: 0,
    frequencyDiff: 0,
    stakes: '10/20',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_02',
    effectiveStack: 21,
    players: 2,
  },
  {
    id: 'h8',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'SB',
    hand: ['8', '7'],
    board: [],
    potType: 'Preflop',
    preflop: 'R F',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 29,
    winLossBb: 1,
    evLossBb: 0.61,
    evLossPct: 40.4,
    gtoResult: 'bad',
    gtoScore: -100,
    frequencyDiff: 63.1,
    stakes: '10/20',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_02',
    effectiveStack: 22,
    players: 2,
  },
  {
    id: 'h9',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'BB',
    hand: ['T', '6'],
    board: [],
    potType: 'Preflop',
    preflop: 'R R F',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 28,
    winLossBb: 3,
    evLossBb: 0.06,
    evLossPct: 2.1,
    gtoResult: 'bad',
    gtoScore: -43,
    frequencyDiff: 100,
    stakes: '10/20',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_02',
    effectiveStack: 25,
    players: 2,
  },
  {
    id: 'h10',
    status: 'warn',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'BB',
    hand: ['T', '5'],
    board: ['Q', 'T', '8', '3', '8'],
    potType: 'SRP',
    preflop: 'R C',
    flop: 'B R R',
    turn: '-',
    river: '-',
    potBb: 50,
    winLossBb: -25,
    evLossBb: 0,
    evLossPct: 0.1,
    gtoResult: 'neutral',
    gtoScore: -5,
    frequencyDiff: 50,
    stakes: '10/20',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_03',
    effectiveStack: 25,
    players: 2,
  },
  {
    id: 'h11',
    status: 'warn',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'SB',
    hand: ['Q', '3'],
    board: ['8', '6', '3', '7', '5'],
    potType: 'Limp',
    preflop: 'C X',
    flop: 'B R C',
    turn: 'X B C',
    river: 'B R R C',
    potBb: 50,
    winLossBb: -25,
    evLossBb: 0.09,
    evLossPct: 1.2,
    gtoResult: 'neutral',
    gtoScore: 25.6,
    frequencyDiff: 44.4,
    stakes: '10/20',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_03',
    effectiveStack: 25,
    players: 2,
  },
  {
    id: 'h12',
    status: 'ok',
    date: '2/13/2026',
    format: 'HU SNG',
    site: '竞技',
    position: 'SB',
    hand: ['K', '7'],
    board: [],
    potType: 'Preflop',
    preflop: 'F',
    flop: '-',
    turn: '-',
    river: '-',
    potBb: 1.5,
    winLossBb: -0.5,
    evLossBb: 0.34,
    evLossPct: 22.6,
    gtoResult: 'bad',
    gtoScore: -100,
    frequencyDiff: 100,
    stakes: '10/20',
    rake: '-',
    source: 'PokerArena',
    nickname: 'allen',
    fileName: 'session_hu_03',
    effectiveStack: 17,
    players: 2,
  },
];

const SCORE_BREAKDOWN: ScoreLine[] = [
  { label: '完美', value: 4, tone: 'mint' },
  { label: '良好', value: 0, tone: 'mint' },
  { label: '不准确', value: 1, tone: 'yellow' },
  { label: '错误', value: 3, tone: 'red' },
  { label: '严重错误', value: 6, tone: 'red' },
];

function cardTone(card: string): 'green' | 'red' | 'blue' | 'gray' {
  if (['A', 'K', 'Q', 'J'].includes(card)) return 'green';
  if (['T', '9', '8'].includes(card)) return 'red';
  if (['7', '6', '5', '4', '3', '2'].includes(card)) return 'blue';
  return 'gray';
}

function formatSigned(value: number, digits = 2): string {
  if (value === 0) return '0';
  const fixed = Number(value.toFixed(digits));
  return fixed > 0 ? `+${fixed}` : `${fixed}`;
}

function sumBy(rows: AnalyzeRow[], selector: (row: AnalyzeRow) => number): number {
  return rows.reduce((acc, row) => acc + selector(row), 0);
}

function scoreClassName(value: number): string {
  if (value > 0) return styles.numGood;
  if (value < 0) return styles.numBad;
  return styles.numNeutral;
}

function ResultBadge({ result }: { result: GtoResult }) {
  if (result === 'good') {
    return <span className={`${styles.resultDot} ${styles.resultGood}`}>✓</span>;
  }
  if (result === 'neutral') {
    return <span className={`${styles.resultDot} ${styles.resultNeutral}`}>◌</span>;
  }
  return <span className={`${styles.resultDot} ${styles.resultBad}`}>!</span>;
}

function StatusBadge({ status }: { status: RowStatus }) {
  return (
    <span className={status === 'ok' ? `${styles.statusBadge} ${styles.statusOk}` : `${styles.statusBadge} ${styles.statusWarn}`}>
      {status === 'ok' ? '✓' : '0×'}
    </span>
  );
}

function CardPill({ card }: { card: string }) {
  return <span className={`${styles.cardPill} ${styles[`card${cardTone(card)}`]}`}>{card}</span>;
}

export function AnalyzeWorkbench() {
  const [view, setView] = useState<AnalyzeView>('hands');
  const [activeFilter, setActiveFilter] = useState<string>('街道动作');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(ANALYZE_ROWS.map((row) => row.id)));
  const [activeRowId, setActiveRowId] = useState<string>(ANALYZE_ROWS[0]?.id ?? '');
  const [detailOpen, setDetailOpen] = useState(true);

  const activeRow = useMemo(
    () => ANALYZE_ROWS.find((row) => row.id === activeRowId) ?? ANALYZE_ROWS[0],
    [activeRowId],
  );

  const allSelected = selectedIds.size === ANALYZE_ROWS.length;
  const selectedRows = useMemo(
    () => ANALYZE_ROWS.filter((row) => selectedIds.has(row.id)),
    [selectedIds],
  );

  const footerMetrics = useMemo(
    () => ({
      pot: sumBy(ANALYZE_ROWS, (row) => row.potBb),
      winLoss: sumBy(ANALYZE_ROWS, (row) => row.winLossBb),
      evLoss: sumBy(ANALYZE_ROWS, (row) => row.evLossBb),
      avgEvLossPct: ANALYZE_ROWS.length === 0 ? 0 : sumBy(ANALYZE_ROWS, (row) => row.evLossPct) / ANALYZE_ROWS.length,
      gtoScore: ANALYZE_ROWS.length === 0 ? 0 : sumBy(ANALYZE_ROWS, (row) => row.gtoScore) / ANALYZE_ROWS.length,
      freqDiff: ANALYZE_ROWS.length === 0 ? 0 : sumBy(ANALYZE_ROWS, (row) => row.frequencyDiff) / ANALYZE_ROWS.length,
    }),
    [],
  );

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (prev.size === ANALYZE_ROWS.length) {
        return new Set<string>();
      }
      return new Set(ANALYZE_ROWS.map((row) => row.id));
    });
  }

  return (
    <section className={styles.analyzeRoot} aria-label="分析工作台">
      <aside className={styles.leftRail}>
        <button
          type="button"
          className={view === 'hands' ? `${styles.railBtn} ${styles.railBtnActive}` : styles.railBtn}
          onClick={() => setView('hands')}
        >
          <span className={styles.railIcon}>⌗</span>
          <span>手牌</span>
        </button>
        <button
          type="button"
          className={view === 'stats' ? `${styles.railBtn} ${styles.railBtnActive}` : styles.railBtn}
          onClick={() => setView('stats')}
        >
          <span className={styles.railIcon}>◔</span>
          <span>统计</span>
        </button>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topHeader}>
          <div className={styles.headerTitleBlock}>
            <h1>{view === 'hands' ? '手牌' : '统计'}</h1>
            <div className={styles.headerActions}>
              <button type="button" className={`${styles.headPill} ${styles.headPillActive}`}>全部报告</button>
              <button type="button" className={styles.headPill}>新建报告</button>
              <button type="button" className={styles.headPillMuted}>保存报告</button>
            </div>
          </div>

          <div className={styles.dateRangeWrap}>
            <button type="button" className={styles.dateInput}>起始日期</button>
            <button type="button" className={styles.dateInput}>结束日期</button>
          </div>
        </header>

        <div className={styles.filterBar}>
          <span className={styles.filterLabel}>筛选</span>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={activeFilter === chip ? `${styles.filterChip} ${styles.filterChipActive}` : styles.filterChip}
              onClick={() => setActiveFilter(chip)}
            >
              {chip}
            </button>
          ))}
          <button type="button" className={styles.filterIconBtn} aria-label="搜索">⌕</button>
        </div>

        {view === 'hands' ? (
          <div className={detailOpen ? styles.handsLayout : `${styles.handsLayout} ${styles.handsLayoutWide}`}>
            <div className={styles.handsTableWrap}>
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                      </th>
                      <th>标记</th>
                      <th>状态</th>
                      <th>日期</th>
                      <th>格式</th>
                      <th>站点</th>
                      <th>位置</th>
                      <th>手牌</th>
                      <th>公共牌</th>
                      <th>底池类型</th>
                      <th>翻前</th>
                      <th>翻牌</th>
                      <th>转牌</th>
                      <th>河牌</th>
                      <th>底池(bb)</th>
                      <th>盈亏(bb)</th>
                      <th>EV 损失(bb)</th>
                      <th>EV 损失%</th>
                      <th>GTO 结果</th>
                      <th>GTO 分数%</th>
                      <th>频率偏差%</th>
                      <th>盲注</th>
                      <th>抽水</th>
                      <th>来源</th>
                      <th>昵称</th>
                      <th>文件名</th>
                      <th>有效筹码</th>
                      <th>人数</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ANALYZE_ROWS.map((row) => {
                      const rowSelected = selectedIds.has(row.id);
                      const rowActive = row.id === activeRowId;
                      return (
                        <tr
                          key={row.id}
                          className={rowActive ? `${styles.bodyRow} ${styles.bodyRowActive}` : styles.bodyRow}
                          onClick={() => {
                            setActiveRowId(row.id);
                            setDetailOpen(true);
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={rowSelected}
                              onChange={(event) => {
                                event.stopPropagation();
                                toggleRow(row.id);
                              }}
                            />
                          </td>
                          <td><span className={styles.tagDot} /></td>
                          <td><StatusBadge status={row.status} /></td>
                          <td>{row.date}</td>
                          <td>{row.format}</td>
                          <td>{row.site}</td>
                          <td>{row.position}</td>
                          <td>
                            <div className={styles.cardsInline}>
                              <CardPill card={row.hand[0]} />
                              <CardPill card={row.hand[1]} />
                            </div>
                          </td>
                          <td>
                            <div className={styles.cardsInline}>
                              {row.board.length === 0 ? <span className={styles.dimText}>-</span> : row.board.map((card, idx) => <CardPill key={`${row.id}-board-${idx}`} card={card} />)}
                            </div>
                          </td>
                          <td>{row.potType}</td>
                          <td>{row.preflop}</td>
                          <td>{row.flop}</td>
                          <td>{row.turn}</td>
                          <td>{row.river}</td>
                          <td>{row.potBb}</td>
                          <td className={scoreClassName(row.winLossBb)}>{formatSigned(row.winLossBb)}</td>
                          <td className={scoreClassName(-row.evLossBb)}>{row.evLossBb.toFixed(2)}</td>
                          <td className={scoreClassName(-row.evLossPct)}>{row.evLossPct.toFixed(1)}</td>
                          <td><ResultBadge result={row.gtoResult} /></td>
                          <td className={scoreClassName(row.gtoScore)}>{row.gtoScore}</td>
                          <td className={scoreClassName(-row.frequencyDiff)}>{row.frequencyDiff.toFixed(1)}</td>
                          <td>{row.stakes}</td>
                          <td>{row.rake}</td>
                          <td>{row.source}</td>
                          <td>{row.nickname}</td>
                          <td>{row.fileName}</td>
                          <td>{row.effectiveStack}</td>
                          <td>{row.players}</td>
                          <td>
                            <div className={rowActive ? `${styles.rowActions} ${styles.rowActionsVisible}` : styles.rowActions}>
                              <button type="button" aria-label="跳转学习">🎓</button>
                              <button type="button" aria-label="跳转练习">🎮</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={14} className={styles.footerLabel}>合计 {ANALYZE_ROWS.length} 手牌</td>
                      <td>{footerMetrics.pot.toFixed(2)}</td>
                      <td className={scoreClassName(footerMetrics.winLoss)}>{formatSigned(footerMetrics.winLoss)}</td>
                      <td>{footerMetrics.evLoss.toFixed(2)}</td>
                      <td>{footerMetrics.avgEvLossPct.toFixed(1)}</td>
                      <td>-</td>
                      <td className={scoreClassName(footerMetrics.gtoScore)}>{footerMetrics.gtoScore.toFixed(1)}</td>
                      <td>{footerMetrics.freqDiff.toFixed(1)}</td>
                      <td colSpan={8} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className={styles.selectionBar}>
                <strong>{selectedRows.length} 手牌已选</strong>
                <button type="button" className={styles.selectionAction}>删除所选</button>
                <button type="button" className={styles.selectionAction}>清除选择</button>
                <button type="button" className={styles.selectionActionPrimary}>添加备注</button>
              </div>
            </div>

            {detailOpen && activeRow ? (
              <aside className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <div>
                    <p className={styles.detailHint}>牌局详情</p>
                    <strong>{activeRow.stakes}（{activeRow.format}）</strong>
                    <p className={styles.detailHint}>{activeRow.players} 人桌，{activeRow.effectiveStack}bb 有效筹码</p>
                  </div>
                  <button type="button" className={styles.closeBtn} onClick={() => setDetailOpen(false)}>
                    ×
                  </button>
                </div>

                <div className={styles.detailStacks}>
                  <div>
                    <span>SB</span>
                    <strong>19.88 BB</strong>
                  </div>
                  <div>
                    <span>BB</span>
                    <strong>5.13 BB</strong>
                  </div>
                </div>

                <div className={styles.detailCards}>
                  <h4>英雄手牌</h4>
                  <div className={styles.cardsInline}>
                    <CardPill card={activeRow.hand[0]} />
                    <CardPill card={activeRow.hand[1]} />
                  </div>
                </div>

                <div className={styles.detailStreet}>
                  <h4>翻前</h4>
                  <div className={styles.streetLine}><span>SB</span><b>全下 5(2)</b></div>
                  <div className={styles.streetLine}><span>BB</span><b className={styles.numBad}>弃牌</b></div>
                </div>

                <div className={styles.detailStreet}>
                  <h4>摊牌</h4>
                  <div className={styles.streetLine}><span>BB</span><b className={styles.numBad}>1 BB</b></div>
                </div>
              </aside>
            ) : null}
          </div>
        ) : (
          <div className={styles.statsView}>
            <div className={styles.statsTopGrid}>
              <article className={styles.kpiCard}>
                <p>GTO 分数</p>
                <strong className={styles.numBad}>-25.6%</strong>
              </article>

              <article className={styles.kpiCard}>
                <p>手牌</p>
                <strong>16</strong>
                <span>14 次决策</span>
              </article>

              <article className={styles.kpiCard}>
                <p>平均 EV 损失</p>
                <div className={styles.kpiSplit}>
                  <strong>32.46 bb</strong>
                  <strong>15.4 pot%</strong>
                  <strong>38.95 bb</strong>
                </div>
                <span>每 100 手牌 / 每 100 次错误</span>
              </article>

              <article className={styles.kpiCard}>
                <p>频率偏差</p>
                <strong>71.36%</strong>
              </article>
            </div>

            <div className={styles.statsBottomGrid}>
              <article className={styles.statsCard}>
                <div className={styles.streetTabs}>
                  <button type="button" className={`${styles.streetTab} ${styles.streetTabActive}`}>街道</button>
                  <button type="button" className={styles.streetTab}>翻前动作</button>
                  <button type="button" className={styles.streetTab}>位置</button>
                  <button type="button" className={styles.streetTab}>翻前激进度</button>
                </div>

                <table className={styles.streetTable}>
                  <thead>
                    <tr>
                      <th />
                      <th>总计</th>
                      <th>完美率%</th>
                      <th>良好率%</th>
                      <th>不准确率%</th>
                      <th>错误率%</th>
                      <th>严重错误率%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>全部街道</td><td>14</td><td>28.6</td><td>-</td><td>7.1</td><td>21.4</td><td>42.9</td></tr>
                    <tr><td>翻前</td><td>12</td><td>33.3</td><td>-</td><td>-</td><td>16.7</td><td>50</td></tr>
                    <tr><td>翻牌</td><td>1</td><td>-</td><td>-</td><td>100</td><td>-</td><td>-</td></tr>
                    <tr><td>转牌</td><td>1</td><td>-</td><td>-</td><td>-</td><td>100</td><td>-</td></tr>
                    <tr><td>河牌</td><td>0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>
                  </tbody>
                </table>
              </article>

              <article className={styles.statsCard}>
                <h3>分数分布 - 决策数量</h3>
                <div className={styles.scoreBars}>
                  {SCORE_BREAKDOWN.map((line) => (
                    <div key={line.label} className={styles.scoreRow}>
                      <span>{line.label}</span>
                      <div className={styles.scoreTrack}>
                        <div
                          className={`${styles.scoreFill} ${line.tone === 'mint' ? styles.scoreMint : line.tone === 'yellow' ? styles.scoreYellow : styles.scoreRed}`}
                          style={{ width: `${Math.max(8, line.value * 15)}%` }}
                        />
                      </div>
                      <strong>{line.value === 0 ? '-' : line.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
