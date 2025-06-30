import React from 'react';
import { useNavigate } from 'react-router-dom';

// Icons
const PhoneIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const HeadsetIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold text-gray-800 mb-4">🔮 Sybil</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered voice conversation platform with prophetic insights and intelligent guidance
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Customer Card */}
          <div className="bg-white rounded-xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <PhoneIcon className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">I'm a Customer</h2>
            <p className="text-gray-600 mb-6">
              Get instant help with Sybil's prophetic insights guiding your conversation.
            </p>
            <ul className="text-left text-gray-600 mb-8 space-y-2">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Oracle-guided conversations
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Prophetic insights
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                High-quality voice calls
              </li>
            </ul>
            <button
              onClick={() => navigate('/customer')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105"
            >
              Connect with Sybil
            </button>
          </div>

          {/* Agent Card */}
          <div className="bg-white rounded-xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <HeadsetIcon className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">I'm an Agent</h2>
            <p className="text-gray-600 mb-6">
              Support customers with Sybil's oracle wisdom enhancing every conversation.
            </p>
            <ul className="text-left text-gray-600 mb-8 space-y-2">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                Oracle-enhanced dashboard
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                Prophetic call insights
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                Wisdom-guided responses
              </li>
            </ul>
            <button
              onClick={() => navigate('/agent')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105"
            >
              Sybil Oracle Portal
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-gray-500">
          <p>🔮 Oracle Wisdom • 📞 Voice Conversations • 🤖 AI-Powered Insights</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;