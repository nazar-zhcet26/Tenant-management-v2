import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const maintenanceAPI = {
  async submitReport(reportData) {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .insert([{
        ...reportData,
        latitude: reportData.coordinates?.lat,
        longitude: reportData.coordinates?.lng
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