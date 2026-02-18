export type StrategyMixItem = {
  action: string;
  frequency_pct: number;
  ev_bb: number;
};

export type RangeBucket = {
  bucket: string;
  combos: number;
  frequency_pct: number;
};

export type LeakItem = {
  label: string;
  frequency_gap_pct: number;
  ev_loss_bb100: number;
};

export type StudyNodeDetail = {
  node_code: string;
  board: string;
  hero: string;
  villain: string;
  pot_bb: number;
  strategy: {
    recommended_line: string;
    aggregate_ev_bb: number;
    action_mix: StrategyMixItem[];
  };
  ranges: {
    defense_freq_pct: number;
    buckets: RangeBucket[];
  };
  breakdown: {
    sample_size: number;
    avg_ev_loss_bb100: number;
    confidence: 'High' | 'Medium' | 'Low';
    leaks: LeakItem[];
  };
};

export type StudySpot = {
  id: string;
  title: string;
  format: 'Cash 6-max' | 'Cash Heads-Up' | 'MTT 9-max';
  position: 'BTN vs BB' | 'CO vs BTN' | 'SB vs BB' | 'UTG vs BB';
  stack_bb: 20 | 40 | 60 | 100 | 200;
  street: 'Flop' | 'Turn' | 'River';
  node: StudyNodeDetail;
};

export const STUDY_SPOTS: StudySpot[] = [
  {
    id: 'spot-001',
    title: 'SRP C-bet High Card Texture',
    format: 'Cash 6-max',
    position: 'BTN vs BB',
    stack_bb: 100,
    street: 'Flop',
    node: {
      node_code: 'BTN_F_CBET_A74R',
      board: 'As 7d 4c',
      hero: 'BTN',
      villain: 'BB',
      pot_bb: 6.5,
      strategy: {
        recommended_line: '33% c-bet at mixed frequency',
        aggregate_ev_bb: 1.38,
        action_mix: [
          { action: 'Bet 33%', frequency_pct: 52, ev_bb: 1.41 },
          { action: 'Check', frequency_pct: 40, ev_bb: 1.28 },
          { action: 'Bet 75%', frequency_pct: 8, ev_bb: 1.33 }
        ]
      },
      ranges: {
        defense_freq_pct: 62,
        buckets: [
          { bucket: 'Value', combos: 148, frequency_pct: 31 },
          { bucket: 'Bluff', combos: 122, frequency_pct: 25 },
          { bucket: 'Protection', combos: 96, frequency_pct: 20 },
          { bucket: 'Check-back', combos: 118, frequency_pct: 24 }
        ]
      },
      breakdown: {
        sample_size: 8240,
        avg_ev_loss_bb100: 16.3,
        confidence: 'High',
        leaks: [
          { label: 'Over-check top pair weak kicker', frequency_gap_pct: 13, ev_loss_bb100: 6.2 },
          { label: 'Under-bluff wheel backdoors', frequency_gap_pct: 9, ev_loss_bb100: 4.1 }
        ]
      }
    }
  },
  {
    id: 'spot-002',
    title: 'Delayed C-bet Double Barrel',
    format: 'Cash 6-max',
    position: 'CO vs BTN',
    stack_bb: 100,
    street: 'Turn',
    node: {
      node_code: 'CO_T_DELAY_BRL_KJ5_9',
      board: 'Kd Jh 5s | 9c',
      hero: 'CO',
      villain: 'BTN',
      pot_bb: 10.4,
      strategy: {
        recommended_line: 'Delay 60% turn stab after flop check-through',
        aggregate_ev_bb: 1.02,
        action_mix: [
          { action: 'Bet 66%', frequency_pct: 44, ev_bb: 1.09 },
          { action: 'Bet 33%', frequency_pct: 18, ev_bb: 1.01 },
          { action: 'Check', frequency_pct: 38, ev_bb: 0.93 }
        ]
      },
      ranges: {
        defense_freq_pct: 58,
        buckets: [
          { bucket: 'Merged value', combos: 132, frequency_pct: 29 },
          { bucket: 'Semi-bluff', combos: 105, frequency_pct: 23 },
          { bucket: 'Thin showdown', combos: 119, frequency_pct: 26 },
          { bucket: 'Air give-up', combos: 101, frequency_pct: 22 }
        ]
      },
      breakdown: {
        sample_size: 5660,
        avg_ev_loss_bb100: 19.8,
        confidence: 'Medium',
        leaks: [
          { label: 'Missed delayed stab vs capped ranges', frequency_gap_pct: 11, ev_loss_bb100: 5.7 },
          { label: 'Over-sized bluff region', frequency_gap_pct: 7, ev_loss_bb100: 3.6 }
        ]
      }
    }
  },
  {
    id: 'spot-003',
    title: 'Turn XR Defense Node',
    format: 'Cash Heads-Up',
    position: 'BTN vs BB',
    stack_bb: 60,
    street: 'Turn',
    node: {
      node_code: 'HU_BB_T_XR_DEF_Q83_6',
      board: 'Qs 8d 3h | 6h',
      hero: 'BB',
      villain: 'BTN',
      pot_bb: 12.1,
      strategy: {
        recommended_line: 'Defend versus XR with condensed continue range',
        aggregate_ev_bb: 0.74,
        action_mix: [
          { action: 'Call', frequency_pct: 51, ev_bb: 0.81 },
          { action: 'Jam', frequency_pct: 12, ev_bb: 0.88 },
          { action: 'Fold', frequency_pct: 37, ev_bb: 0 }
        ]
      },
      ranges: {
        defense_freq_pct: 63,
        buckets: [
          { bucket: 'Strong draws', combos: 86, frequency_pct: 28 },
          { bucket: 'Top pair+', combos: 102, frequency_pct: 33 },
          { bucket: 'Pair+draw', combos: 57, frequency_pct: 18 },
          { bucket: 'Pure folds', combos: 68, frequency_pct: 21 }
        ]
      },
      breakdown: {
        sample_size: 3920,
        avg_ev_loss_bb100: 22.1,
        confidence: 'Medium',
        leaks: [
          { label: 'Under-jam nut draws', frequency_gap_pct: 8, ev_loss_bb100: 4.9 },
          { label: 'Over-fold middle pairs', frequency_gap_pct: 10, ev_loss_bb100: 5.4 }
        ]
      }
    }
  },
  {
    id: 'spot-004',
    title: 'SB Open Pot Donk Response',
    format: 'Cash 6-max',
    position: 'SB vs BB',
    stack_bb: 40,
    street: 'Flop',
    node: {
      node_code: 'SB_F_DONK_RESP_T96',
      board: 'Th 9s 6d',
      hero: 'BB',
      villain: 'SB',
      pot_bb: 4.2,
      strategy: {
        recommended_line: 'Raise linear versus small donk sizing',
        aggregate_ev_bb: 0.62,
        action_mix: [
          { action: 'Raise 3.5x', frequency_pct: 34, ev_bb: 0.71 },
          { action: 'Call', frequency_pct: 46, ev_bb: 0.6 },
          { action: 'Fold', frequency_pct: 20, ev_bb: 0 }
        ]
      },
      ranges: {
        defense_freq_pct: 69,
        buckets: [
          { bucket: 'Value raises', combos: 74, frequency_pct: 27 },
          { bucket: 'Equity raises', combos: 58, frequency_pct: 21 },
          { bucket: 'Flat calls', combos: 93, frequency_pct: 34 },
          { bucket: 'Folds', combos: 49, frequency_pct: 18 }
        ]
      },
      breakdown: {
        sample_size: 4410,
        avg_ev_loss_bb100: 14.9,
        confidence: 'High',
        leaks: [
          { label: 'Passive continue with combo draws', frequency_gap_pct: 12, ev_loss_bb100: 4.4 },
          { label: 'Over-fold weak pair+gutshot', frequency_gap_pct: 6, ev_loss_bb100: 2.8 }
        ]
      }
    }
  },
  {
    id: 'spot-005',
    title: 'Short Stack Jam or Fold',
    format: 'MTT 9-max',
    position: 'UTG vs BB',
    stack_bb: 20,
    street: 'River',
    node: {
      node_code: 'MTT_UTG_R_JAM_20BB',
      board: 'Jc 7c 4s | Td | 2h',
      hero: 'UTG',
      villain: 'BB',
      pot_bb: 8.9,
      strategy: {
        recommended_line: 'Polar jam with blocker-heavy misses',
        aggregate_ev_bb: 0.29,
        action_mix: [
          { action: 'Jam', frequency_pct: 41, ev_bb: 0.42 },
          { action: 'Check', frequency_pct: 59, ev_bb: 0.2 }
        ]
      },
      ranges: {
        defense_freq_pct: 47,
        buckets: [
          { bucket: 'Nut value', combos: 39, frequency_pct: 18 },
          { bucket: 'Thin value', combos: 52, frequency_pct: 24 },
          { bucket: 'Blocker bluffs', combos: 44, frequency_pct: 20 },
          { bucket: 'Check-back', combos: 82, frequency_pct: 38 }
        ]
      },
      breakdown: {
        sample_size: 2870,
        avg_ev_loss_bb100: 24.6,
        confidence: 'Low',
        leaks: [
          { label: 'Missed river jam with ace blockers', frequency_gap_pct: 15, ev_loss_bb100: 7.3 },
          { label: 'Over-jam thin value', frequency_gap_pct: 5, ev_loss_bb100: 2.9 }
        ]
      }
    }
  },
  {
    id: 'spot-006',
    title: 'ICM Turn Probe Defense',
    format: 'MTT 9-max',
    position: 'CO vs BTN',
    stack_bb: 40,
    street: 'Turn',
    node: {
      node_code: 'ICM_CO_T_PROBE_DEF_A95_J',
      board: 'Ac 9h 5d | Js',
      hero: 'BTN',
      villain: 'CO',
      pot_bb: 7.6,
      strategy: {
        recommended_line: 'Tighten bluff raises, keep high-equity calls',
        aggregate_ev_bb: 0.55,
        action_mix: [
          { action: 'Call', frequency_pct: 49, ev_bb: 0.61 },
          { action: 'Raise 2.8x', frequency_pct: 16, ev_bb: 0.58 },
          { action: 'Fold', frequency_pct: 35, ev_bb: 0 }
        ]
      },
      ranges: {
        defense_freq_pct: 57,
        buckets: [
          { bucket: 'Top pair+', combos: 91, frequency_pct: 34 },
          { bucket: 'Draw continues', combos: 63, frequency_pct: 23 },
          { bucket: 'Delayed floats', combos: 47, frequency_pct: 18 },
          { bucket: 'Folds', combos: 67, frequency_pct: 25 }
        ]
      },
      breakdown: {
        sample_size: 3110,
        avg_ev_loss_bb100: 18.1,
        confidence: 'Medium',
        leaks: [
          { label: 'Raise frequency too high under ICM', frequency_gap_pct: 9, ev_loss_bb100: 4.8 },
          { label: 'Under-defend nut flush draws', frequency_gap_pct: 7, ev_loss_bb100: 3.1 }
        ]
      }
    }
  },
  {
    id: 'spot-007',
    title: 'Triple Barrel Bluff Catch',
    format: 'Cash Heads-Up',
    position: 'BTN vs BB',
    stack_bb: 100,
    street: 'River',
    node: {
      node_code: 'HU_BB_R_BLUFF_CATCH_8T5_2_A',
      board: '8s Td 5h | 2d | As',
      hero: 'BB',
      villain: 'BTN',
      pot_bb: 20.7,
      strategy: {
        recommended_line: 'Prioritize blocker-driven bluff catches',
        aggregate_ev_bb: 0.18,
        action_mix: [
          { action: 'Call', frequency_pct: 43, ev_bb: 0.31 },
          { action: 'Fold', frequency_pct: 57, ev_bb: 0 }
        ]
      },
      ranges: {
        defense_freq_pct: 41,
        buckets: [
          { bucket: 'Nut bluff-catch', combos: 28, frequency_pct: 16 },
          { bucket: 'Marginal bluff-catch', combos: 46, frequency_pct: 25 },
          { bucket: 'Pure folds', combos: 109, frequency_pct: 59 }
        ]
      },
      breakdown: {
        sample_size: 4870,
        avg_ev_loss_bb100: 21.4,
        confidence: 'High',
        leaks: [
          { label: 'Over-fold ace blockers', frequency_gap_pct: 12, ev_loss_bb100: 6.5 },
          { label: 'Over-call weak bluff catchers', frequency_gap_pct: 4, ev_loss_bb100: 2.1 }
        ]
      }
    }
  },
  {
    id: 'spot-008',
    title: 'Low Board Small Bet Strategy',
    format: 'Cash 6-max',
    position: 'UTG vs BB',
    stack_bb: 60,
    street: 'Flop',
    node: {
      node_code: 'UTG_F_SMALL_BET_652R',
      board: '6c 5d 2s',
      hero: 'UTG',
      villain: 'BB',
      pot_bb: 5.4,
      strategy: {
        recommended_line: 'High-frequency small c-bet with overpairs + overcards',
        aggregate_ev_bb: 1.11,
        action_mix: [
          { action: 'Bet 25%', frequency_pct: 67, ev_bb: 1.18 },
          { action: 'Check', frequency_pct: 33, ev_bb: 0.97 }
        ]
      },
      ranges: {
        defense_freq_pct: 66,
        buckets: [
          { bucket: 'Thin value', combos: 124, frequency_pct: 32 },
          { bucket: 'Board coverage bluffs', combos: 133, frequency_pct: 34 },
          { bucket: 'Check-back protections', combos: 81, frequency_pct: 21 },
          { bucket: 'Trap checks', combos: 51, frequency_pct: 13 }
        ]
      },
      breakdown: {
        sample_size: 7050,
        avg_ev_loss_bb100: 13.7,
        confidence: 'High',
        leaks: [
          { label: 'Too many flop checks with overcards', frequency_gap_pct: 10, ev_loss_bb100: 4.2 },
          { label: 'Under-bluff wheel gutters', frequency_gap_pct: 8, ev_loss_bb100: 3.4 }
        ]
      }
    }
  },
  {
    id: 'spot-200-001',
    title: '200bb BTN vs BB Deep SRP Probe',
    format: 'Cash 6-max',
    position: 'BTN vs BB',
    stack_bb: 200,
    street: 'Flop',
    node: {
      node_code: 'DEEP200_BTN_BB_F_PROBE_K83R',
      board: 'Ks 8d 3c',
      hero: 'BTN',
      villain: 'BB',
      pot_bb: 6.5,
      strategy: {
        recommended_line: 'Mix small c-bet and check with capped turn plans',
        aggregate_ev_bb: 1.46,
        action_mix: [
          { action: 'Bet 33%', frequency_pct: 47, ev_bb: 1.52 },
          { action: 'Check', frequency_pct: 38, ev_bb: 1.34 },
          { action: 'Bet 75%', frequency_pct: 15, ev_bb: 1.41 }
        ]
      },
      ranges: {
        defense_freq_pct: 64,
        buckets: [
          { bucket: 'Value', combos: 156, frequency_pct: 33 },
          { bucket: 'Semi-bluff', combos: 118, frequency_pct: 25 },
          { bucket: 'Delay-check', combos: 132, frequency_pct: 28 },
          { bucket: 'Backdoor give-up', combos: 64, frequency_pct: 14 }
        ]
      },
      breakdown: {
        sample_size: 9180,
        avg_ev_loss_bb100: 14.6,
        confidence: 'High',
        leaks: [
          { label: 'Over-delay turn on strong top pairs', frequency_gap_pct: 9, ev_loss_bb100: 4.1 },
          { label: 'Under-bluff low backdoor combos', frequency_gap_pct: 8, ev_loss_bb100: 3.6 }
        ]
      }
    }
  },
  {
    id: 'spot-200-002',
    title: '200bb CO vs BTN Turn Pressure',
    format: 'Cash 6-max',
    position: 'CO vs BTN',
    stack_bb: 200,
    street: 'Turn',
    node: {
      node_code: 'DEEP200_CO_BTN_T_PRESS_QJ6_4',
      board: 'Qh Jd 6s | 4c',
      hero: 'CO',
      villain: 'BTN',
      pot_bb: 11.8,
      strategy: {
        recommended_line: 'Keep medium sizing as baseline, polarize checks',
        aggregate_ev_bb: 1.08,
        action_mix: [
          { action: 'Bet 66%', frequency_pct: 42, ev_bb: 1.16 },
          { action: 'Check', frequency_pct: 34, ev_bb: 0.96 },
          { action: 'Bet 125%', frequency_pct: 24, ev_bb: 1.09 }
        ]
      },
      ranges: {
        defense_freq_pct: 59,
        buckets: [
          { bucket: 'Merged value', combos: 143, frequency_pct: 31 },
          { bucket: 'High-equity bluffs', combos: 101, frequency_pct: 22 },
          { bucket: 'Pot-control checks', combos: 121, frequency_pct: 26 },
          { bucket: 'Folds', combos: 98, frequency_pct: 21 }
        ]
      },
      breakdown: {
        sample_size: 6720,
        avg_ev_loss_bb100: 18.7,
        confidence: 'Medium',
        leaks: [
          { label: 'Under-polarize on dynamic turns', frequency_gap_pct: 10, ev_loss_bb100: 5.0 },
          { label: 'Over-barrel dominated top-pair', frequency_gap_pct: 6, ev_loss_bb100: 2.9 }
        ]
      }
    }
  },
  {
    id: 'spot-200-003',
    title: '200bb SB vs BB Deep Check-Raise Defense',
    format: 'Cash 6-max',
    position: 'SB vs BB',
    stack_bb: 200,
    street: 'Turn',
    node: {
      node_code: 'DEEP200_SB_BB_T_XR_DEF_974_A',
      board: '9s 7h 4d | Ac',
      hero: 'BB',
      villain: 'SB',
      pot_bb: 9.6,
      strategy: {
        recommended_line: 'Defend with high-equity draws, fold capped bluff-catchers',
        aggregate_ev_bb: 0.71,
        action_mix: [
          { action: 'Call', frequency_pct: 49, ev_bb: 0.81 },
          { action: 'Raise 2.8x', frequency_pct: 17, ev_bb: 0.89 },
          { action: 'Fold', frequency_pct: 34, ev_bb: 0 }
        ]
      },
      ranges: {
        defense_freq_pct: 66,
        buckets: [
          { bucket: 'Strong continues', combos: 118, frequency_pct: 32 },
          { bucket: 'Raise mix', combos: 62, frequency_pct: 17 },
          { bucket: 'Marginal bluff-catch', combos: 73, frequency_pct: 20 },
          { bucket: 'Pure folds', combos: 116, frequency_pct: 31 }
        ]
      },
      breakdown: {
        sample_size: 5480,
        avg_ev_loss_bb100: 20.4,
        confidence: 'Medium',
        leaks: [
          { label: 'Over-fold nut gutshots + overcards', frequency_gap_pct: 11, ev_loss_bb100: 5.6 },
          { label: 'Under-raise pair + draw combos', frequency_gap_pct: 7, ev_loss_bb100: 3.3 }
        ]
      }
    }
  }
];
