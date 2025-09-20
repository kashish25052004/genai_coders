import React from 'react';

const ComparisonTable = ({ comparisonData }) => {
  if (!comparisonData || !comparisonData.clauseByClauseComparison) {
    return <div>No comparison data available</div>;
  }

  const getRiskBadge = (risk) => {
    const riskColors = {
      'High': 'bg-danger-100 text-danger-800 border-danger-200',
      'Medium': 'bg-warning-100 text-warning-800 border-warning-200',
      'Low': 'bg-success-100 text-success-800 border-success-200'
    };

    const riskEmojis = {
      'High': '🔴',
      'Medium': '🟡',
      'Low': '🟢'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${riskColors[risk] || riskColors['Low']}`}>
        <span className="mr-1">{riskEmojis[risk] || '🟢'}</span>
        {risk}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Clause-by-Clause Comparison
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Detailed comparison of each clause type between the two documents
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Clause Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document 1
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document 2
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Difference Highlight
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {comparisonData.clauseByClauseComparison.map((comparison, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {comparison.clauseType}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {comparison.doc1 ? (
                      <div>
                        <p className="mb-2">{comparison.doc1.text}</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          comparison.doc1.risk === 'High' ? 'bg-red-100 text-red-800' :
                          comparison.doc1.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {comparison.doc1.risk} Risk
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Not present</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {comparison.doc2 ? (
                      <div>
                        <p className="mb-2">{comparison.doc2.text}</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          comparison.doc2.risk === 'High' ? 'bg-red-100 text-red-800' :
                          comparison.doc2.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {comparison.doc2.risk} Risk
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Not present</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    <p className="mb-2 font-medium">{comparison.difference}</p>
                    <p className="text-gray-600 italic">{comparison.plainEnglish}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getRiskBadge(comparison.overallRisk)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonTable;
