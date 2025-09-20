import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const SimilaritiesSection = ({ similarities, documents }) => {
  if (!similarities || similarities.length === 0) {
    return null;
  }

  return (
    <div className="bg-green-50 rounded-lg border border-green-200 p-6">
      <div className="flex items-center mb-4">
        <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
        <h3 className="text-lg font-semibold text-green-900">
          Document Similarities
        </h3>
      </div>
      
      <div className="space-y-3">
        {similarities.map((similarity, index) => (
          <div key={index} className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            </div>
            <p className="ml-3 text-sm text-green-800 leading-relaxed">
              {similarity}
            </p>
          </div>
        ))}
      </div>

      {documents && (
        <div className="mt-4 pt-4 border-t border-green-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-green-900">Document 1</p>
              <p className="text-green-700">{documents.doc1.title}</p>
              <p className="text-green-600">
                {documents.doc1.totalClauses} clauses • {documents.doc1.overallRisk} risk
              </p>
            </div>
            <div>
              <p className="font-medium text-green-900">Document 2</p>
              <p className="text-green-700">{documents.doc2.title}</p>
              <p className="text-green-600">
                {documents.doc2.totalClauses} clauses • {documents.doc2.overallRisk} risk
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimilaritiesSection;
