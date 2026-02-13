import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';
import Link from 'next/link';

export default function ReportsPage() {
  const config = MODULE_CONFIG.reports;
  return (
    <ModuleView
      title={config.title}
      summary={config.summary}
      highlights={config.highlights}
      actionSlot={
        <Link className="module-next-link" href="/app/ai-coach/history">
          继续到 AI Coach History
        </Link>
      }
    />
  );
}
