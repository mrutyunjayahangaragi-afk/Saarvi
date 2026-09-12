import { ConversionHistoryRecord } from '@/types/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/client';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export interface RecordConversionParams {
  toolId: string;
  toolName?: string;
  inputFilename: string;
  outputFilename: string;
  inputSize: number;
  outputSize: number;
  status?: 'Completed' | 'Failed';
  processingTimeMs: number;
}

export const conversionHistoryService = {
  /**
   * Asynchronously records conversion metadata for an authenticated user.
   * STRICT PRIVACY RULE: Zero document bytes or text content are ever transmitted or stored.
   * NON-BLOCKING: If this fails or if the user is unauthenticated, it catches silently and never disrupts the download.
   */
  async recordConversion(params: RecordConversionParams): Promise<ConversionHistoryRecord | null> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) return null;

        return MockStorageProvider.recordConversion({
          userId: session.id,
          toolId: params.toolId,
          toolName: params.toolName,
          inputFilename: params.inputFilename,
          outputFilename: params.outputFilename,
          inputSize: params.inputSize,
          outputSize: params.outputSize,
          status: params.status || 'Completed',
          processingTimeMs: params.processingTimeMs,
        });
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('conversion_history')
        .insert({
          user_id: session.user.id,
          tool_id: params.toolId,
          input_filename: params.inputFilename,
          output_filename: params.outputFilename,
          input_size: params.inputSize,
          output_size: params.outputSize,
          status: params.status || 'Completed',
          processing_time_ms: params.processingTimeMs,
        })
        .select()
        .single();

      if (error || !data) {
        console.warn('Could not record conversion history metadata:', error);
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        toolId: data.tool_id,
        toolName: params.toolName,
        inputFilename: data.input_filename,
        outputFilename: data.output_filename,
        inputSize: data.input_size,
        outputSize: data.output_size,
        status: data.status,
        processingTimeMs: data.processing_time_ms,
        createdAt: data.created_at,
      };
    } catch (err) {
      console.warn('Non-blocking conversion history error:', err);
      return null;
    }
  },

  /**
   * Retrieves the authenticated user's conversion history records.
   * RLS Protected: A user can only fetch their own records.
   */
  async getHistory(): Promise<ConversionHistoryRecord[]> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) return [];
        return MockStorageProvider.getConversionHistory(session.id);
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('conversion_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((item) => ({
        id: item.id,
        userId: item.user_id,
        toolId: item.tool_id,
        inputFilename: item.input_filename,
        outputFilename: item.output_filename,
        inputSize: item.input_size,
        outputSize: item.output_size,
        status: item.status,
        processingTimeMs: item.processing_time_ms,
        createdAt: item.created_at,
      }));
    } catch (err) {
      console.error('Error fetching conversion history:', err);
      return [];
    }
  },

  /**
   * Clears the authenticated user's conversion history records.
   */
  async clearHistory(): Promise<void> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) return;
        MockStorageProvider.clearConversionHistory(session.id);
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('conversion_history')
        .delete()
        .eq('user_id', session.user.id);
    } catch (err) {
      console.error('Error clearing conversion history:', err);
    }
  },

  /**
   * Deletes a single conversion history record belonging to the current user.
   * RLS Protected: User can only delete their own records.
   */
  async deleteRecord(id: string): Promise<void> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) return;
        MockStorageProvider.deleteConversionRecord(session.id, id);
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('conversion_history')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id); // RLS double-check at query level
    } catch (err) {
      console.error('Error deleting conversion record:', err);
      throw err;
    }
  },
};
