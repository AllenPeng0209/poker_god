import { AnalyzeWorkbench } from '@/components/analyze/AnalyzeWorkbench';
import { Suspense } from 'react';

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzeWorkbench />
    </Suspense>
  );
}
