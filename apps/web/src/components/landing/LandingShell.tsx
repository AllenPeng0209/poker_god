import Link from 'next/link';

import { InquiryComposer } from '@/components/landing/InquiryComposer';

const LINKS = [
  'Study Hub',
  'Solver Lab',
  'Trainer',
  'Hand Analyzer',
  'Leak Reports',
  'Arena'
] as const;

export function LandingShell() {
  return (
    <main className="landing-grid">
      <aside className="landing-side-nav" aria-label="primary">
        <div>
          <p className="brand-mark">ZENGTO</p>
          <p className="brand-subtitle">Strategy OS for poker grinders</p>
        </div>
        <nav>
          <ul>
            {LINKS.map((link) => (
              <li key={link}>{link}</li>
            ))}
          </ul>
        </nav>
        <Link href="/app/study" className="launch-link">
          进入产品骨架
        </Link>
      </aside>

      <InquiryComposer />

      <section className="landing-right-panel" aria-label="announcements">
        <h2>Build Notes</h2>
        <ul>
          <li>统一 Study / Practice / Analyze 闭环</li>
          <li>每个模块支持 AI Coach 右侧抽屉</li>
          <li>支持 Solver 任务队列和结果回跳训练</li>
        </ul>

        <div className="status-block">
          <span>Web Skeleton</span>
          <strong>Online</strong>
        </div>
      </section>
    </main>
  );
}
