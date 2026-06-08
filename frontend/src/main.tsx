import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { API_BASE } from './api/http';
import { DATA_MODE } from './gateways';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

console.info('[startup] frontend runtime config', {
  mode: DATA_MODE,
  apiBaseUrl: API_BASE,
  backendParityCheck: import.meta.env.VITE_ENABLE_BACKEND_PARITY_CHECK === 'true',
});

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
