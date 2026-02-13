import type { ReactNode } from 'react';

type ModuleViewProps = {
  title: string;
  summary: string;
  highlights: string[];
  actionSlot?: ReactNode;
};

export function ModuleView({ title, summary, highlights, actionSlot }: ModuleViewProps) {
  return (
    <section className="module-panel" aria-labelledby={`module-title-${title}`}>
      <header>
        <p className="module-eyebrow">Workspace</p>
        <h1 id={`module-title-${title}`}>{title}</h1>
        <p>{summary}</p>
      </header>

      <div className="module-grid">
        <article className="module-card">
          <h2>当前能力</h2>
          <ul>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="module-card module-card--accent">
          <h2>M1 占位态</h2>
          <p>当前模块仍是骨架页面，真实数据、交互与 API 能力将在后续故事中逐步接入。</p>
          <p>你可以先通过下方入口继续闭环流程。</p>
          {actionSlot ? <div className="module-next-entry">{actionSlot}</div> : null}
        </article>
      </div>
    </section>
  );
}
