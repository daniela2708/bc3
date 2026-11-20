import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import '@fontsource/nunito-sans/800.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import App from './App';
import { PasswordGate } from './components/PasswordGate';
import { handleVitePreloadError } from './lib/lazyWithReload';
import './styles/app.css';
import './styles/access.css';
import './styles/uc3.css';

window.addEventListener('unhandledrejection', (e) => console.error('Unhandled error', e.reason));
window.addEventListener('vite:preloadError', handleVitePreloadError);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </React.StrictMode>,
);
