import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { TemplateBatchService, type RawUploadFile } from "@/lib/templates/batch-service";
import type { DocumentType } from "@/lib/templates/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const formData = await req.formData();
    const documentType = (formData.get("documentType") || "RESUME") as DocumentType;
    const batchName = (formData.get("batchName") as string) || `Template Batch #${Date.now().toString(36).toUpperCase()}`;

    const fileEntries = formData.getAll("files");
    if (!fileEntries || fileEntries.length === 0) {
      return NextResponse.json({ error: "No template files provided in upload" }, { status: 400 });
    }

    const rawFiles: RawUploadFile[] = [];
    for (const entry of fileEntries) {
      if (typeof entry === "object" && "arrayBuffer" in entry && "name" in entry) {
        const file = entry as File;
        const arrayBuf = await file.arrayBuffer();
        rawFiles.push({
          filename: file.name,
          buffer: Buffer.from(arrayBuf),
          size: file.size,
        });
      }
    }

    // Inspect files & safely extract if ZIP
    const processedFiles = await TemplateBatchService.inspectAndExtractFiles(rawFiles);

    if (processedFiles.length === 0) {
      return NextResponse.json(
        { error: "No valid PDF/template files found in upload." },
        { status: 400 }
      );
    }

    // Create batch & begin bounded async processing
    const batch = await TemplateBatchService.createBatch(
      batchName,
      documentType,
      processedFiles,
      authResult.user.id
    );

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      batchName: batch.batchName,
      totalFiles: batch.totalFiles,
      status: batch.status,
      tasks: batch.tasks,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Batch upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
