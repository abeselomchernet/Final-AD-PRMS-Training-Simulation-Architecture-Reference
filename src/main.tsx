import '@fontsource/noto-sans-ethiopic/400.css';
import '@fontsource/noto-sans-ethiopic/500.css';
import '@fontsource/noto-sans-ethiopic/600.css';
import '@fontsource/noto-sans-ethiopic/700.css';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __adprmsApplySwUpdate?: (reloadPage?: boolean) => Promise<void>;
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.__adprmsApplySwUpdate = updateSW;
      window.dispatchEvent(new CustomEvent('adprms:sw-update-available'));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('adprms:sw-offline-ready'));
    },
  });
  window.__adprmsApplySwUpdate = updateSW;
}

createRoot(document.getElementById('root')!).render(<App />);
