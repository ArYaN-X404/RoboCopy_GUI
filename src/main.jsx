import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AppOld from './AppOld.jsx';
import './index.css';

const guiVersion = localStorage.getItem('gui_version') || 'v2';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {guiVersion === 'v1' ? <AppOld /> : <App />}
  </React.StrictMode>
);
