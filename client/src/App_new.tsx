import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import CustomerInterface from './components/CustomerInterface';
import AgentInterface from './components/AgentInterface';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/customer" element={<CustomerInterface />} />
          <Route path="/agent" element={<AgentInterface />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
