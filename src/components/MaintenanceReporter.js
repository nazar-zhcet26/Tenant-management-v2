import React, { useState, useEffect, useRef } from 'react';
import { maintenanceAPI } from '../supabase';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Upload, AlertCircle, CheckCircle, MapPin, Home, Shield, Zap, Star,
  Send, FileImage, FileVideo, X, Plus, ChevronRight, Calendar, User
} from 'lucide-react';

const categories = [
  { id: 'plumbing', name: 'Plumbing', icon: '🚿', color: 'from-blue-500 to-cyan-500' },
  { id: 'electrical', name: 'Electrical', icon: '⚡', color: 'from-yellow-500 to-orange-500' },
  { id: 'hvac', name: 'HVAC', icon: '❄️', color: 'from-teal-500 to-blue-500' },
  { id: 'appliances', name: 'Appliances', icon: '🏠', color: 'from-purple-500 to-pink-500' },
  { id: 'structural', name: 'Structural', icon: '🏗️', color: 'from-gray-500 to-slate-500' },
  { id: 'pest', name: 'Pest Control', icon: '🐛', color: 'from-green-500 to-emerald-500' },
  { id: 'security', name: 'Locks/Security', icon: '🔒', color: 'from-red-500 to-pink-500' },
  { id: 'windows', name: 'Windows/Doors', icon: '🚪', color: 'from-indigo-500 to-purple-500' },
  { id: 'flooring', name: 'Flooring', icon: '🏠', color: 'from-amber-500 to-yellow-500' },
  { id: 'other', name: 'Other', icon: '🔧', color: 'from-slate-500 to-gray-500' }
];

const urgencyLevels = {
  low:    { label: 'Low Priority',    color: 'from-green-500 to-emerald-500', icon: '🟢', description: 'Can wait a few days' },
  medium: { label: 'Medium Priority', color: 'from-yellow-500 to-amber-500',  icon: '🟡', description: 'Should be addressed soon' },
  high:   { label: 'High Priority',   color: 'from-orange-500 to-red-500',    icon: '🟠', description: 'Needs attention within 24 hours' },
  emergency: { label: 'Emergency',    color: 'from-red-600 to-red-700',       icon: '🚨', description: 'Immediate attention required' }
};

const MaintenanceReporter = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [properties, setProperties] = useState([]); // NEW
  const [currentReport, setCurrentReport] = useState({
    id: null,
    property_id: '', // NEW
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

  // Fetch properties and existing reports on mount
  useEffect(() => {
    // Fetch all properties for dropdown
    (async () => {
      try {
        const { data: propertyData, error: propError } = await supabase
          .from('properties')
          .select('*');
        if (propError) throw propError;
        setProperties(propertyData || []);
      } catch (err) {
        console.error('Error fetching properties:', err.message);
      }
    })();

    // Fetch reports as before
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

  // --- The rest of your code is unchanged ---

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coordinates = { lat: latitude, lng: longitude };
        try {
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=YOUR_OPENCAGE_API_KEY`
          );
          let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              address = data.results[0].formatted;
            }
          }
          setCurrentReport(prev => ({ ...prev, coordinates, address }));
          setLocationPermission('granted');
        } catch {
          setCurrentReport(prev => ({
            ...prev,
            coordinates,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          }));
          setLocationPermission('granted');
        }
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        setLocationPermission('denied');
        alert('Error getting location: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const clearLocation = () => {
    setCurrentReport(prev => ({
      ...prev,
      coordinates: null,
      address: ''
    }));
  };

  const handleFileUpload = async (files, type) => {
    const newFiles = [];
    for (let file of files) {
      if (type === 'photos' && file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) {
          alert('Photo file size must be under 10MB');
          continue;
        }
        newFiles.push({
          id: Date.now() + Math.random(),
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size
        });
      } else if (type === 'videos' && file.type.startsWith('video/')) {
        if (file.size > 50 * 1024 * 1024) {
          alert('Video file size must be under 50MB');
          continue;
        }
        const video = document.createElement('video');
        video.preload = 'metadata';
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            if (video.duration > 60) {
              alert('Video duration must be under 1 minute');
              resolve();
              return;
            }
            newFiles.push({
              id: Date.now() + Math.random(),
              file,
              url: URL.createObjectURL(file),
              name: file.name,
              size: file.size,
              duration: video.duration
            });
            resolve();
          };
          video.src = URL.createObjectURL(file);
        });
      }
    }
    setCurrentReport(prev => ({
      ...prev,
      [type]: [...prev[type], ...newFiles]
    }));
  };

  const removeFile = (fileId, type) => {
    setCurrentReport(prev => ({
      ...prev,
      [type]: prev[type].filter(file => file.id !== fileId)
    }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };


  // Helper function to send webhook
async function notifyReportSubmission(data) {
  const webhookUrl = process.env.REACT_APP_N8N_REPORT_SUBMISSION_WEBHOOK;
  if (!webhookUrl) {
    console.warn('N8N webhook URL not configured.');
    return;
  }
  try {
    console.log('Sending webhook to:', webhookUrl);
    console.log('Payload:', data);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    console.log('Webhook response status:', response.status);
    if (!response.ok) {
      console.error('Failed to notify n8n:', response.statusText);
    }
  } catch (error) {
    console.error('Error notifying n8n:', error);
  }
};

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    const images = files.filter(file => file.type.startsWith('image/'));
    const videos = files.filter(file => file.type.startsWith('video/'));
    if (images.length > 0) handleFileUpload(images, 'photos');
    if (videos.length > 0) handleFileUpload(videos, 'videos');
  };

  // 🟢 ADD property_id and created_by when submitting
  const submitReport = async () => {
  if (
    !currentReport.property_id ||
    !currentReport.title?.trim() ||
    !currentReport.description?.trim() ||
    !currentReport.category ||
    !currentReport.location?.trim()
  ) {
    alert('Please fill in all required fields (including Property, Title, Description, Category, and Unit/Apartment).');
    return;
  }
  setIsSubmitting(true);
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data.user;
    if (!user) throw new Error('No authenticated user');

    // Save the report
    const saved = await maintenanceAPI.submitReport({
      property_id: currentReport.property_id,
      title: currentReport.title,
      description: currentReport.description,
      category: currentReport.category,
      location: currentReport.location,
      urgency: currentReport.urgency,
      coordinates: currentReport.coordinates,
      address: currentReport.address,
      created_by: user.id
    });

    // Upload attachments
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

    setReports(prev => [
      {
        ...saved,
        attachments,
        dateSubmitted: saved.created_at
      },
      ...prev
    ]);

    setCurrentReport({
      id: null,
      property_id: '',
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

    const canSubmit =
  !!(currentReport?.property_id &&
     currentReport?.title?.trim() &&
     currentReport?.description?.trim() &&
     currentReport?.category &&
     currentReport?.location?.trim());


    alert('✅ Maintenance request submitted!');

    // Fetch landlord info based on property_id
    let landlord_email = '';
    let landlord_name = '';

    try {
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('owner_id')
        .eq('id', currentReport.property_id)
        .single();

      if (propertyError) throw propertyError;

      if (propertyData?.owner_id) {
        const { data: landlordData, error: landlordError } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', propertyData.owner_id)
          .single();

        if (landlordError) throw landlordError;

        landlord_email = landlordData?.email || '';
        landlord_name = landlordData?.full_name || '';
      }
    } catch (error) {
      console.error('Error fetching landlord info:', error.message);
    }

    // Build webhook payload with updated URLs
    const payload = {
      report_id: saved.id,
      property_id: currentReport.property_id,
      property_name: properties.find(p => p.id === currentReport.property_id)?.name || '',
      tenant_email: user.email,
      tenant_name: user.user_metadata?.full_name || 'Tenant',
      landlord_email,
      landlord_name,
      report_category: currentReport.category,
      report_title: currentReport.title,
      report_url: `${window.location.origin}/my-reports`,
      landlord_portal_url: `${window.location.origin}/dashboard`
    };

    // Call webhook
    await notifyReportSubmission(payload);

  } catch (error) {
    console.error('Submit error:', error);
    alert(error.message);
  } finally {
    setIsSubmitting(false);
  }
};


  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const selectedCategory = categories.find(cat => cat.id === currentReport.category);
  const selectedUrgency = urgencyLevels[currentReport.urgency];

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-75"></div>
            <div className="relative bg-white rounded-full p-4">
              <Home className="h-12 w-12 text-gray-800" />
            </div>
          </div>
        </div>
        <h1 className="text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
          PropertyCare
        </h1>
        <p className="text-xl text-gray-300 font-medium">
          Report maintenance issues with style and get instant responses
        </p>
        <div className="flex items-center justify-center space-x-6 mt-6">
          <div className="flex items-center text-green-400">
            <Shield className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">Secure & Private</span>
          </div>
          <div className="flex items-center text-blue-400">
            <Zap className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">Instant Notifications</span>
          </div>
          <div className="flex items-center text-purple-400">
            <Star className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">24/7 Support</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-center mb-12">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-2 border border-white/20">
          <button
            onClick={() => setShowForm(true)}
            className={`px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center space-x-3 ${
              showForm
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Plus className="h-5 w-5" />
            <span>New Report</span>
            {showForm && <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>}
          </button>
          <button
            onClick={() => navigate("/my-reports")}
            className={`px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center space-x-3 ${
              !showForm
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <AlertCircle className="h-5 w-5" />
            <span>My Reports</span>
            {reports.length > 0 && (
              <div className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {reports.length}
              </div>
            )}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8">
            <h2 className="text-3xl font-bold text-white mb-2">Submit New Request</h2>
            <p className="text-blue-100">Tell us what needs fixing and we'll get right on it</p>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Property Picker */}
              <div className="lg:col-span-2">
                <label className="block text-white font-semibold mb-3">Property *</label>
                <select
                  value={currentReport.property_id}
                  onChange={e => handleInputChange('property_id', e.target.value)}
                  className="w-full px-6 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  required
                >
                  <option value="" disabled>Select your property...</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} - {property.address}
                    </option>
                  ))}
                </select>
              </div>
              {/* Title */}
              <div className="lg:col-span-2">
                <label className="block text-white font-semibold mb-3">What's the issue? *</label>
                <input
                  type="text"
                  value={currentReport.title}
                  onChange={e => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Kitchen faucet is leaking"
                  className="w-full px-6 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                />
              </div>
              {/* Category */}
              <div className="lg:col-span-2">
                <label className="block text-white font-semibold mb-4">Category *</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => handleInputChange('category', category.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 text-center group ${
                        currentReport.category === category.id
                          ? `bg-gradient-to-br ${category.color} border-white text-white shadow-lg transform scale-105`
                          : 'bg-white/5 border-white/20 text-gray-300 hover:border-white/40 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-2xl mb-2">{category.icon}</div>
                      <div className="text-sm font-medium">{category.name}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Location in Property */}
              <div>
                <label className="block text-white font-semibold mb-3">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Location in Property <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={currentReport.location}
                  onChange={e => handleInputChange('location', e.target.value)}
                  placeholder="e.g., Apartment 1204-B, bathroom (required)"
                  required
                  className="w-full px-6 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"/>
                  {!currentReport.location?.trim() && (<p className="mt-1 text-xs text-red-300">Unit/Apartment is required.</p>)}  
              </div>
              {/* GPS Location */}
              <div>
                <label className="block text-white font-semibold mb-3">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  GPS Location
                </label>
                {!currentReport.coordinates ? (
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className={`w-full p-4 rounded-xl border-2 border-dashed transition-all duration-300 ${
                      isGettingLocation
                        ? 'bg-blue-500/20 border-blue-400 cursor-not-allowed'
                        : 'bg-white/5 border-white/30 hover:border-blue-400 hover:bg-blue-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-3">
                      {isGettingLocation ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                          <span className="text-blue-400 font-medium">Getting Location...</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-5 w-5 text-blue-400" />
                          <span className="text-white font-medium">Get Current Location</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      📍 This helps maintenance teams find the exact location
                    </p>
                  </button>
                ) : (
                  <div className="bg-green-500/10 border-2 border-green-400 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <MapPin className="h-5 w-5 text-green-400" />
                          <span className="text-green-400 font-semibold">Location Captured</span>
                        </div>
                        <p className="text-white text-sm mb-1">{currentReport.address}</p>
                        <p className="text-gray-400 text-xs">
                          {currentReport.coordinates.lat.toFixed(6)}, {currentReport.coordinates.lng.toFixed(6)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearLocation}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Urgency */}
              <div>
                <label className="block text-white font-semibold mb-4">
                  <Zap className="h-4 w-4 inline mr-2" />
                  Urgency Level
                </label>
                <div className="space-y-3">
                  {Object.entries(urgencyLevels).map(([key, level]) => (
                    <button
                      key={key}
                      onClick={() => handleInputChange('urgency', key)}
                      className={`w-full p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                        currentReport.urgency === key
                          ? `bg-gradient-to-r ${level.color} border-white text-white shadow-lg`
                          : 'bg-white/5 border-white/20 text-gray-300 hover:border-white/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-lg mr-3">{level.icon}</span>
                          <div>
                            <div className="font-semibold">{level.label}</div>
                            <div className="text-sm opacity-80">{level.description}</div>
                          </div>
                        </div>
                        {currentReport.urgency === key && <CheckCircle className="h-5 w-5" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Description */}
            <div className="mb-8">
              <label className="block text-white font-semibold mb-3">
                Detailed Description *
              </label>
              <textarea
                value={currentReport.description}
                onChange={e => handleInputChange('description', e.target.value)}
                placeholder="Please describe the issue in detail. Include any relevant information that might help our maintenance team..."
                rows={5}
                className="w-full px-6 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 resize-none"
              />
            </div>
            {/* File Upload */}
            <div className="mb-8">
              <label className="block text-white font-semibold mb-4">
                <Camera className="h-4 w-4 inline mr-2" />
                Photos & Videos
              </label>
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 group ${
                  dragActive
                    ? 'border-blue-400 bg-blue-500/10 scale-105'
                    : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="relative z-10">
                  <Upload className="h-16 w-16 text-gray-400 mx-auto mb-6 group-hover:text-blue-400 transition-colors duration-300" />
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Add Visual Evidence
                  </h3>
                  <p className="text-gray-300 mb-6 text-lg">
                    Drag and drop your files here, or click to browse
                  </p>
                  <div className="flex justify-center space-x-4 mb-6">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-500/25"
                    >
                      <FileImage className="h-5 w-5 mr-2" />
                      Add Photos
                    </button>
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25"
                    >
                      <FileVideo className="h-5 w-5 mr-2" />
                      Add Videos
                    </button>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>📸 Photos: Max 10MB each • Formats: JPG, PNG, GIF</p>
                    <p>🎥 Videos: Max 50MB, 1 minute duration • Formats: MP4, MOV, AVI</p>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={e => handleFileUpload(Array.from(e.target.files), 'photos')}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={e => handleFileUpload(Array.from(e.target.files), 'videos')}
                className="hidden"
              />
            </div>
            {(currentReport.photos.length > 0 || currentReport.videos.length > 0) && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                  <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
                  Uploaded Files ({currentReport.photos.length + currentReport.videos.length})
                </h3>
                {/* Photos */}
                {currentReport.photos.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-300 mb-4 flex items-center">
                      <FileImage className="h-5 w-5 mr-2" />
                      Photos ({currentReport.photos.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentReport.photos.map(photo => (
                        <div key={photo.id} className="relative group">
                          <div className="relative overflow-hidden rounded-xl">
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <button
                                onClick={() => removeFile(photo.id, 'photos')}
                                className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="text-sm text-gray-300 truncate">{photo.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(photo.size)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Videos */}
                {currentReport.videos.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-300 mb-4 flex items-center">
                      <FileVideo className="h-5 w-5 mr-2" />
                      Videos ({currentReport.videos.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentReport.videos.map(video => (
                        <div key={video.id} className="relative group">
                          <div className="relative overflow-hidden rounded-xl">
                            <video
                              src={video.url}
                              controls
                              className="w-full h-40 object-cover bg-black rounded-xl"
                            />
                            <button
                              onClick={() => removeFile(video.id, 'videos')}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-2">
                            <p className="text-sm text-gray-300 truncate">{video.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(video.size)} • {formatDuration(video.duration)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <button
  onClick={submitReport}
  disabled={isSubmitting || !canSubmit}
  className={`px-12 py-4 font-bold rounded-xl transition-all duration-300 flex items-center space-x-3 text-lg ${
    isSubmitting || !canSubmit
      ? 'bg-gray-600 cursor-not-allowed opacity-60'
      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transform hover:scale-105'
  } text-white`}
>
  {isSubmitting ? (
    <>
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
      <span>Submitting...</span>
    </>
  ) : (
    <>
      <Send className="h-5 w-5" />
      <span>Submit Request</span>
      <ChevronRight className="h-5 w-5" />
    </>
  )}
</button>

            </div>
          </div>
        </div>
      ) : (
        // Enhanced Reports List
        <div className="space-y-6">
          {reports.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-16 text-center">
              <div className="max-w-md mx-auto">
                <AlertCircle className="h-24 w-24 text-gray-400 mx-auto mb-6" />
                <h3 className="text-3xl font-bold text-white mb-4">No Reports Yet</h3>
                <p className="text-gray-300 text-lg mb-8">Ready to report your first maintenance issue? We're here to help!</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/25"
                >
                  Create First Report
                </button>
              </div>
            </div>
          ) : (
            reports.map(report => {
              const category = categories.find(cat => cat.id === report.category);
              const urgency = urgencyLevels[report.urgency];
              return (
                <div key={report.id} className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300 group">
                  <div className={`h-2 bg-gradient-to-r ${urgency.color}`}></div>
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          {category && (
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${category.color}`}>
                              <span className="text-white text-lg">{category.icon}</span>
                            </div>
                          )}
                          <h3 className="text-2xl font-bold text-white">{report.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center text-gray-300">
                            <User className="h-4 w-4 mr-1" />
                            {category?.name || 'Other'}
                          </span>
                          {report.location && (
                            <span className="flex items-center text-gray-300">
                              <MapPin className="h-4 w-4 mr-1" />
                              {report.location}
                            </span>
                          )}
                          {report.coordinates && (
                            <span className="flex items-center text-blue-400">
                              <MapPin className="h-4 w-4 mr-1" />
                              GPS: {report.coordinates.lat.toFixed(4)}, {report.coordinates.lng.toFixed(4)}
                            </span>
                          )}
                          <span className="flex items-center text-gray-300">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(report.dateSubmitted).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-3">
                        <div className={`px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r ${urgency.color} text-white shadow-lg`}>
                          {urgency.icon} {urgency.label}
                        </div>
                        <div className="px-4 py-2 rounded-full text-sm font-bold bg-yellow-500 text-yellow-900">
                          📋 Pending
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-6 leading-relaxed">{report.description}</p>
                    {(report.attachments?.length > 0) && (
                      <div className="border-t border-white/20 pt-6">
                        <h4 className="font-semibold text-white mb-4 flex items-center">
                          <Camera className="h-5 w-5 mr-2" />
                          Attachments
                        </h4>
                        <div className="flex items-center space-x-6 text-sm">
                          {report.attachments.filter(a => a.file_type === 'image').length > 0 && (
                            <div className="flex items-center text-green-400">
                              <FileImage className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {report.attachments.filter(a => a.file_type === 'image').length} Photo{report.attachments.filter(a => a.file_type === 'image').length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                          {report.attachments.filter(a => a.file_type === 'video').length > 0 && (
                            <div className="flex items-center text-purple-400">
                              <FileVideo className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {report.attachments.filter(a => a.file_type === 'video').length} Video{report.attachments.filter(a => a.file_type === 'video').length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MaintenanceReporter;
