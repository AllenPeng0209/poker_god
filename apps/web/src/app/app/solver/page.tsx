import { ModuleView } from '@/components/module/ModuleView';
import { MODULE_CONFIG } from '@/components/module/moduleConfig';

export default function SolverPage() {
  const config = MODULE_CONFIG.solver;
  return <ModuleView title={config.title} summary={config.summary} highlights={config.highlights} />;
}
