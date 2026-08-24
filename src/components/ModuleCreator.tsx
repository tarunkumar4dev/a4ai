// src/components/ModuleCreator.tsx
import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// Backend API URL — local dev mein localhost, production mein Vercel URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ModuleCreatorProps {
  onModuleCreated?: (module: any) => void;
}

type ProcessingStatus = 'idle' | 'uploading' | 'creating' | 'processing' | 'ready' | 'failed';

export const ModuleCreator: React.FC<ModuleCreatorProps> = ({ onModuleCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [moduleData, setModuleData] = useState<any>(null);
  const [error, setError] = useState('');

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setError('');
        setModuleData(null);
        setStatus('idle');
      }
    },
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message || 'Invalid file';
      setError(msg);
    },
  });

  const handleSubmit = async () => {
    if (!file || !subject || !classLevel) {
      setError('Please fill all fields and upload a document');
      return;
    }

    setError('');
    setModuleData(null);

    try {
      // ── Step 1: Get teacher_id from Supabase auth ──
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      if (!teacherId) {
        setError('Please login first');
        return;
      }
      const accessToken = sessionData?.session?.access_token || '';

      // ── Step 2: Upload file to Supabase Storage ──
      setStatus('uploading');
      setStatusMessage('Uploading file to storage...');

      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileId = uuidv4();
      const storagePath = `${teacherId}/${fileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('Modules')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // ── Step 3: Create module row in backend ──
      setStatus('creating');
      setStatusMessage('Creating module...');

      const createRes = await fetch(`${API_URL}/modules/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          original_filename: file.name,
          subject: subject,
          class_level: classLevel,
          teacher_id: teacherId,
          file_type: fileExt,
          file_size_bytes: file.size,
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create module');
      }

      const moduleId = createData.module_id;

      // ── Step 4: Process module (extract + summarize + chunk) ──
      setStatus('processing');
      setStatusMessage('Processing PDF — extracting text, generating summary...');

      const processRes = await fetch(`${API_URL}/modules/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ module_id: moduleId }),
      });

      const processData = await processRes.json();
      if (!processData.success) {
        throw new Error(processData.error || 'Processing failed');
      }

      // ── Done! ──
      setStatus('ready');
      setStatusMessage('Module created successfully!');
      setModuleData(processData);

      if (onModuleCreated) {
        onModuleCreated(processData);
      }

      // Reset form
      setFile(null);
      setSubject('');
      setClassLevel('');

    } catch (err: any) {
      console.error('Module creation error:', err);
      setStatus('failed');
      setError(err.message || 'Something went wrong');
      setStatusMessage('');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'uploading': return 'text-blue-600';
      case 'creating': return 'text-blue-600';
      case 'processing': return 'text-orange-600';
      case 'ready': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-blue-600" />
        Create New Module
      </h2>

      {/* Subject & Class */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={status !== 'idle' && status !== 'failed'}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Subject</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="Science">Science</option>
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Social Science">Social Science</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Economics">Economics</option>
            <option value="Accountancy">Accountancy</option>
            <option value="Business Studies">Business Studies</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
          <select
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
            disabled={status !== 'idle' && status !== 'failed'}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Class</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((cls) => (
              <option key={cls} value={String(cls)}>Class {cls}</option>
            ))}
          </select>
        </div>
      </div>

      {/* File Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500'
        } ${status !== 'idle' && status !== 'failed' ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <FileText className="w-6 h-6" />
            <span className="font-medium">{file.name}</span>
            <span className="text-sm text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </div>
        ) : (
          <div>
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600">Drag & drop PDF/DOCX here, or click to select</p>
            <p className="text-sm text-gray-400 mt-1">Supports .pdf, .docx (max 50MB)</p>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!file || !subject || !classLevel || (status !== 'idle' && status !== 'failed')}
        className={`w-full mt-4 py-3 rounded-lg font-medium text-white transition-colors ${
          !file || !subject || !classLevel || (status !== 'idle' && status !== 'failed')
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {status === 'idle' || status === 'failed' ? (
          '🚀 Create Module'
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {status === 'uploading' ? 'Uploading...' : status === 'creating' ? 'Creating...' : 'Processing...'}
          </span>
        )}
      </button>

      {/* Status Message */}
      {statusMessage && (
        <div className={`mt-3 flex items-center gap-2 text-sm ${getStatusColor()}`}>
          {status === 'ready' ? (
            <CheckCircle className="w-4 h-4" />
          ) : status === 'failed' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          {statusMessage}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        </div>
      )}

      {/* Success */}
      {moduleData && status === 'ready' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Module Created Successfully!
          </h3>
          <p className="text-sm text-green-700 mt-1">Title: {moduleData.title}</p>
          <p className="text-sm text-green-700">Pages: {moduleData.page_count}</p>
          <p className="text-sm text-green-700">Topics: {moduleData.topics_count}</p>
          <p className="text-sm text-green-700">Chunks: {moduleData.chunks_count}</p>
        </div>
      )}
    </div>
  );
};

export default ModuleCreator;
