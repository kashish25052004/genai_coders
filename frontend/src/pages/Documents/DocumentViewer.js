import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Tab } from '@headlessui/react';
import {
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  BookOpenIcon,
  PlayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { documentsAPI, analysisAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const DocumentViewer = () => {
  const { id } = useParams();
  const [question, setQuestion] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const queryClient = useQueryClient();

  // Fetch document data
  const { data: document, isLoading: documentLoading } = useQuery(
    ['document', id],
    () => documentsAPI.getById(id),
    {
      enabled: !!id,
    }
  );

  // Fetch Q&A history
  const { data: qaHistory } = useQuery(
    ['qa-history', id],
    () => analysisAPI.getQAHistory(id),
    {
      enabled: !!id && document?.data?.document?.status === 'analyzed',
    }
  );

  // Analyze document mutation
  const analyzeMutation = useMutation(
    () => analysisAPI.analyze(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['document', id]);
        toast.success('Document analyzed successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Analysis failed');
      },
    }
  );

  // Ask question mutation
  const askQuestionMutation = useMutation(
    (question) => analysisAPI.askQuestion(id, question),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['qa-history', id]);
        setQuestion('');
        toast.success('Question answered!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to get answer');
      },
    }
  );

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const handleAskQuestion = (e) => {
    e.preventDefault();
    if (question.trim()) {
      askQuestionMutation.mutate(question.trim());
    }
  };

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

  const getRiskCardClass = (risk) => {
    switch (risk?.toLowerCase()) {
      case 'high':
        return 'clause-card risk-high';
      case 'medium':
        return 'clause-card risk-medium';
      case 'low':
        return 'clause-card risk-low';
      default:
        return 'clause-card';
    }
  };

  if (documentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading document..." />
      </div>
    );
  }

  if (!document?.data?.document) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Document not found</h3>
      </div>
    );
  }

  const doc = document.data.document;
  const analysis = doc.analysis;

  const tabs = [
    { name: 'Analysis', icon: DocumentTextIcon },
    { name: 'Q&A', icon: ChatBubbleLeftRightIcon },
    { name: 'Glossary', icon: BookOpenIcon },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
            <p className="text-sm text-gray-500 capitalize">
              {doc.documentType?.replace('_', ' ')} • {doc.metadata?.pages} page(s)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`badge ${getRiskBadgeClass(analysis?.summary?.overallRisk)}`}>
              {analysis?.summary?.overallRisk || 'Unknown'} Risk
            </span>
            {doc.status !== 'analyzed' && (
              <button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isLoading}
                className="btn-primary"
              >
                {analyzeMutation.isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Analyze Document
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {doc.status === 'analyzed' && analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
              <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 mb-6">
                {tabs.map((tab, index) => (
                  <Tab
                    key={tab.name}
                    className={({ selected }) =>
                      clsx(
                        'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                        'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                        selected
                          ? 'bg-white text-blue-700 shadow'
                          : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                      )
                    }
                  >
                    <div className="flex items-center justify-center">
                      <tab.icon className="h-4 w-4 mr-2" />
                      {tab.name}
                    </div>
                  </Tab>
                ))}
              </Tab.List>

              <Tab.Panels>
                {/* Analysis Tab */}
                <Tab.Panel>
                  <div className="space-y-4">
                    {analysis.clauses?.map((clause, index) => (
                      <div key={index} className={getRiskCardClass(clause.final_risk)}>
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-sm font-medium text-gray-900">
                            Clause {index + 1} (Page {clause.page})
                          </h3>
                          <span className={`badge ${getRiskBadgeClass(clause.final_risk)}`}>
                            {clause.final_risk}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                              Original Text
                            </h4>
                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                              {clause.clause}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                              Plain English Explanation
                            </h4>
                            <p className="text-sm text-gray-900">{clause.explanation}</p>
                          </div>
                          {clause.reason && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                Risk Reason
                              </h4>
                              <p className="text-sm text-gray-700">{clause.reason}</p>
                            </div>
                          )}
                          {clause.keywords && clause.keywords.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                Key Terms
                              </h4>
                              <div className="flex flex-wrap gap-1">
                                {clause.keywords.map((keyword, i) => (
                                  <span key={i} className="badge badge-gray text-xs">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Tab.Panel>

                {/* Q&A Tab */}
                <Tab.Panel>
                  <div className="space-y-6">
                    {/* Ask Question Form */}
                    <form onSubmit={handleAskQuestion} className="bg-white p-4 rounded-lg border">
                      <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                        Ask a question about this document
                      </label>
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          id="question"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="e.g., What are the penalties for late payment?"
                          className="form-input flex-1"
                          disabled={askQuestionMutation.isLoading}
                        />
                        <button
                          type="submit"
                          disabled={!question.trim() || askQuestionMutation.isLoading}
                          className="btn-primary"
                        >
                          {askQuestionMutation.isLoading ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            'Ask'
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Q&A History */}
                    <div className="space-y-4">
                      {qaHistory?.data?.qa?.map((qa, index) => (
                        <div key={index} className="bg-white p-4 rounded-lg border">
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-900">Q: {qa.question}</h4>
                          </div>
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-sm text-gray-700">{qa.answer}</p>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Confidence: {Math.round((qa.confidence || 0) * 100)}%
                          </div>
                        </div>
                      ))}
                      {(!qaHistory?.data?.qa || qaHistory.data.qa.length === 0) && (
                        <div className="text-center py-8">
                          <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No questions yet</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Ask a question about this document to get started.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Tab.Panel>

                {/* Glossary Tab */}
                <Tab.Panel>
                  <div className="space-y-4">
                    {analysis.glossary?.map((term, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">{term.term}</h3>
                        <p className="text-sm text-gray-700">{term.meaning}</p>
                        {term.category && (
                          <span className="inline-block mt-2 badge badge-gray text-xs capitalize">
                            {term.category}
                          </span>
                        )}
                      </div>
                    ))}
                    {(!analysis.glossary || analysis.glossary.length === 0) && (
                      <div className="text-center py-8">
                        <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No glossary terms</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Glossary terms will appear here after analysis.
                        </p>
                      </div>
                    )}
                  </div>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow space-y-6">
              {/* Summary */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Clauses:</span>
                    <span className="font-medium">{analysis.summary?.totalClauses || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Overall Risk:</span>
                    <span className={`badge ${getRiskBadgeClass(analysis.summary?.overallRisk)}`}>
                      {analysis.summary?.overallRisk || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Risk Distribution */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Risk Distribution</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600">Low Risk</span>
                    <span className="font-medium">{analysis.summary?.riskDistribution?.low || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-yellow-600">Medium Risk</span>
                    <span className="font-medium">{analysis.summary?.riskDistribution?.medium || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-600">High Risk</span>
                    <span className="font-medium">{analysis.summary?.riskDistribution?.high || 0}</span>
                  </div>
                </div>
              </div>

              {/* Key Findings */}
              {analysis.summary?.keyFindings && analysis.summary.keyFindings.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Key Findings</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {analysis.summary.keyFindings.map((finding, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-primary-500 mr-2">•</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {analysis.summary?.recommendations && analysis.summary.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Recommendations</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {analysis.summary.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-primary-500 mr-2">•</span>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {doc.status === 'processing' ? 'Analysis in progress...' : 'Document not analyzed yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {doc.status === 'processing' 
              ? 'Please wait while we analyze your document.'
              : 'Click the "Analyze Document" button to start the analysis.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
