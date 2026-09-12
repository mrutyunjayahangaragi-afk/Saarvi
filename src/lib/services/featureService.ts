// DocEase Centralized Feature Flags Service

import { FeatureFlag, FeatureFlagStatus, hasPermission } from '@/types/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { AdminActor } from './adminService';

export const featureService = {
  getAllFeatures(): FeatureFlag[] {
    return MockStorageProvider.getFeatureFlags();
  },

  getFeature(id: string): FeatureFlag | undefined {
    const flags = this.getAllFeatures();
    return flags.find((f) => f.id === id);
  },

  isFeatureEnabled(id: string): boolean {
    const flag = this.getFeature(id);
    if (!flag) return false;
    return flag.status === 'ENABLED' || flag.status === 'BETA';
  },

  updateFeatureStatus(id: string, status: FeatureFlagStatus, actor: AdminActor): FeatureFlag {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    const flag = this.getFeature(id);
    if (!flag) throw new Error(`Feature flag "${id}" not found.`);

    const updated = MockStorageProvider.updateFeatureFlag({
      ...flag,
      status,
      updatedBy: actor.email,
    });

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: `FEATURE_FLAG_${status}`,
      targetType: 'FEATURE',
      targetId: id,
      metadata: { newStatus: status },
    });

    return updated;
  },
};
