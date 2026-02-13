'use client';

import { useMemo, useState } from 'react';

const EXAMPLE_QUESTIONS = [
  'CO 2.5bb open, BB defend, flop K♣7♦2♠，100bb 应该怎么构建 c-bet 频率？',
  'BTN vs SB 3-bet pot，turn 配对后如何平衡大尺寸下注？',
  '25bb MTT，HJ open 被 BTN 3-bet，AJo 是否应该混合 4-bet bluff？'
] as const;

const MAX_LENGTH = 2000;

export function InquiryComposer() {
  const [value, setValue] = useState<string>(EXAMPLE_QUESTIONS[0]);
  const [activeExample, setActiveExample] = useState(0);

  const remaining = useMemo(() => MAX_LENGTH - value.length, [value.length]);

  return (
    <section className="landing-composer" aria-label="solution composer">
      <header className="landing-composer__header">
        <p className="landing-eyebrow">Real-time Solver Engine</p>
        <h1>COMING SOON</h1>
      </header>

      <label className="landing-label" htmlFor="prompt-input">
        你想先研究哪个 Spot？
      </label>
      <textarea
        id="prompt-input"
        value={value}
        maxLength={MAX_LENGTH}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        aria-label="Hand question input"
      />

      <footer className="landing-composer__footer">
        <span className={remaining <= 120 ? 'text-warning' : 'text-muted'}>
          剩余 {remaining} 字
        </span>
        <button type="button" className="ghost-button">
          保存为草稿
        </button>
      </footer>

      <div className="landing-examples" aria-label="example prompts">
        {EXAMPLE_QUESTIONS.map((question, index) => (
          <button
            key={question}
            type="button"
            className={index === activeExample ? 'chip chip--active' : 'chip'}
            onClick={() => {
              setActiveExample(index);
              setValue(question);
            }}
          >
            示例 {index + 1}
          </button>
        ))}
      </div>

      <div className="landing-actions">
        <button type="button" className="primary-button">
          成为首批内测玩家
        </button>
        <button type="button" className="secondary-button">
          查看产品文档
        </button>
      </div>
    </section>
  );
}
