import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';

export default function LearnPage() {
  const config = MODULE_CONFIG.learn;
  return <ModuleView title={config.title} summary={config.summary} highlights={config.highlights} />;
}
