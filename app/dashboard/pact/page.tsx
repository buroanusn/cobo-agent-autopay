'use client';

import AppLayout from '@/components/layout/AppLayout';
import PactTemplates from '@/components/pact/v2/PactTemplates';

export default function PactPage() {
  return (
    <AppLayout title="协议">
      <PactTemplates />
    </AppLayout>
  );
}
