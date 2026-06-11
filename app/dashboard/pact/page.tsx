'use client';

import AppLayout from '@/components/layout/AppLayout';
import UnifiedPactView from '@/components/pact/v2/UnifiedPactView';

export default function PactPage() {
  return (
    <AppLayout title="协议">
      <UnifiedPactView />
    </AppLayout>
  );
}
