import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneIcon, HeadsetIcon, IconCircle, Button } from './shared';

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

        {/* Mobile Audio Notice */}
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <span className="text-2xl mr-2">📱</span>
            <span className="font-semibold text-blue-800">Mobile Users</span>
          </div>
          <p className="text-blue-700 text-sm">
            For the best voice experience on mobile devices, please ensure you tap any button to enable audio when prompted.
          </p>
          <p className="text-blue-600 text-xs mt-1">
            ✅ Optimized for iOS Safari, Android Chrome, and all modern mobile browsers
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Customer Card */}
          <div className="bg-white rounded-xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <IconCircle color="blue" size="medium" className="mx-auto mb-6">
              <PhoneIcon className="w-8 h-8 text-blue-600" />
            </IconCircle>
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
            <Button
              onClick={() => navigate('/customer')}
              variant="primary"
              size="large"
              fullWidth
              className="transform hover:scale-105"
            >
              Connect with Sybil
            </Button>
          </div>

          {/* Agent Card */}
          <div className="bg-white rounded-xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <IconCircle color="green" size="medium" className="mx-auto mb-6">
              <HeadsetIcon className="w-8 h-8 text-green-600" />
            </IconCircle>
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
            <Button
              onClick={() => navigate('/agent')}
              variant="success"
              size="large"
              fullWidth
              className="transform hover:scale-105"
            >
              Sybil Oracle Portal
            </Button>
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