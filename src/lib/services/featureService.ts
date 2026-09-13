// DocEase Centralized Feature Flags Service

import { FeatureFlag, FeatureFlagStatus, FeatureAccessMode, hasPermission } from '@/types/admin';
import { featureServerStore } from '@/lib/features/feature-store';
import { AdminActor } from './adminService';

export const featureService = {
  getAllFeatures(): FeatureFlag[] {
    return featureServerStore.getAllFeatures();
  },

  getFeature(id: string): FeatureFlag | undefined {
    return featureServerStore.getFeature(id);
  },

  isFeatureEnabled(id: string): boolean {
    return featureServerStore.isFeatureEnabled(id);
  },

  getFeatureAccessMode(id: string): FeatureAccessMode {
    return featureServerStore.getFeatureAccessMode(id);
  },

  updateFeatureStatus(id: string, status: FeatureFlagStatus, actor: AdminActor): FeatureFlag {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    return featureServerStore.updateFeature(
      id,
      { status },
      { id: actor.id, email: actor.email, role: actor.role }
    );
  },

  updateFeatureAccessMode(id: string, accessMode: FeatureAccessMode, actor: AdminActor): FeatureFlag {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    return featureServerStore.updateFeature(
      id,
      { accessMode },
      { id: actor.id, email: actor.email, role: actor.role }
    );
  },

  updateFeature(
    id: string,
    updates: Partial<Pick<FeatureFlag, 'status' | 'accessMode' | 'visibility' | 'name' | 'description'>>,
    actor: AdminActor
  ): FeatureFlag {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    return featureServerStore.updateFeature(
      id,
      updates,
      { id: actor.id, email: actor.email, role: actor.role }
    );
  },

  getAggregateMetrics() {
    return featureServerStore.getAggregateMetrics();
  },
};
