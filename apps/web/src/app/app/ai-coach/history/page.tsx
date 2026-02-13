import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';
import Link from 'next/link';

export default function AICoachHistoryPage() {
  const config = MODULE_CONFIG.aiCoachHistory;
  return (
    <ModuleView
      title={config.title}
      summary={config.summary}
      highlights={config.highlights}
      actionSlot={
        <Link className="module-next-link" href="/app/study">
          返回 Study
        </Link>
      }
    />
  );
}
