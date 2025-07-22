import React, { useState, useEffect, useRef } from 'react';
import { maintenanceAPI } from '../supabase';
import {
  Camera,
  Video,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Home,
  Wrench,
  Star,
  Zap,
  Shield,
  Send,
  FileImage,
  FileVideo,
  X,
  Plus,
  ChevronRight,
  Calendar,
  User,
  Settings
} from 'lucide-react';

const MaintenanceReporter = () => {
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState({
    id: null,
    title: '',
    description: '',
    category: '',
    location: '',
    urgency: 'medium',
    photos: [],
    videos: [],
    status: 'pending',
    dateSubmitted: null,
    coordinates: null,
    address: ''
  });
  const [showForm, setShowForm] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationPermission, setLocationPermission] = useState('prompt');

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Fetch existing reports on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await maintenanceAPI.getReports();
        setReports(data);
      } catch (error) {
        console.error('Error fetching reports:', error);
      }
    })();
  }, []);

  const handleInputChange = (field, value) => {
    setCurrentReport(prev => ({ ...prev, [field]: value }));
  };

  // Get user's current location
  const getCurrentLocation = () => {
    // existing logic...
  };

  const clearLocation = () => {
    setCurrentReport(prev => ({
      ...prev,
      coordinates: null,
      address: ''
    }));
  };

  const handleFileUpload = async (files, type) => {
    // existing file processing logic...
  };

  const removeFile = (fileId, type) => {
    setCurrentReport(prev => ({
      ...prev,
      [type]: prev[type].filter(file => file.id !== fileId)
    }));
  };

  const handleDrag = e => {
    // existing drag logic...
  };

  const handleDrop = e => {
    // existing drop logic...
  };

  const submitReport = async () => {
    if (!currentReport.title || !currentReport.description || !currentReport.category) {
      alert('Please fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      // 1) Insert report
      const saved = await maintenanceAPI.submitReport({
        title: currentReport.title,
        description: currentReport.description,
        category: currentReport.category,
        location: currentReport.location,
        urgency: currentReport.urgency,
        coordinates: currentReport.coordinates,
        address: currentReport.address
      });

      // 2) Upload files & save attachments
      const attachments = [];
      for (let photo of currentReport.photos) {
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
      for (let video of currentReport.videos) {
        const { path, url } = await maintenanceAPI.uploadFile(video.file, saved.id);
        const att = await maintenanceAPI.saveAttachment({
          report_id: saved.id,
          file_name: video.name,
          file_path: path,
          file_type: 'video',
          file_size: video.size,
          duration: video.duration
        });
        attachments.push({ ...att, url });
      }

      // 3) Update UI state
      setReports(prev => [
        {
          ...saved,
          attachments,
          dateSubmitted: saved.created_at
        },
        ...prev
      ]);

      // Reset form
      setCurrentReport({
        id: null,
        title: '',
        description: '',
        category: '',
        location: '',
        urgency: 'medium',
        photos: [],
        videos: [],
        status: 'pending',
        dateSubmitted: null,
        coordinates: null,
        address: ''
      });
      alert('✅ Maintenance request submitted!');
    } catch (error) {
      console.error('Submit error:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // existing render UI code...
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* retain full UI markup as before */}
    </div>
  );
};

export default MaintenanceReporter;