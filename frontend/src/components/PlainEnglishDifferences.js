import React from 'react';
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const PlainEnglishDifferences = ({ comparisonData }) => {
  if (!comparisonData || !comparisonData.clauseByClauseComparison) {
    return null;
  }

  // Extract plain English explanations
  const plainEnglishDifferences = comparisonData.clauseByClauseComparison
    .filter(comparison => comparison.plainEnglish && comparison.plainEnglish !== 'Both documents have similar terms for this clause.')
    .map(comparison => ({
      type: comparison.clauseType,
      explanation: comparison.plainEnglish,
      risk: comparison.overallRisk
    }));

  if (plainEnglishDifferences.length === 0) {
    return (
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-center">
          <InformationCircleIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-blue-900">
            Key Differences
          </h3>
        </div>
        <p className="mt-2 text-sm text-blue-800">
          Both documents have very similar terms with no major differences detected.
        </p>
      </div>
    );
  }

  const getIcon = (risk) => {
    if (risk === 'High') {
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
    }
    return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
  };

  const getCardStyle = (risk) => {
    if (risk === 'High') {
      return 'bg-red-50 border-red-200';
    } else if (risk === 'Medium') {
      return 'bg-yellow-50 border-yellow-200';
    }
    return 'bg-blue-50 border-blue-200';
  };

  const getTextStyle = (risk) => {
    if (risk === 'High') {
      return 'text-red-900';
    } else if (risk === 'Medium') {
      return 'text-yellow-900';
    }
    return 'text-blue-900';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Key Differences in Plain English
      </h3>
      
      {plainEnglishDifferences.map((difference, index) => (
        <div key={index} className={`rounded-lg border p-4 ${getCardStyle(difference.risk)}`}>
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-0.5">
              {getIcon(difference.risk)}
            </div>
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <h4 className={`font-medium ${getTextStyle(difference.risk)}`}>
                  {difference.type}
                </h4>
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  difference.risk === 'High' ? 'bg-red-100 text-red-800' :
                  difference.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {difference.risk} Impact
                </span>
              </div>
              <p className={`text-sm leading-relaxed ${
                difference.risk === 'High' ? 'text-red-800' :
                difference.risk === 'Medium' ? 'text-yellow-800' :
                'text-blue-800'
              }`}>
                {difference.explanation}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Summary of key insights */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mt-6">
        <h4 className="font-medium text-gray-900 mb-2">💡 Quick Summary</h4>
        <div className="text-sm text-gray-700 space-y-1">
          {plainEnglishDifferences.some(d => d.explanation.includes('cheaper')) && (
            <p>• One document offers better financial terms than the other</p>
          )}
          {plainEnglishDifferences.some(d => d.explanation.includes('notice')) && (
            <p>• Exit terms differ between the two agreements</p>
          )}
          {plainEnglishDifferences.some(d => d.explanation.includes('deposit')) && (
            <p>• Upfront costs vary between the documents</p>
          )}
          {plainEnglishDifferences.some(d => d.risk === 'High') && (
            <p className="text-red-700 font-medium">⚠️ Some differences involve high-risk terms that need careful consideration</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlainEnglishDifferences;
