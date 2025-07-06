import React from 'react';

interface MyNumberProps {
  myNumber: string;
  isGeneratingNumber: boolean;
  onCopy: () => void;
  onRefresh: () => void;
}

const MyNumber: React.FC<MyNumberProps> = ({ myNumber, isGeneratingNumber, onCopy, onRefresh }) => (
  <div className="mb-6">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
      📱 My Number
    </h2>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your number (always available for calls):
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={isGeneratingNumber ? 'Generating...' : myNumber}
            readOnly
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-center text-lg font-mono tracking-wider font-semibold text-blue-600"
          />
          <button
            onClick={onCopy}
            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
            title="Copy number"
          >
            📋
          </button>
          <button
            onClick={onRefresh}
            disabled={isGeneratingNumber}
            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
            title="Generate new number"
          >
            🔄
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default MyNumber; 