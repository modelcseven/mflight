import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';

createRoot(document.getElementById('root')!).render(
  <Router>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </Router>,
);

// Installable app: register the service worker in production builds.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
