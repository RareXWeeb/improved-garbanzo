import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardApp } from './DashboardApp';
import { ToastProvider } from '../components/common/Toast';
import '../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <DashboardApp />
    </ToastProvider>
  </React.StrictMode>
);

