import React from 'react';

const Instructions: React.FC = () => (
  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
    <p className="text-sm text-blue-700">
      <strong>📱 How it works:</strong> Share your number with others and they can call you anytime. 
      Just like a real phone!
    </p>
    <p className="text-xs text-blue-600 mt-2">
      💡 <strong>Multi-tab friendly:</strong> Each browser tab automatically gets its own unique number
    </p>
  </div>
);

export default Instructions; 