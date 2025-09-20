import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import {
  DocumentPlusIcon,
  ArrowPathRoundedSquareIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { usersAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { format, isValid } from 'date-fns';

const Dashboard = () => {
  // Safe date formatting function
  const formatDate = (dateString, formatString, fallback = 'Recently') => {
    if (!dateString) return fallback;
    const date = new Date(dateString);
    return isValid(date) ? format(date, formatString) : fallback;
  };
  const { data: dashboardData, isLoading, error } = useQuery(
    'dashboard',
    usersAPI.getDashboard,
    {
      refetchOnWindowFocus: false,
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading dashboard</h3>
        <p className="mt-1 text-sm text-gray-500">
          {error.response?.data?.message || 'Something went wrong'}
        </p>
      </div>
    );
  }

  const { user, statistics, recentDocuments, subscriptionUsage } = dashboardData?.dashboard || {};

  const quickActions = [
    {
      name: 'Upload Document',
      description: 'Upload a new legal document for analysis',
      href: '/upload',
      icon: DocumentPlusIcon,
      color: 'bg-primary-500',
    },
    {
      name: 'Compare Documents',
      description: 'Compare two documents side by side',
      href: '/compare',
      icon: ArrowPathRoundedSquareIcon,
      color: 'bg-green-500',
    },
    {
      name: 'View History',
      description: 'Browse your document history',
      href: '/history',
      icon: ClockIcon,
      color: 'bg-purple-500',
    },
  ];

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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-bold text-xl">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-5">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back
              </h1>
              <p className="text-sm text-gray-500">
                {/* Member since {formatDate(user?.createdAt, 'MMMM yyyy')} */}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Usage */}
      {/* <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Subscription Usage
          </h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Documents Analyzed</span>
            <span className="text-sm font-medium text-gray-900">
              {subscriptionUsage?.used || 0} / {subscriptionUsage?.limit || 0}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${subscriptionUsage?.percentage || 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {subscriptionUsage?.remaining || 0} documents remaining
          </p>
        </div>
      </div> */}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg shadow hover:shadow-md transition-shadow duration-200"
            >
              <div>
                <span
                  className={`rounded-lg inline-flex p-3 ${action.color} text-white`}
                >
                  <action.icon className="h-6 w-6" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">
                  <span className="absolute inset-0" aria-hidden="true" />
                  {action.name}
                </h3>
                <p className="mt-2 text-sm text-gray-500">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Statistics</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Documents
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {statistics?.totalDocuments || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Analyzed
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {statistics?.analyzedDocuments || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pending
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {statistics?.pendingDocuments || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                {/* <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
                </div> */}
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      High Risk
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {statistics?.riskDistribution?.High || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Recent Documents</h2>
          <Link
            to="/history"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            View all
          </Link>
        </div>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {recentDocuments && recentDocuments.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {recentDocuments.map((document) => (
                <li key={document.id}>
                  <Link
                    to={`/documents/${document.id}`}
                    className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {document.title}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {document.documentType?.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`badge ${getRiskBadgeClass(document.overallRisk)}`}>
                          {document.overallRisk}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(document.createdAt, 'MMM d')}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by uploading your first document.
              </p>
              <div className="mt-6">
                <Link to="/upload" className="btn-primary">
                  <DocumentPlusIcon className="h-4 w-4 mr-2" />
                  Upload Document
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
