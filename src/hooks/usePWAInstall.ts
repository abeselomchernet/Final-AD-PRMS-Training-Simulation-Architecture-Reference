import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStandalone = () => {
      const displayStandalone =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches;
      const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      const standalone = displayStandalone || iosStandalone;
      setIsStandalone(standalone);
      if (standalone) setIsInstalled(true);
    };

    checkStandalone();

    const ua = window.navigator.userAgent || '';
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
      return true;
    }
    return false;
  }, [installPrompt]);

  return {
    canInstall: Boolean(installPrompt) && !isInstalled && !isStandalone,
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    isIOS: isIOS && !isStandalone,
    install,
  };
}
