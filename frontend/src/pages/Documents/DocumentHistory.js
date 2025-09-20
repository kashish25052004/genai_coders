import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { documentsAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { format } from 'date-fns';
import clsx from 'clsx';

const DocumentHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, error } = useQuery(
    ['documents', { 
      page: currentPage, 
      search: searchTerm, 
      status: statusFilter, 
      documentType: typeFilter 
    }],
    () => documentsAPI.getAll({
      page: currentPage,
      limit: 10,
      search: searchTerm || undefined,
      status: statusFilter || undefined,
      documentType: typeFilter || undefined,
    }),
    {
      keepPreviousData: true,
    }
  );

  const getRiskBadgeClass = (risk) => {
    switch (risk?.toLowerCase()) {
      case 'high':
        return 'badge-danger';
      case 'medium':
        return 'badge-warning';
      case 'low':
        return 'badge-success';
      default:
        return 'badge-gray';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'analyzed':
        return 'badge-success';
      case 'processing':
        return 'badge-warning';
      case 'failed':
        return 'badge-danger';
      default:
        return 'badge-gray';
    }
  };

  const documentTypes = [
    { value: '', label: 'All Types' },
    { value: 'rental_agreement', label: 'Rental Agreement' },
    { value: 'loan_contract', label: 'Loan Contract' },
    { value: 'terms_of_service', label: 'Terms of Service' },
    { value: 'employment_contract', label: 'Employment Contract' },
    { value: 'other', label: 'Other' },
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'processing', label: 'Processing' },
    { value: 'analyzed', label: 'Analyzed' },
    { value: 'failed', label: 'Failed' },
  ];

  if (isLoading && currentPage === 1) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading documents..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          {error.response?.data?.message || 'Something went wrong'}
        </p>
      </div>
    );
  }

  const documents = data?.data?.documents || [];
  const pagination = {
    page: data?.data?.page || 1,
    pages: data?.data?.pages || 1,
    total: data?.data?.total || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document History</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage all your uploaded and analyzed documents.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label htmlFor="search" className="form-label">
              Search Documents
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10"
                placeholder="Search by title or filename..."
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="form-label">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label htmlFor="type" className="form-label">
              Document Type
            </label>
            <select
              id="type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-input"
            >
              {documentTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {documents.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-200">
              {documents.map((document) => (
                <li key={document._id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0 flex-1">
                        <DocumentTextIcon className="h-8 w-8 text-gray-400 mr-4" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {document.title}
                            </h3>
                            <span className={`badge ${getStatusBadgeClass(document.status)}`}>
                              {document.status}
                            </span>
                            {document.analysis?.summary?.overallRisk && (
                              <span className={`badge ${getRiskBadgeClass(document.analysis.summary.overallRisk)}`}>
                                {document.analysis.summary.overallRisk} Risk
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <span className="capitalize">
                              {document.documentType?.replace('_', ' ')}
                            </span>
                            <span>•</span>
                            <span>{document.originalFileName}</span>
                            <span>•</span>
                            <span>{Math.round(document.fileSize / 1024)} KB</span>
                            <span>•</span>
                            <span>
                              {format(new Date(document.createdAt), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/documents/${document._id}`}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View
                        </Link>
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                    disabled={currentPage === pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">
                        {(currentPage - 1) * 10 + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * 10, pagination.total)}
                      </span>{' '}
                      of{' '}
                      <span className="font-medium">{pagination.total}</span>{' '}
                      results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {[...Array(pagination.pages)].map((_, index) => {
                        const page = index + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={clsx(
                              'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                              page === currentPage
                                ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            )}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                        disabled={currentPage === pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter || typeFilter
                ? 'Try adjusting your search or filters.'
                : 'Get started by uploading your first document.'}
            </p>
            {!searchTerm && !statusFilter && !typeFilter && (
              <div className="mt-6">
                <Link to="/upload" className="btn-primary">
                  Upload Document
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentHistory;
