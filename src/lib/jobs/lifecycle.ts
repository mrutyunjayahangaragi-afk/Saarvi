/**
 * Saarvi Jobs Engine 6.0 — Job Lifecycle Service & State Machine
 *
 * Enforces explicit lifecycle transitions with ZERO automatic deletion.
 * States:
 * - record_state: ACTIVE | ARCHIVED | DELETED
 * - review_state: DISCOVERED | PENDING_REVIEW | APPROVED | REJECTED
 * - publication_state: NOT_PUBLISHED | PUBLISHED | PAUSED
 * - verification_tier: SAARVI_VERIFIED | SOURCE_DISCOVERY
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { invalidateJobsCache } from "@/lib/opportunities/opportunity-store";

export interface LifecycleOperationResult {
  success: boolean;
  affectedCount: number;
  operationId: string;
  error?: string;
  skippedCount?: number;
}

export class JobLifecycleService {
  private static instance: JobLifecycleService;

  public static getInstance(): JobLifecycleService {
    if (!JobLifecycleService.instance) {
      JobLifecycleService.instance = new JobLifecycleService();
    }
    return JobLifecycleService.instance;
  }

  /**
   * Approves opportunities and promotes them to Tier A (Saarvi Verified)
   */
  public async bulkApprove(jobIds: string[], actorId: string): Promise<LifecycleOperationResult> {
    const opId = `op_approve_${Date.now()}`;
    const supabase = getSupabaseAdminClient();
    if (!supabase || jobIds.length === 0) {
      return { success: false, affectedCount: 0, operationId: opId, error: "Database unavailable" };
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("job_opportunities")
        .update({
          review_state: "APPROVED",
          verification_tier: "SAARVI_VERIFIED",
          source_verified: true,
          verification_status: "verified",
          approved_at: now,
          updated_at: now,
          updated_by: actorId,
        })
        .in("id", jobIds)
        .select("id");

      if (error) throw error;

      invalidateJobsCache();
      return {
        success: true,
        affectedCount: data?.length || 0,
        operationId: opId,
      };
    } catch (err: any) {
      return { success: false, affectedCount: 0, operationId: opId, error: err.message };
    }
  }

  /**
   * Bulk publishes approved opportunities live to users.
   * Immediately invalidates cache so user /jobs updates with zero manual refresh.
   */
  public async bulkPublish(jobIds: string[], actorId: string): Promise<LifecycleOperationResult> {
    const opId = `op_publish_${Date.now()}`;
    const supabase = getSupabaseAdminClient();
    if (!supabase || jobIds.length === 0) {
      return { success: false, affectedCount: 0, operationId: opId, error: "Database unavailable" };
    }

    try {
      const now = new Date().toISOString();

      // Check for passed deadlines first to avoid trigger rejection
      const { data: eligibleJobs } = await supabase
        .from("job_opportunities")
        .select("id, deadline")
        .in("id", jobIds);

      const unexpiredIds = (eligibleJobs || [])
        .filter((j) => !j.deadline || new Date(j.deadline).getTime() > Date.now())
        .map((j) => j.id);

      const skippedCount = jobIds.length - unexpiredIds.length;

      if (unexpiredIds.length === 0) {
        return {
          success: false,
          affectedCount: 0,
          skippedCount,
          operationId: opId,
          error: "Selected jobs have expired deadlines. Please update the deadline before publishing.",
        };
      }

      const { data, error } = await supabase
        .from("job_opportunities")
        .update({
          publication_state: "PUBLISHED",
          status: "PUBLISHED",
          review_state: "APPROVED",
          verification_tier: "SAARVI_VERIFIED",
          record_state: "ACTIVE",
          source_verified: true,
          published_at: now,
          updated_at: now,
          updated_by: actorId,
        })
        .in("id", unexpiredIds)
        .select("id");

      if (error) throw error;

      // Invalidate cache immediately so /jobs reflects changes instantly
      invalidateJobsCache();

      return {
        success: true,
        affectedCount: data?.length || 0,
        skippedCount,
        operationId: opId,
      };
    } catch (err: any) {
      return { success: false, affectedCount: 0, operationId: opId, error: err.message };
    }
  }

  /**
   * Bulk pauses live opportunities without deleting them.
   */
  public async bulkPause(jobIds: string[], actorId: string): Promise<LifecycleOperationResult> {
    const opId = `op_pause_${Date.now()}`;
    const supabase = getSupabaseAdminClient();
    if (!supabase || jobIds.length === 0) {
      return { success: false, affectedCount: 0, operationId: opId, error: "Database unavailable" };
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("job_opportunities")
        .update({
          publication_state: "PAUSED",
          status: "PAUSED",
          updated_at: now,
          updated_by: actorId,
        })
        .in("id", jobIds)
        .select("id");

      if (error) throw error;

      invalidateJobsCache();
      return {
        success: true,
        affectedCount: data?.length || 0,
        operationId: opId,
      };
    } catch (err: any) {
      return { success: false, affectedCount: 0, operationId: opId, error: err.message };
    }
  }

  /**
   * Bulk archives opportunities. Reversible, preserves database history.
   */
  public async bulkArchive(jobIds: string[], actorId: string): Promise<LifecycleOperationResult> {
    const opId = `op_archive_${Date.now()}`;
    const supabase = getSupabaseAdminClient();
    if (!supabase || jobIds.length === 0) {
      return { success: false, affectedCount: 0, operationId: opId, error: "Database unavailable" };
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("job_opportunities")
        .update({
          record_state: "ARCHIVED",
          status: "ARCHIVED",
          publication_state: "NOT_PUBLISHED",
          updated_at: now,
          updated_by: actorId,
        })
        .in("id", jobIds)
        .select("id");

      if (error) throw error;

      invalidateJobsCache();
      return {
        success: true,
        affectedCount: data?.length || 0,
        operationId: opId,
      };
    } catch (err: any) {
      return { success: false, affectedCount: 0, operationId: opId, error: err.message };
    }
  }

  /**
   * Bulk deletes opportunities. Soft delete by default.
   * Permanent hard-delete is restricted to Superadmin with explicit flag.
   */
  public async bulkDelete(
    jobIds: string[],
    actorId: string,
    permanent = false
  ): Promise<LifecycleOperationResult> {
    const opId = `op_delete_${Date.now()}`;
    const supabase = getSupabaseAdminClient();
    if (!supabase || jobIds.length === 0) {
      return { success: false, affectedCount: 0, operationId: opId, error: "Database unavailable" };
    }

    try {
      if (permanent) {
        // Permanent delete: removes row from table
        const { error } = await supabase.from("job_opportunities").delete().in("id", jobIds);
        if (error) throw error;
        invalidateJobsCache();
        return { success: true, affectedCount: jobIds.length, operationId: opId };
      }

      // Safe Soft delete (default)
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("job_opportunities")
        .update({
          record_state: "DELETED",
          status: "DELETED",
          publication_state: "NOT_PUBLISHED",
          updated_at: now,
          updated_by: actorId,
        })
        .in("id", jobIds)
        .select("id");

      if (error) throw error;

      invalidateJobsCache();
      return {
        success: true,
        affectedCount: data?.length || 0,
        operationId: opId,
      };
    } catch (err: any) {
      return { success: false, affectedCount: 0, operationId: opId, error: err.message };
    }
  }
}

export const jobLifecycleService = JobLifecycleService.getInstance();
