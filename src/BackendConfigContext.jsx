import React, { createContext, useContext, useState, useEffect } from 'react';

const BackendConfigContext = createContext();

export function BackendConfigProvider({ children }) {
  // Default to the current host but on port 3000 where the NestJS backend is running
  const defaultUrl = 'http://localhost:3000';
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem('backendUrl') || defaultUrl;
  });

  useEffect(() => {
    localStorage.setItem('backendUrl', backendUrl);
  }, [backendUrl]);

  return (
    <BackendConfigContext.Provider value={{ backendUrl, setBackendUrl }}>
      {children}
    </BackendConfigContext.Provider>
  );
}

export function useBackend() {
  return useContext(BackendConfigContext);
}
