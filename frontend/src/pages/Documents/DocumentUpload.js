import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentPlusIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { uploadFile } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const DocumentUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });

      toast.success('Document uploaded successfully!');
      navigate(`/documents/${response.data.document.id}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload a legal document for AI-powered analysis and risk assessment.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${isUploading ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <input {...getInputProps()} />
          
          {isUploading ? (
            <div className="space-y-4">
              <LoadingSpinner size="lg" />
              <div>
                <p className="text-sm font-medium text-gray-900">Uploading...</p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{uploadProgress}% complete</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isDragActive ? 'Drop the file here' : 'Drag and drop your document'}
                </p>
                <p className="text-sm text-gray-500">
                  or <span className="text-primary-600 font-medium">browse to choose a file</span>
                </p>
              </div>
              <div className="text-xs text-gray-500">
                <p>Supported formats: PDF, PNG, JPG, JPEG, BMP, TIFF, WEBP</p>
                <p>Maximum file size: 10MB</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">What happens next?</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Your document will be securely encrypted and stored</li>
            <li>• AI will analyze each clause for risks and plain-English explanations</li>
            <li>• You'll get a comprehensive report with risk assessments</li>
            <li>• Ask questions about your document using our AI chatbot</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;
