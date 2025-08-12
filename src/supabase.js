// src/supabase.js
import { createClient } from '@supabase/supabase-js';

/**
 * Read env vars from CRA, Vite, or Next — works in Preview & Production.
 */
export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  process.env.REACT_APP_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Helpful hint if something's missing at runtime (no secrets printed)
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error('[supabase] Missing env vars at runtime', {
    hasUrl: !!SUPABASE_URL,
    hasAnon: !!SUPABASE_ANON_KEY,
  });
}

/**
 * Create a client and FORCE the apikey header on every request (auth/rest/storage).
 * This prevents "No API key found" even if some env wiring differs in Preview.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      apikey: SUPABASE_ANON_KEY,
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});



export const maintenanceAPI = {
  async submitReport(reportData) {
  // Destructure coordinates so it's NOT passed to DB
  const { coordinates, ...rest } = reportData;

  const { data, error } = await supabase
    .from('maintenance_reports')
    .insert([{
      ...rest,
      latitude: coordinates?.lat,
      longitude: coordinates?.lng
    }])
    .select();

  if (error) throw error;
  return data[0];
},


  async getReports() {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .select(`*, attachments(*)`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async uploadFile(file, reportId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${reportId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('maintenance-files')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('maintenance-files')
      .getPublicUrl(fileName);

    return { path: data.path, url: publicUrl };
  },

  async saveAttachment(attachmentData) {
    const { data, error } = await supabase
      .from('attachments')
      .insert([attachmentData])
      .select();

    if (error) throw error;
    return data[0];
  }
};
