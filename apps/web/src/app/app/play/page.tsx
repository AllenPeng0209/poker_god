import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';

export default function PlayPage() {
  const config = MODULE_CONFIG.play;
  return <ModuleView title={config.title} summary={config.summary} highlights={config.highlights} />;
}
