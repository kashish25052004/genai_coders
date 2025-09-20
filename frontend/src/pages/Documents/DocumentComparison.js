import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from 'react-query';
import {
  ArrowPathRoundedSquareIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { uploadFilesForComparison, analysisAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import ComparisonTable from '../../components/ComparisonTable';
import SimilaritiesSection from '../../components/SimilaritiesSection';
import PlainEnglishDifferences from '../../components/PlainEnglishDifferences';
import PDFExportButton from '../../components/PDFExportButton';
import toast from 'react-hot-toast';

const DocumentComparison = () => {
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [comparison, setComparison] = useState(null);

  const compareMutation = useMutation(
    ({ doc1Id, doc2Id }) => analysisAPI.compare(doc1Id, doc2Id),
    {
      onSuccess: (data) => {
        setComparison(data.data.comparison);
        toast.success('Documents compared successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Comparison failed');
      },
    }
  );

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length !== 2) {
      toast.error('Please select exactly 2 documents for comparison');
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadFilesForComparison(acceptedFiles);
      setUploadedDocs(response.data.documents);
      toast.success('Documents uploaded successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp']
    },
    maxFiles: 2,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading || uploadedDocs.length === 2
  });

  const handleCompare = () => {
    if (uploadedDocs.length === 2) {
      compareMutation.mutate({
        doc1Id: uploadedDocs[0].id,
        doc2Id: uploadedDocs[1].id,
      });
    }
  };

  const handleReset = () => {
    setUploadedDocs([]);
    setComparison(null);
  };

  const getRiskColor = (risk) => {
    switch (risk?.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Compare Documents</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload two legal documents to compare their terms, risks, and conditions side by side.
        </p>
      </div>

      {uploadedDocs.length < 2 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
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
                <p className="text-sm font-medium text-gray-900">Uploading documents...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {isDragActive ? 'Drop the files here' : 'Drag and drop 2 documents'}
                  </p>
                  <p className="text-sm text-gray-500">
                    or <span className="text-primary-600 font-medium">browse to choose files</span>
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  <p>Select exactly 2 documents to compare</p>
                  <p>Supported formats: PDF, PNG, JPG, JPEG, BMP, TIFF, WEBP</p>
                  <p>Maximum file size: 10MB each</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {uploadedDocs.length === 2 && !comparison && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Documents Ready for Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {uploadedDocs.map((doc, index) => (
              <div key={doc.id} className="border rounded-lg p-4">
                <div className="flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-gray-400 mr-3" />
                  <div>
                    <h4 className="font-medium text-gray-900">{doc.originalFileName}</h4>
                    <p className="text-sm text-gray-500 capitalize">
                      {doc.documentType?.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleCompare}
              disabled={compareMutation.isLoading}
              className="btn-primary"
            >
              {compareMutation.isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <ArrowPathRoundedSquareIcon className="h-4 w-4 mr-2" />
                  Compare Documents
                </>
              )}
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Upload Different Documents
            </button>
          </div>
        </div>
      )}

      {comparison && (
        <div className="space-y-6">
          {/* Enhanced Comparison Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Enhanced Comparison Results</h3>
              <div className="flex space-x-3">
                <PDFExportButton 
                  comparisonData={comparison}
                  documentId1={uploadedDocs[0]?.id}
                  documentId2={uploadedDocs[1]?.id}
                />
                <button onClick={handleReset} className="btn-secondary">
                  New Comparison
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Document 1</h4>
                <p className="text-sm text-gray-600 mb-2">{comparison.documents?.doc1?.title}</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Risk Level:</span>
                  <span className={`font-medium ${getRiskColor(comparison.documents?.doc1?.overallRisk)}`}>
                    {comparison.documents?.doc1?.overallRisk}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total Clauses:</span>
                  <span className="font-medium">{comparison.documents?.doc1?.totalClauses}</span>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Document 2</h4>
                <p className="text-sm text-gray-600 mb-2">{comparison.documents?.doc2?.title}</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Risk Level:</span>
                  <span className={`font-medium ${getRiskColor(comparison.documents?.doc2?.overallRisk)}`}>
                    {comparison.documents?.doc2?.overallRisk}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total Clauses:</span>
                  <span className="font-medium">{comparison.documents?.doc2?.totalClauses}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Similarities Section */}
          <SimilaritiesSection 
            similarities={comparison.detailedSimilarities || comparison.similarities}
            documents={comparison.documents}
          />

          {/* Clause-by-Clause Comparison Table */}
          <ComparisonTable comparisonData={comparison} />

          {/* Plain English Differences */}
          <PlainEnglishDifferences comparisonData={comparison} />

          {/* Traditional Differences (if no enhanced data) */}
          {(!comparison.clauseByClauseComparison && comparison.differences && comparison.differences.length > 0) && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Key Differences</h3>
              <ul className="space-y-2">
                {comparison.differences.map((difference, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-yellow-500 mr-2 mt-1">⚠</span>
                    <span className="text-sm text-gray-700">{difference}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {comparison.recommendations && comparison.recommendations.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">📋 Expert Recommendations</h3>
              <div className="space-y-3">
                {comparison.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start bg-blue-50 rounded-lg p-3">
                    <span className="text-blue-500 mr-3 mt-0.5">💡</span>
                    <span className="text-sm text-blue-800 leading-relaxed">{recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Risk Comparison */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">📊 Risk Analysis Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Document 1 Risk Profile</h4>
                <div className={`text-2xl font-bold mb-2 ${getRiskColor(comparison.documents?.doc1?.overallRisk)}`}>
                  {comparison.documents?.doc1?.overallRisk}
                </div>
                {comparison.documents?.doc1?.riskDistribution && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>High Risk:</span>
                      <span className="font-medium text-red-600">{comparison.documents.doc1.riskDistribution.high}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Medium Risk:</span>
                      <span className="font-medium text-yellow-600">{comparison.documents.doc1.riskDistribution.medium}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Low Risk:</span>
                      <span className="font-medium text-green-600">{comparison.documents.doc1.riskDistribution.low}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Document 2 Risk Profile</h4>
                <div className={`text-2xl font-bold mb-2 ${getRiskColor(comparison.documents?.doc2?.overallRisk)}`}>
                  {comparison.documents?.doc2?.overallRisk}
                </div>
                {comparison.documents?.doc2?.riskDistribution && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>High Risk:</span>
                      <span className="font-medium text-red-600">{comparison.documents.doc2.riskDistribution.high}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Medium Risk:</span>
                      <span className="font-medium text-yellow-600">{comparison.documents.doc2.riskDistribution.medium}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Low Risk:</span>
                      <span className="font-medium text-green-600">{comparison.documents.doc2.riskDistribution.low}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentComparison;
