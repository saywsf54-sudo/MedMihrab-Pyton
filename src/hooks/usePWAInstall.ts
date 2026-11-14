import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__pwaPrompt) {
      return window.__pwaPrompt;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Check if running inside iframe (which disables PWA install in browsers)
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    // Detect standalone mode (already installed on desktop or mobile)
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    // Check if early captured prompt exists
    if (window.__pwaPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__pwaPrompt);
    }

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleEarlyPromptAvailable = () => {
      if (window.__pwaPrompt) {
        setDeferredPrompt(window.__pwaPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__pwaPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handleEarlyPromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleEarlyPromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  const install = async (): Promise<boolean> => {
    const promptToUse = deferredPrompt || window.__pwaPrompt;
    if (!promptToUse) return false;
    try {
      await promptToUse.prompt();
      const choiceResult = await promptToUse.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        window.__pwaPrompt = null;
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Error during PWA installation:', err);
      return false;
    }
  };

  return {
    isInstallable: !!(deferredPrompt || (typeof window !== 'undefined' && window.__pwaPrompt)),
    isInstalled,
    isIOS,
    isInIframe,
    install,
    deferredPrompt: deferredPrompt || (typeof window !== 'undefined' ? window.__pwaPrompt : null)
  };
}
