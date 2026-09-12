export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ToolOperation<TConfig, TResult> {
  id: string;
  validate(files: File[], config?: TConfig): ValidationResult;
  execute(
    files: File[],
    config: TConfig,
    onProgress?: (percent: number) => void
  ): Promise<TResult>;
}

export interface SingleFileResult {
  type: "single";
  blob: Blob;
  filename: string;
  originalSize: number;
  newSize: number;
  details?: Record<string, string | number>;
}

export interface MultiFileResult {
  type: "multiple";
  files: {
    blob: Blob;
    filename: string;
    url: string;
    size: number;
  }[];
  zipBlob: Blob;
  zipFilename: string;
  originalSize: number;
  newSize: number;
}
