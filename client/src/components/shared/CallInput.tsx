import React from 'react';
import { Button, PhoneIcon } from './';

interface CallInputProps {
  friendNumber: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCall: () => void;
}

const CallInput: React.FC<CallInputProps> = ({ friendNumber, onChange, onKeyPress, onCall }) => (
  <div className="mb-8">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
      📞 Call a Number
    </h2>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Enter phone number:
        </label>
        <input
          type="text"
          value={friendNumber}
          onChange={onChange}
          onKeyPress={onKeyPress}
          placeholder="Enter phone number"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
          maxLength={20}
        />
      </div>
      <Button
        onClick={onCall}
        disabled={!friendNumber.trim()}
        variant="primary"
        size="large"
        fullWidth
        className="flex items-center justify-center gap-2"
      >
        <PhoneIcon className="w-5 h-5" />
        Call Number
      </Button>
    </div>
  </div>
);

export default CallInput; 