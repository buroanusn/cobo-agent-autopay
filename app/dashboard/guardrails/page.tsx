'use client';

import AppLayout from '@/components/layout/AppLayout';
import GuardrailsView from '@/components/guardrails/v2/GuardrailsView';

export default function GuardrailsPage() {
  return (
    <AppLayout title="Guardrails">
      <GuardrailsView />
    </AppLayout>
  );
}
