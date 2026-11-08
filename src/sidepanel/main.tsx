import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanelApp } from './SidePanelApp';
import { ToastProvider } from '../components/common/Toast';
import '../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <SidePanelApp />
    </ToastProvider>
  </React.StrictMode>
);

