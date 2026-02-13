import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';
import Link from 'next/link';

export default function PracticePage() {
  const config = MODULE_CONFIG.practice;
  return (
    <ModuleView
      title={config.title}
      summary={config.summary}
      highlights={config.highlights}
      actionSlot={
        <Link className="module-next-link" href="/app/analyze">
          继续到 Analyze
        </Link>
      }
    />
  );
}
