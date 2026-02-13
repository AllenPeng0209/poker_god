import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';
import Link from 'next/link';

export default function AnalyzePage() {
  const config = MODULE_CONFIG.analyze;
  return (
    <ModuleView
      title={config.title}
      summary={config.summary}
      highlights={config.highlights}
      actionSlot={
        <Link className="module-next-link" href="/app/reports">
          继续到 Reports
        </Link>
      }
    />
  );
}
