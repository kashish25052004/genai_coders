import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const Disclaimer = () => {
  return (
    <div className="disclaimer mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <p className="disclaimer-text">
            <strong>⚠️ Important Disclaimer:</strong> This is not legal advice, only a simplified explanation. 
            The analysis provided by LegalEase is for informational purposes only and should not be considered 
            as professional legal advice. Always consult with a qualified lawyer for binding legal advice 
            regarding your specific situation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
