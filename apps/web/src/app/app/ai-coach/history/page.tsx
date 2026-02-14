import { ModuleView } from '@/components/module/ModuleView';

export default function AICoachHistoryPage() {
  return (
    <ModuleView
      moduleKey="aiCoachHistory"
      actionHref="/app/study"
      actionLabelKey="module.aiCoachHistory.backToStudy"
    />
  );
}
