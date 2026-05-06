import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { BackendConfigProvider } from './BackendConfigContext';
import DriverView from './pages/DriverView';

function App() {
  return (
    <BackendConfigProvider>
      <Router>
        <Routes>
          <Route path="/" element={<DriverView />} />
        </Routes>
      </Router>
    </BackendConfigProvider>
  );
}

export default App;
