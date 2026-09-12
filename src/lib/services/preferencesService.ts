import { UserPreferences } from '@/types/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/client';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const preferencesService = {
  async getPreferences(): Promise<UserPreferences> {
    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) {
          // Fallback to localStorage autoDownload
          const localVal = typeof localStorage !== 'undefined'
            ? localStorage.getItem('saarvi_autodownload_enabled') ?? localStorage.getItem('docease_autodownload_enabled')
            : null;
          const localAuto = localVal !== 'false';
          return {
            userId: 'guest',
            autoDownload: localAuto,
            theme: 'light',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return MockStorageProvider.getPreferences(session.id);
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        const localVal = typeof localStorage !== 'undefined'
          ? localStorage.getItem('saarvi_autodownload_enabled') ?? localStorage.getItem('docease_autodownload_enabled')
          : null;
        const localAuto = localVal !== 'false';
        return {
          userId: 'guest',
          autoDownload: localAuto,
          theme: 'light',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error || !data) {
        return {
          userId: session.user.id,
          autoDownload: true,
          theme: 'light',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        userId: data.user_id,
        autoDownload: data.auto_download,
        theme: data.theme || 'light',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return {
        userId: 'guest',
        autoDownload: true,
        theme: 'light',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  async updatePreferences(updates: { autoDownload?: boolean }): Promise<void> {
    if (typeof localStorage !== 'undefined' && updates.autoDownload !== undefined) {
      localStorage.setItem('saarvi_autodownload_enabled', updates.autoDownload ? 'true' : 'false');
    }

    try {
      if (!isSupabaseConfigured()) {
        const session = MockStorageProvider.getCurrentSession();
        if (!session) return;
        MockStorageProvider.updatePreferences(session.id, updates);
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('user_preferences')
        .upsert({
          user_id: session.user.id,
          auto_download: updates.autoDownload,
          theme: 'light',
          updated_at: new Date().toISOString(),
        });
    } catch (err) {
      console.warn('Could not sync preferences to cloud:', err);
    }
  },
};
