/**
 * Saarvi Jobs Engine 2.0 — Job Alert Subscriptions Store
 *
 * Manages user job alert subscriptions for proactive notifications.
 */

import type { JobAlertSubscription } from "./types.ts";

class JobAlertsStoreService {
  private alerts = new Map<string, JobAlertSubscription>();

  public createAlert(params: {
    userId: string;
    title: string;
    keywords: string[];
    location?: string;
    employmentType?: string;
    frequency?: "daily" | "weekly";
    emailNotifications?: boolean;
    inAppNotifications?: boolean;
  }): JobAlertSubscription {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const subscription: JobAlertSubscription = {
      id,
      userId: params.userId,
      title: params.title,
      keywords: params.keywords,
      location: params.location,
      employmentType: params.employmentType,
      frequency: params.frequency || "daily",
      active: true,
      emailNotifications: params.emailNotifications ?? true,
      inAppNotifications: params.inAppNotifications ?? true,
      createdAt: new Date().toISOString(),
    };

    this.alerts.set(id, subscription);
    return subscription;
  }

  public getAlertsByUser(userId: string): JobAlertSubscription[] {
    return Array.from(this.alerts.values()).filter((a) => a.userId === userId);
  }

  public deleteAlert(id: string, userId: string): boolean {
    const existing = this.alerts.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.alerts.delete(id);
  }

  public toggleAlert(id: string, userId: string, active: boolean): JobAlertSubscription | null {
    const existing = this.alerts.get(id);
    if (!existing || existing.userId !== userId) return null;
    existing.active = active;
    this.alerts.set(id, existing);
    return existing;
  }

  public getAllAlerts(): JobAlertSubscription[] {
    return Array.from(this.alerts.values());
  }
}

export const jobAlertsStore = new JobAlertsStoreService();
