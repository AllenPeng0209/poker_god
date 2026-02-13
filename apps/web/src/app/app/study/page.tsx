import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';
import Link from 'next/link';

export default function StudyPage() {
  const config = MODULE_CONFIG.study;
  return (
    <ModuleView
      title={config.title}
      summary={config.summary}
      highlights={config.highlights}
      actionSlot={
        <Link className="module-next-link" href="/app/practice">
          继续到 Practice
        </Link>
      }
    />
  );
}
