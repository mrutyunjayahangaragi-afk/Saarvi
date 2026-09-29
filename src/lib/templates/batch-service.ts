import crypto from 'crypto';
import JSZip from 'jszip';
import { getSupabaseAdminClient } from '../supabase/admin.ts';
import { isSupabaseConfigured } from '../supabase/config.ts';
import type {
  TemplateImportBatch,
  TemplateImportTask,
  DocumentType,
  CareerTemplate,
} from './types.ts';
import { TemplateCompiler } from './compiler.ts';
import { TemplateRepository } from './repository.ts';

const inMemoryBatchStore = new Map<string, TemplateImportBatch>();

export interface RawUploadFile {
  filename: string;
  buffer: Buffer;
  size: number;
}

export class TemplateBatchService {
  /**
   * Unpacks a ZIP file safely or returns direct file list.
   * Protects against zip bombs, path traversal, and excessive file sizes.
   */
  public static async inspectAndExtractFiles(
    files: RawUploadFile[]
  ): Promise<RawUploadFile[]> {
    const extractedFiles: RawUploadFile[] = [];
    const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB limit
    const MAX_FILES_LIMIT = 50;

    let totalExtractedBytes = 0;

    for (const file of files) {
      const lower = file.filename.toLowerCase();

      if (lower.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file.buffer);
        const entries = Object.keys(zip.files);

        if (entries.length > MAX_FILES_LIMIT) {
          throw new Error(`ZIP contains too many files (${entries.length}). Maximum allowed is ${MAX_FILES_LIMIT}.`);
        }

        for (const filename of entries) {
          const entry = zip.files[filename];
          if (entry.dir) continue;

          // Prevent path traversal
          if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
            continue;
          }

          // Filter supported template extensions
          const entryLower = filename.toLowerCase();
          if (!entryLower.endsWith('.pdf') && !entryLower.endsWith('.png') && !entryLower.endsWith('.jpg') && !entryLower.endsWith('.svg')) {
            continue;
          }

          const buf = await entry.async('nodebuffer');
          totalExtractedBytes += buf.length;

          if (totalExtractedBytes > MAX_UNCOMPRESSED_BYTES) {
            throw new Error(`Uncompressed ZIP content exceeds safety limit of 50MB.`);
          }

          extractedFiles.push({
            filename: filename.split('/').pop() || filename,
            buffer: buf,
            size: buf.length,
          });

          if (extractedFiles.length >= MAX_FILES_LIMIT) break;
        }
      } else {
        extractedFiles.push(file);
      }
    }

    return extractedFiles;
  }

  /**
   * Creates a new template import batch and queues tasks.
   */
  public static async createBatch(
    batchName: string,
    documentType: DocumentType,
    files: RawUploadFile[],
    createdBy?: string
  ): Promise<TemplateImportBatch> {
    const batchId = crypto.randomUUID();
    const tasks: TemplateImportTask[] = files.map((f, idx) => ({
      id: `task_${batchId}_${idx + 1}`,
      filename: f.filename,
      fileSize: f.size,
      fileHash: crypto.createHash('sha256').update(f.buffer).digest('hex'),
      documentType,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const batch: TemplateImportBatch = {
      id: batchId,
      batchName,
      documentType,
      totalFiles: tasks.length,
      processedCount: 0,
      needsReviewCount: 0,
      readyCount: 0,
      failedCount: 0,
      publishedCount: 0,
      status: 'QUEUED',
      tasks,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryBatchStore.set(batchId, batch);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase.from('template_import_batches').insert({
          id: batch.id,
          batch_name: batch.batchName,
          document_type: batch.documentType,
          total_files: batch.totalFiles,
          processed_count: batch.processedCount,
          needs_review_count: batch.needsReviewCount,
          ready_count: batch.readyCount,
          failed_count: batch.failedCount,
          published_count: batch.publishedCount,
          status: batch.status,
          tasks: batch.tasks,
          created_by: batch.createdBy,
          created_at: batch.createdAt,
          updated_at: batch.updatedAt,
        });
      }
    }

    const initialSnapshot: TemplateImportBatch = JSON.parse(JSON.stringify(batch));

    // Start background bounded worker processing (asynchronous non-blocking)
    setTimeout(() => {
      this.processBatchAsync(batchId, files).catch((err) => {
        console.error(`[TemplateBatchService] Batch processing failed: ${err.message}`);
      });
    }, 10);

    return initialSnapshot;
  }

  /**
   * Retrieves batch details and current progress.
   */
  public static async getBatchById(id: string): Promise<TemplateImportBatch | null> {
    if (inMemoryBatchStore.has(id)) {
      return inMemoryBatchStore.get(id)!;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data } = await supabase
          .from('template_import_batches')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (data) {
          const batch: TemplateImportBatch = {
            id: data.id,
            batchName: data.batch_name,
            documentType: data.document_type as DocumentType,
            totalFiles: data.total_files,
            processedCount: data.processed_count,
            needsReviewCount: data.needs_review_count,
            readyCount: data.ready_count,
            failedCount: data.failed_count,
            publishedCount: data.published_count,
            status: data.status,
            tasks: data.tasks || [],
            createdBy: data.created_by,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          inMemoryBatchStore.set(id, batch);
          return batch;
        }
      }
    }

    return null;
  }

  /**
   * Bounded concurrency worker pool to process files safely.
   */
  private static async processBatchAsync(
    batchId: string,
    files: RawUploadFile[]
  ): Promise<void> {
    const batch = inMemoryBatchStore.get(batchId);
    if (!batch) return;

    batch.status = 'PROCESSING';
    await this.syncBatch(batch);

    const CONCURRENCY_LIMIT = 3;
    let fileIndex = 0;

    const worker = async () => {
      while (fileIndex < files.length) {
        const currentIdx = fileIndex++;
        const file = files[currentIdx];
        const task = batch.tasks[currentIdx];
        if (!task || task.status === 'READY' || task.status === 'PUBLISHED') continue;

        task.status = 'PROCESSING';
        await this.syncBatch(batch);

        try {
          // 1. Idempotency Duplicate Detection via SHA-256
          const existingTpl = await TemplateRepository.findByHash(task.fileHash);
          if (existingTpl) {
            task.status = 'FAILED';
            task.errorReason = `Already imported: Matches existing template "${existingTpl.name}" (ID: ${existingTpl.id})`;
            batch.failedCount++;
            batch.processedCount++;
            continue;
          }

          // 2. Preflight & Compile
          task.status = 'ANALYZING';
          const compileResult = await TemplateCompiler.compile(
            file.buffer,
            file.filename,
            batch.documentType
          );

          task.detectedFields = compileResult.detectedFields;
          task.detectedSections = compileResult.detectedSections;
          task.candidateSchema = compileResult.schema;
          task.qualityReport = compileResult.qualityReport;
          task.sampleData = compileResult.sampleData;

          // Auto-save candidate template to repository in DRAFT / NEEDS_REVIEW
          const candidateTemplate: CareerTemplate = {
            id: compileResult.schema.templateId,
            documentType: batch.documentType,
            name: file.filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            description: `Auto-compiled template from ${file.filename}`,
            category: 'STANDARD',
            version: 1,
            status: compileResult.qualityReport.fieldMapping === 'PASS' ? 'APPROVED' : 'NEEDS_REVIEW',
            isActive: true,
            isPro: false,
            isFeatured: false,
            sortOrder: 10 + currentIdx,
            primaryColor: compileResult.schema.primaryColor,
            fontFamily: compileResult.schema.fontFamily,
            layout: compileResult.layout,
            pageSize: compileResult.pageSize,
            margins: compileResult.schema.margins,
            schema: compileResult.schema,
            sampleData: compileResult.sampleData,
            fileHash: task.fileHash,
            source: 'Reference Recreation',
            license: 'Saarvi Original',
            rightsVerified: true,
            createdBy: batch.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await TemplateRepository.saveTemplate(candidateTemplate);

          if (compileResult.qualityReport.fieldMapping === 'REVIEW') {
            task.status = 'NEEDS_REVIEW';
            batch.needsReviewCount++;
          } else {
            task.status = 'READY';
            batch.readyCount++;
          }
          batch.processedCount++;
        } catch (err: unknown) {
          task.status = 'FAILED';
          task.errorReason = err instanceof Error ? err.message : 'Compilation error';
          batch.failedCount++;
          batch.processedCount++;
        } finally {
          task.updatedAt = new Date().toISOString();
          await this.syncBatch(batch);
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, files.length) }, () => worker());
    await Promise.all(workers);

    batch.status =
      batch.failedCount === 0
        ? 'COMPLETED'
        : batch.processedCount === batch.failedCount
        ? 'FAILED'
        : 'PARTIAL_SUCCESS';
    batch.updatedAt = new Date().toISOString();
    await this.syncBatch(batch);
  }

  /**
   * Retries all failed tasks within a batch without re-running completed ones.
   */
  public static async retryFailedTasks(
    batchId: string,
    files: RawUploadFile[]
  ): Promise<TemplateImportBatch | null> {
    const batch = await this.getBatchById(batchId);
    if (!batch) return null;

    const failedTasks = batch.tasks.filter((t) => t.status === 'FAILED');
    if (failedTasks.length === 0) return batch;

    // Reset failed tasks back to QUEUED
    for (const t of failedTasks) {
      t.status = 'QUEUED';
      t.errorReason = undefined;
    }
    batch.failedCount -= failedTasks.length;
    batch.processedCount -= failedTasks.length;
    batch.status = 'PROCESSING';
    await this.syncBatch(batch);

    const filesToRetry = files.filter((f) => {
      const hash = crypto.createHash('sha256').update(f.buffer).digest('hex');
      return failedTasks.some((t) => t.fileHash === hash);
    });

    this.processBatchAsync(batchId, filesToRetry).catch((err) => {
      console.error(`[TemplateBatchService] Retry failed: ${err.message}`);
    });

    return batch;
  }

  private static async syncBatch(batch: TemplateImportBatch): Promise<void> {
    inMemoryBatchStore.set(batch.id, batch);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase
          .from('template_import_batches')
          .update({
            total_files: batch.totalFiles,
            processed_count: batch.processedCount,
            needs_review_count: batch.needsReviewCount,
            ready_count: batch.readyCount,
            failed_count: batch.failedCount,
            published_count: batch.publishedCount,
            status: batch.status,
            tasks: batch.tasks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch.id);
      }
    }
  }
}
