import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import CustomerInterface from './components/CustomerInterface';
import AgentInterface from './components/AgentInterface';
import MobileWebRTCExample from './components/MobileWebRTCExample';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/customer" element={<CustomerInterface />} />
          <Route path="/agent" element={<AgentInterface />} />
          <Route path="/mobile-test" element={<MobileWebRTCExample />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
