import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppRoutes from './components/routes';  // wherever your routes file lives

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
);
