// DocEase Admin Analytics Service
// Authoritative Real-Time Data Aggregations, Time-Series Analysis & Platform Overview
// CRITICAL PRIVACY RULE: Zero inspection of local user files or browser workspace documents.

import {
  DateRangePeriod,
  DashboardKPIs,
  TimeSeriesPoint,
  CategoryDistribution,
  TrendComparison,
  PlatformEventRecord,
  PlatformErrorRecord,
  AuditLogRecord,
  SystemHealthCheck,
  CurriculumVersionRecord,
  StudentToolConfig,
} from '@/types/admin';
import { UserProfile, UserAccountStatus } from '@/types/auth';
import { adminService } from './adminService';
import { MockStorageProvider } from '../supabase/mock-storage';
import { STUDENT_TOOLS_REGISTRY } from '@/config/studentTools';
import { telemetry } from '@/lib/observability/telemetry';
import { featureServerStore } from '@/lib/features/feature-store';

export interface DateRangeBoundary {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  daysCount: number;
}

export const adminAnalyticsService = {
  // =========================================================================
  // 1. DATE RANGE & MATHEMATICAL COMPARISONS
  // =========================================================================

  getDateRangeBoundaries(period: DateRangePeriod, customStart?: string, customEnd?: string): DateRangeBoundary {
    const now = new Date();
    const currentEnd = customEnd ? new Date(customEnd) : new Date(now);

    let daysCount = 30;
    let currentStart = new Date(now);

    switch (period) {
      case 'today':
        daysCount = 1;
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case '7d':
        daysCount = 7;
        currentStart = new Date(now.getTime() - 7 * 864e5);
        break;
      case '30d':
        daysCount = 30;
        currentStart = new Date(now.getTime() - 30 * 864e5);
        break;
      case '90d':
        daysCount = 90;
        currentStart = new Date(now.getTime() - 90 * 864e5);
        break;
      case 'all':
        daysCount = 365;
        currentStart = new Date('2025-01-01T00:00:00.000Z');
        break;
      case 'custom':
        if (customStart) {
          currentStart = new Date(customStart);
          daysCount = Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / 864e5));
        } else {
          daysCount = 30;
          currentStart = new Date(now.getTime() - 30 * 864e5);
        }
        break;
    }

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime());
    const previousStart = new Date(previousEnd.getTime() - durationMs);

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      daysCount,
    };
  },

  calculateTrend(currentVal: number, previousVal: number): TrendComparison {
    const diff = currentVal - previousVal;
    let percentage: number | null = null;

    if (previousVal > 0) {
      percentage = Math.round(((currentVal - previousVal) / previousVal) * 1000) / 10;
    } else if (previousVal === 0 && currentVal > 0) {
      percentage = 100;
    } else if (previousVal === 0 && currentVal === 0) {
      percentage = 0;
    }

    return {
      current: currentVal,
      previous: previousVal,
      diff,
      percentage,
      isPositive: diff >= 0,
    };
  },

  // =========================================================================
  // 2. USER METRICS & TIME-SERIES
  // =========================================================================

  async getUserMetrics(period: DateRangePeriod, customStart?: string, customEnd?: string) {
    const boundaries = this.getDateRangeBoundaries(period, customStart, customEnd);
    const usersRes = await adminService.listUsers({ limit: 10000 });
    const allUsers = usersRes.users;

    const currentNewUsers = allUsers.filter((u) => {
      const created = new Date(u.createdAt);
      return created >= boundaries.currentStart && created <= boundaries.currentEnd;
    });

    const previousNewUsers = allUsers.filter((u) => {
      const created = new Date(u.createdAt);
      return created >= boundaries.previousStart && created < boundaries.currentStart;
    });

    const trend = this.calculateTrend(currentNewUsers.length, previousNewUsers.length);

    // Active users: accounts with genuine lastSignInAt inside the selected window
    const activeInPeriod = allUsers.filter((u) => {
      if (!u.lastSignInAt) return false;
      const lastLogin = new Date(u.lastSignInAt);
      return lastLogin >= boundaries.currentStart && lastLogin <= boundaries.currentEnd;
    });

    const proUsers = allUsers.filter((u) => u.plan === 'PRO').length;
    const freeUsers = Math.max(0, allUsers.length - proUsers);
    const suspendedUsers = allUsers.filter((u) => u.status === 'SUSPENDED').length;

    return {
      totalUsers: allUsers.length,
      newUsers: currentNewUsers.length,
      previousNewUsers: previousNewUsers.length,
      trend,
      activeUsers: activeInPeriod.length,
      freeUsers,
      proUsers,
      suspendedUsers,
      activeUsersLabel: 'Based on recorded account sign-in activity in the selected period',
    };
  },

  async getUserGrowthTimeSeries(period: DateRangePeriod, customStart?: string, customEnd?: string): Promise<TimeSeriesPoint[]> {
    const boundaries = this.getDateRangeBoundaries(period, customStart, customEnd);
    const usersRes = await adminService.listUsers({ limit: 10000 });
    const rawStoredUsers = usersRes.users;

    const points: TimeSeriesPoint[] = [];
    const stepDays = boundaries.daysCount <= 1 ? 1 : boundaries.daysCount <= 14 ? 1 : boundaries.daysCount <= 60 ? 3 : 7;
    const startMs = boundaries.currentStart.getTime();
    const endMs = boundaries.currentEnd.getTime();

    for (let t = startMs; t <= endMs; t += stepDays * 864e5) {
      const slotDate = new Date(t);
      const slotEnd = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), 23, 59, 59, 999);

      const cumulativeCount = rawStoredUsers.filter((u) => new Date(u.createdAt) <= slotEnd).length;

      points.push({
        date: slotDate.toISOString().split('T')[0],
        label: slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: cumulativeCount,
      });
    }

    // Always include end point if not present
    const lastDateIso = boundaries.currentEnd.toISOString().split('T')[0];
    if (points.length === 0 || points[points.length - 1].date !== lastDateIso) {
      points.push({
        date: lastDateIso,
        label: boundaries.currentEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: rawStoredUsers.filter((u) => new Date(u.createdAt) <= boundaries.currentEnd).length,
      });
    }

    return points;
  },

  async getNewUsersTimeSeries(period: DateRangePeriod, customStart?: string, customEnd?: string): Promise<TimeSeriesPoint[]> {
    const boundaries = this.getDateRangeBoundaries(period, customStart, customEnd);
    const usersRes = await adminService.listUsers({ limit: 10000 });
    const rawStoredUsers = usersRes.users;

    const points: TimeSeriesPoint[] = [];
    const stepDays = boundaries.daysCount <= 1 ? 1 : boundaries.daysCount <= 14 ? 1 : boundaries.daysCount <= 60 ? 2 : 5;
    const startMs = boundaries.currentStart.getTime();
    const endMs = boundaries.currentEnd.getTime();

    for (let t = startMs; t <= endMs; t += stepDays * 864e5) {
      const slotStart = new Date(t);
      const slotEnd = new Date(Math.min(t + stepDays * 864e5, endMs));

      const count = rawStoredUsers.filter((u) => {
        const created = new Date(u.createdAt);
        return created >= slotStart && created <= slotEnd;
      }).length;

      points.push({
        date: slotStart.toISOString().split('T')[0],
        label: slotStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: count,
      });
    }

    return points;
  },

  async getAccountStatusDistribution(): Promise<CategoryDistribution[]> {
    const usersRes = await adminService.listUsers({ limit: 10000 });
    const rawStoredUsers = usersRes.users;
    const counts: Record<UserAccountStatus, number> = {
      ACTIVE: 0,
      SUSPENDED: 0,
      DISABLED: 0,
      PENDING: 0,
    };

    rawStoredUsers.forEach((u) => {
      const status = u.status || 'ACTIVE';
      counts[status] = (counts[status] || 0) + 1;
    });

    const total = rawStoredUsers.length || 1;

    const colors: Record<UserAccountStatus, string> = {
      ACTIVE: '#10b981', // emerald
      SUSPENDED: '#f59e0b', // amber
      DISABLED: '#ef4444', // red
      PENDING: '#64748b', // slate
    };

    const labels: Record<UserAccountStatus, string> = {
      ACTIVE: 'Active',
      SUSPENDED: 'Suspended',
      DISABLED: 'Disabled',
      PENDING: 'Pending',
    };

    return (Object.keys(counts) as UserAccountStatus[]).map((status) => ({
      label: labels[status],
      count: counts[status],
      color: colors[status],
      percentage: Math.round((counts[status] / total) * 100),
    }));
  },

  // =========================================================================
  // 3. TOOL METRICS & DISTRIBUTION
  // =========================================================================

  async getToolMetrics() {
    const effectiveTools = await adminService.getEffectiveTools();
    const total = effectiveTools.length;

    let available = 0;
    let beta = 0;
    let comingSoon = 0;
    let disabled = 0;
    let maintenance = 0;

    const categoryCounts: Record<string, number> = {
      pdf: 0,
      image: 0,
      student: 0,
      other: 0,
    };

    effectiveTools.forEach((tool) => {
      const s = (tool.status || 'available').toLowerCase();
      if (s === 'available') available++;
      else if (s === 'beta') beta++;
      else if (s === 'coming_soon' || s === 'coming-soon') comingSoon++;
      else if (s === 'disabled') disabled++;
      else if (s === 'maintenance') maintenance++;

      const cat = (tool.category || 'other').toLowerCase();
      if (categoryCounts[cat] !== undefined) {
        categoryCounts[cat]++;
      } else {
        categoryCounts.other = (categoryCounts.other || 0) + 1;
      }
    });

    const statusDistribution: CategoryDistribution[] = [
      { label: 'Available', count: available, color: '#10b981', percentage: Math.round((available / (total || 1)) * 100) },
      { label: 'Beta', count: beta, color: '#3b82f6', percentage: Math.round((beta / (total || 1)) * 100) },
      { label: 'Coming Soon', count: comingSoon, color: '#8b5cf6', percentage: Math.round((comingSoon / (total || 1)) * 100) },
      { label: 'Disabled', count: disabled, color: '#ef4444', percentage: Math.round((disabled / (total || 1)) * 100) },
      { label: 'Maintenance', count: maintenance, color: '#f59e0b', percentage: Math.round((maintenance / (total || 1)) * 100) },
    ].filter((item) => item.count > 0);

    const categoryDistribution: CategoryDistribution[] = [
      { label: 'PDF Utilities', count: categoryCounts.pdf || 0, color: '#2563eb', percentage: Math.round(((categoryCounts.pdf || 0) / (total || 1)) * 100) },
      { label: 'Image Utilities', count: categoryCounts.image || 0, color: '#06b6d4', percentage: Math.round(((categoryCounts.image || 0) / (total || 1)) * 100) },
      { label: 'Student Utilities', count: categoryCounts.student || 0, color: '#8b5cf6', percentage: Math.round(((categoryCounts.student || 0) / (total || 1)) * 100) },
    ].filter((c) => c.count > 0);

    return {
      total,
      available,
      beta,
      comingSoon,
      disabled,
      maintenance,
      statusDistribution,
      categoryDistribution,
    };
  },

  async getStudentToolsDistribution(): Promise<CategoryDistribution[]> {
    const counts: Record<string, number> = {
      academic: 0,
      planning: 0,
      career: 0,
      documents: 0,
      tracking: 0,
      organization: 0,
    };

    STUDENT_TOOLS_REGISTRY.forEach((t: StudentToolConfig) => {
      const cat = t.category.toLowerCase();
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });

    const total = STUDENT_TOOLS_REGISTRY.length || 1;

    const colors: Record<string, string> = {
      academic: '#2563eb',
      planning: '#059669',
      career: '#d97706',
      documents: '#7c3aed',
      tracking: '#0284c7',
      organization: '#db2777',
    };

    return Object.entries(counts).map(([cat, count]) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      count,
      color: colors[cat] || '#64748b',
      percentage: Math.round((count / total) * 100),
    }));
  },

  // =========================================================================
  // 4. CURRICULUM METRICS & DISTRIBUTION
  // =========================================================================

  async getCurriculumMetrics() {
    const versions: CurriculumVersionRecord[] = await adminService.getCurriculumVersions();
    const total = versions.length;

    const byScheme: Record<string, number> = {};
    const byStatus: Record<string, number> = {
      ACTIVE: 0,
      VERIFIED: 0,
      REVIEW: 0,
      VALIDATE: 0,
      DRAFT: 0,
      DEPRECATED: 0,
    };

    let totalCourses = 0;

    versions.forEach((v) => {
      byScheme[v.scheme] = (byScheme[v.scheme] || 0) + 1;
      if (byStatus[v.status] !== undefined) {
        byStatus[v.status]++;
      }
      totalCourses += v.coursesCount || 0;
    });

    const schemeDistribution: CategoryDistribution[] = Object.entries(byScheme).map(([scheme, count], idx) => {
      const palette = ['#2563eb', '#7c3aed', '#059669', '#d97706'];
      return {
        label: `VTU ${scheme} Scheme`,
        count,
        color: palette[idx % palette.length],
        percentage: Math.round((count / (total || 1)) * 100),
      };
    });

    const statusDistribution: CategoryDistribution[] = [
      { label: 'Active', count: byStatus.ACTIVE, color: '#10b981' },
      { label: 'Verified', count: byStatus.VERIFIED, color: '#3b82f6' },
      { label: 'Review', count: byStatus.REVIEW, color: '#8b5cf6' },
      { label: 'Draft / Validate', count: byStatus.DRAFT + byStatus.VALIDATE, color: '#64748b' },
      { label: 'Deprecated', count: byStatus.DEPRECATED, color: '#ef4444' },
    ].filter((s) => s.count > 0);

    return {
      total,
      active: byStatus.ACTIVE,
      verified: byStatus.VERIFIED,
      totalCourses,
      schemeDistribution,
      statusDistribution,
    };
  },

  // =========================================================================
  // 5. PRIVACY-SAFE PLATFORM EVENTS & TIME-SERIES
  // =========================================================================

  async getPlatformActivityMetrics(
    period: DateRangePeriod,
    filterCategory: 'all' | 'tool' | 'student' | 'account' | 'system' = 'all',
    customStart?: string,
    customEnd?: string
  ) {
    const boundaries = this.getDateRangeBoundaries(period, customStart, customEnd);
    let events = MockStorageProvider.getPlatformEvents();

    if (filterCategory !== 'all') {
      events = events.filter((e) => e.category === filterCategory);
    }

    const filteredEvents = events.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= boundaries.currentStart && t <= boundaries.currentEnd;
    });

    const points: TimeSeriesPoint[] = [];
    const stepDays = boundaries.daysCount <= 1 ? 1 : boundaries.daysCount <= 14 ? 1 : boundaries.daysCount <= 60 ? 2 : 5;
    const startMs = boundaries.currentStart.getTime();
    const endMs = boundaries.currentEnd.getTime();

    for (let t = startMs; t <= endMs; t += stepDays * 864e5) {
      const slotStart = new Date(t);
      const slotEnd = new Date(Math.min(t + stepDays * 864e5, endMs));

      const count = filteredEvents.filter((e) => {
        const d = new Date(e.timestamp);
        return d >= slotStart && d <= slotEnd;
      }).length;

      points.push({
        date: slotStart.toISOString().split('T')[0],
        label: slotStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: count,
      });
    }

    // Event type counts
    const typeCounts: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      typeCounts[e.eventType] = (typeCounts[e.eventType] || 0) + 1;
    });

    return {
      totalEvents: filteredEvents.length,
      timeSeries: points,
      typeCounts,
    };
  },

  // =========================================================================
  // 6. ERROR METRICS & SEVERITIES
  // =========================================================================

  async getErrorMetrics(period: DateRangePeriod, customStart?: string, customEnd?: string) {
    const boundaries = this.getDateRangeBoundaries(period, customStart, customEnd);
    const errors: PlatformErrorRecord[] = await adminService.getSystemErrors();

    const periodErrors = errors.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= boundaries.currentStart && t <= boundaries.currentEnd;
    });

    const unresolved = periodErrors.filter((e) => e.status !== 'RESOLVED').length;

    const severityCounts: Record<string, number> = {
      INFO: 0,
      WARNING: 0,
      ERROR: 0,
      CRITICAL: 0,
    };

    periodErrors.forEach((e) => {
      const sev = e.severity || 'ERROR';
      if (severityCounts[sev] !== undefined) {
        severityCounts[sev]++;
      }
    });

    const severityDistribution: CategoryDistribution[] = [
      { label: 'Critical', count: severityCounts.CRITICAL, color: '#dc2626' },
      { label: 'Error', count: severityCounts.ERROR, color: '#ef4444' },
      { label: 'Warning', count: severityCounts.WARNING, color: '#f59e0b' },
      { label: 'Info', count: severityCounts.INFO, color: '#3b82f6' },
    ].filter((s) => s.count > 0);

    // Time-series
    const points: TimeSeriesPoint[] = [];
    const stepDays = boundaries.daysCount <= 1 ? 1 : boundaries.daysCount <= 14 ? 1 : 3;
    const startMs = boundaries.currentStart.getTime();
    const endMs = boundaries.currentEnd.getTime();

    for (let t = startMs; t <= endMs; t += stepDays * 864e5) {
      const slotStart = new Date(t);
      const slotEnd = new Date(Math.min(t + stepDays * 864e5, endMs));

      const count = periodErrors.filter((e) => {
        const d = new Date(e.timestamp);
        return d >= slotStart && d <= slotEnd;
      }).length;

      points.push({
        date: slotStart.toISOString().split('T')[0],
        label: slotStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: count,
      });
    }

    return {
      totalInPeriod: periodErrors.length,
      unresolved,
      severityDistribution,
      timeSeries: points,
    };
  },

  // =========================================================================
  // 7. SYSTEM HEALTH CHECK OVERVIEW
  // =========================================================================

  async getSystemHealth(): Promise<SystemHealthCheck[]> {
    return adminService.runSystemHealthChecks();
  },

  // =========================================================================
  // 7b. PRODUCTION OBSERVABILITY & REAL METRICS (Section 25)
  // Strictly truthful metrics. If empty, returns "No production data yet".
  // =========================================================================

  async getObservabilityMetrics() {
    const apiSummary = telemetry.getApiMetricsSummary();
    const opSummaries = telemetry.getAllSummaries();

    const hasData = apiSummary.totalRequests > 0 || opSummaries.length > 0;

    if (!hasData) {
      return {
        hasData: false,
        displayMessage: 'No production data yet',
        totalRequests: 0,
        successfulOperations: 0,
        failures: 0,
        errorRate: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        byEndpoint: {},
        byProvider: {},
      };
    }

    const opSucceeded = opSummaries.reduce((acc, s) => acc + s.succeeded, 0);
    const opFailed = opSummaries.reduce((acc, s) => acc + s.failed, 0);

    return {
      hasData: true,
      displayMessage: null,
      totalRequests: apiSummary.totalRequests,
      successfulOperations: (apiSummary.totalRequests - apiSummary.errorCount) + opSucceeded,
      failures: apiSummary.errorCount + opFailed,
      errorRate: apiSummary.errorRate,
      p50DurationMs: apiSummary.p50DurationMs,
      p95DurationMs: apiSummary.p95DurationMs,
      byEndpoint: apiSummary.byEndpoint,
      byProvider: apiSummary.byProvider,
    };
  },

  // =========================================================================
  // 8. RECENT DATA LISTS (SERVER-SIDE LIMITS)
  // =========================================================================

  async getRecentUsers(limit = 6): Promise<Array<Omit<UserProfile, 'avatarUrl'> & { status: UserAccountStatus }>> {
    const res = await adminService.listUsers({ page: 1, limit });
    return res.users;
  },

  async getRecentAuditLogs(limit = 6): Promise<AuditLogRecord[]> {
    const logs = await adminService.getAuditLogs();
    return logs.slice(0, limit);
  },

  async getRecentErrors(limit = 6): Promise<PlatformErrorRecord[]> {
    const errors = await adminService.getSystemErrors();
    return errors.slice(0, limit);
  },

  // =========================================================================
  // 9. COMPLETE DASHBOARD OVERVIEW AGGREGATION
  // =========================================================================

  async getDashboardOverview(period: DateRangePeriod, customStart?: string, customEnd?: string) {
    const [
      userMetrics,
      userGrowthSeries,
      newUsersSeries,
      accountStatusDist,
      toolMetrics,
      studentToolsDist,
      curriculumMetrics,
      activityMetrics,
      errorMetrics,
      systemHealth,
      recentUsers,
      recentAudit,
      recentErrors,
      settings,
    ] = await Promise.all([
      this.getUserMetrics(period, customStart, customEnd),
      this.getUserGrowthTimeSeries(period, customStart, customEnd),
      this.getNewUsersTimeSeries(period, customStart, customEnd),
      this.getAccountStatusDistribution(),
      this.getToolMetrics(),
      this.getStudentToolsDistribution(),
      this.getCurriculumMetrics(),
      this.getPlatformActivityMetrics(period, 'all', customStart, customEnd),
      this.getErrorMetrics(period, customStart, customEnd),
      this.getSystemHealth(),
      this.getRecentUsers(6),
      this.getRecentAuditLogs(6),
      this.getRecentErrors(6),
      adminService.getPlatformSettings(),
    ]);

    const hasCritical = systemHealth.some((h) => h.status === 'UNAVAILABLE');
    const hasWarning = systemHealth.some((h) => h.status === 'WARNING') || errorMetrics.unresolved > 5;
    const systemStatus: 'Healthy' | 'Warning' | 'Critical' = hasCritical
      ? 'Critical'
      : hasWarning
      ? 'Warning'
      : 'Healthy';

    const kpis: DashboardKPIs = {
      totalUsers: userMetrics.totalUsers,
      newUsers: userMetrics.newUsers,
      previousPeriodNewUsers: userMetrics.previousNewUsers,
      newUsersChangePct: userMetrics.trend.percentage,
      newUsersDiff: userMetrics.trend.diff,
      activeUsers: userMetrics.activeUsers,
      activeUsersLabel: userMetrics.activeUsersLabel,
      freeUsers: userMetrics.freeUsers,
      proUsers: userMetrics.proUsers,
      suspendedUsers: userMetrics.suspendedUsers,
      totalTools: toolMetrics.total,
      enabledTools: toolMetrics.available,
      disabledTools: toolMetrics.disabled,
      betaTools: toolMetrics.beta,
      comingSoonTools: toolMetrics.comingSoon,
      maintenanceTools: toolMetrics.maintenance,
      studentToolsCount: STUDENT_TOOLS_REGISTRY.length,
      activeFeatures: featureServerStore.getAggregateMetrics().active,
      disabledFeatures: featureServerStore.getAggregateMetrics().disabled,
      freeFeatures: featureServerStore.getAggregateMetrics().free,
      subscriptionFeatures: featureServerStore.getAggregateMetrics().subscription,
      curriculumCount: curriculumMetrics.total,
      verifiedCurriculumCount: curriculumMetrics.verified + curriculumMetrics.active,
      openErrorsCount: errorMetrics.unresolved,
      systemStatus,
      maintenanceMode: settings.maintenanceMode,
      version: '11.0.0-phase11',
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    return {
      kpis,
      userGrowthSeries,
      newUsersSeries,
      accountStatusDist,
      toolMetrics,
      studentToolsDist,
      curriculumMetrics,
      activityMetrics,
      errorMetrics,
      systemHealth,
      recentUsers,
      recentAudit,
      recentErrors,
    };
  },
};
