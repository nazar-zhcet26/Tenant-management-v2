import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

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
//new part starts
  / 1. After saving the report, log the result:
console.log('Saved report:', saved);

// 2. Before each attachment insert, log the user and report ID:
for (let photo of currentReport.photos) {
  console.log('About to save attachment with:', {
    report_id: saved.id,
    file_name: photo.name,
    user_id: user.id
  });

  const { path, url } = await maintenanceAPI.uploadFile(photo.file, saved.id);
  const att = await maintenanceAPI.saveAttachment({
    report_id: saved.id,
    file_name: photo.name,
    file_path: path,
    file_type: 'image',
    file_size: photo.size,
    duration: null
  });
  attachments.push({ ...att, url });
}
//new part ends
  async saveAttachment(attachmentData) {
    const { data, error } = await supabase
      .from('attachments')
      .insert([attachmentData])
      .select();

    if (error) throw error;
    return data[0];
  }
};
