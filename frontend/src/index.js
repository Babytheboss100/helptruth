import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TenantProvider } from './TenantContext';
import './styles/tailwind.css';
import './styles/tenant-theme.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <TenantProvider>
      <App />
    </TenantProvider>
  </React.StrictMode>
);
