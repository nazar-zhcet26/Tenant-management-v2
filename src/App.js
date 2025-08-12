// src/App.js
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './components/routes';

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
