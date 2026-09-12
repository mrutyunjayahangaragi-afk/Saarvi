import { SavedResumeDraft } from '@/types/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/client';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { SAMPLE_STUDENT_RESUME } from '@/lib/tools/resume/starter-data';

export const resumeService = {
  /**
   * Retrieves all saved resume drafts for the current user.
   * RLS Protected: User A cannot access User B's resumes.
   */
  async getResumes(): Promise<SavedResumeDraft[]> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) return [];
        return MockStorageProvider.getResumes(session.id);
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error || !data) return [];

      return data.map((item) => ({
        id: item.id,
        userId: item.user_id,
        title: item.title,
        template: item.template,
        content: item.content_json,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    } catch (err) {
      console.error('Error fetching resumes:', err);
      return [];
    }
  },

  /**
   * Retrieves a single saved resume draft by ID.
   */
  async getResumeById(id: string): Promise<SavedResumeDraft | null> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) return null;
        return MockStorageProvider.getResumes(session.id).find((r) => r.id === id) || null;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        template: data.template,
        content: data.content_json,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return null;
    }
  },

  /**
   * Creates a new structured resume draft.
   */
  async createResume(title: string, template = 'ats-classic', content?: Record<string, unknown>): Promise<SavedResumeDraft | null> {
    const resumeContent = content || (SAMPLE_STUDENT_RESUME as unknown as Record<string, unknown>);
    const resumeTitle = title.trim() || 'Untitled Resume';

    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) throw new Error('You must be logged in to save resumes to your account.');

        return MockStorageProvider.createResume(session.id, resumeTitle, template, resumeContent);
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('You must be logged in to save resumes to your account.');

      const { data, error } = await supabase
        .from('resumes')
        .insert({
          user_id: session.user.id,
          title: resumeTitle,
          template,
          content_json: resumeContent,
        })
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || 'Failed to create resume draft.');

      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        template: data.template,
        content: data.content_json,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.error('Error creating resume:', err);
      throw err;
    }
  },

  /**
   * Updates an existing resume draft.
   */
  async updateResume(id: string, updates: { title?: string; template?: string; content?: Record<string, unknown> }): Promise<SavedResumeDraft | null> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) throw new Error('Unauthorized');
        return MockStorageProvider.updateResume(session.id, id, updates);
      }

      const supabase = createClient();
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.template !== undefined) payload.template = updates.template;
      if (updates.content !== undefined) payload.content_json = updates.content;

      const { data, error } = await supabase
        .from('resumes')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || 'Failed to update resume.');

      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        template: data.template,
        content: data.content_json,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.error('Error updating resume:', err);
      throw err;
    }
  },

  /**
   * Duplicates an existing resume draft.
   */
  async duplicateResume(id: string): Promise<SavedResumeDraft | null> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) throw new Error('Unauthorized');
        return MockStorageProvider.duplicateResume(session.id, id);
      }

      const supabase = createClient();
      const { data: source, error: fetchErr } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !source) throw new Error('Resume not found.');

      return await this.createResume(`${source.title} (Copy)`, source.template, source.content_json);
    } catch (err) {
      console.error('Error duplicating resume:', err);
      throw err;
    }
  },

  /**
   * Deletes a resume draft.
   */
  async deleteResume(id: string): Promise<void> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) throw new Error('Unauthorized');
        MockStorageProvider.deleteResume(session.id, id);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    } catch (err) {
      console.error('Error deleting resume:', err);
      throw err;
    }
  },
};
