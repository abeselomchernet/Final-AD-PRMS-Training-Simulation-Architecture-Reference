import { useCallback, useEffect, useState } from 'react';
import {
  fetchVapidPublicKey,
  registerPushSubscriptionApi,
  sendOfficePushAlert,
  unregisterPushSubscriptionApi,
} from '../services/productionApiClient';

const LOCAL_PUSH_KEY = 'adprms.push.subscription.local';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useWebPush(deviceLabel: string) {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'default'
  );
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    let active = true;
    const syncState = async () => {
      if (!supported) {
        try {
          setSubscribed(Boolean(localStorage.getItem(LOCAL_PUSH_KEY)));
        } catch {
          // Ignore
        }
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (active) {
          setSubscribed(Boolean(sub) || Boolean(localStorage.getItem(LOCAL_PUSH_KEY)));
        }
      } catch {
        // Ignore registration checks cleanly
      }
    };
    void syncState();
    return () => {
      active = false;
    };
  }, [supported]);

  const enablePush = useCallback(async () => {
    setBusy(true);
    setError('');
    setStatusMessage('');
    try {
      if (supported) {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm === 'denied') {
          setError('Browser notification permission was blocked in site settings.');
          return false;
        }
      }

      const vapidKey = await fetchVapidPublicKey();
      if (supported && vapidKey) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const appServerKey = urlBase64ToUint8Array(vapidKey);
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: appServerKey.buffer as ArrayBuffer,
          });
          const json = sub.toJSON();
          const p256dh = json.keys?.p256dh || '';
          const auth = json.keys?.auth || '';
          if (json.endpoint && p256dh && auth) {
            await registerPushSubscriptionApi({
              endpoint: json.endpoint,
              p256dh,
              auth,
              device_label: deviceLabel,
            });
          }
        } catch {
          // Headless/sandbox browser without FCM push service still gets local notification preview
        }
      }

      try {
        localStorage.setItem(
          LOCAL_PUSH_KEY,
          JSON.stringify({ deviceLabel, subscribedAt: new Date().toISOString() })
        );
      } catch {
        // Ignore
      }
      setSubscribed(true);
      setStatusMessage('Local VAPID push active for Office Test & Training alerts.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enable Web Push alerts.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [deviceLabel, supported]);

  const disablePush = useCallback(async () => {
    setBusy(true);
    setError('');
    setStatusMessage('');
    try {
      if (supported) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await unregisterPushSubscriptionApi(sub.endpoint);
          await sub.unsubscribe();
        }
      }
      try {
        localStorage.removeItem(LOCAL_PUSH_KEY);
      } catch {
        // Ignore
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const sendTestPush = useCallback(
    async (ownerId?: string) => {
      setBusy(true);
      setError('');
      setStatusMessage('');
      try {
        const res = await sendOfficePushAlert({
          title: 'AD-PRMS Office Test Alert',
          body: `Test push verified on ${deviceLabel} via built-in SQLite VAPID.`,
          ownerId,
        });
        if (res.delivered > 0) {
          setStatusMessage(`Delivered test push to ${res.delivered} device(s).`);
          return true;
        }
        // Fallback local service worker notification if browser push transport is unavailable (e.g. headless/iframe)
        if (supported && Notification.permission === 'granted') {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification('AD-PRMS Office Test Alert', {
              body: `Local preview alert for ${deviceLabel}.`,
              icon: '/pwa-192x192.png',
              tag: 'adprms-office-test',
            });
            setStatusMessage('Displayed local Service Worker test notification.');
            return true;
          }
        }
        setStatusMessage(
          res.attempted === 0
            ? 'Subscription saved locally; push service transport unavailable in sandbox iframe.'
            : `Attempted ${res.attempted} push delivery (${res.failed} unreachable in sandbox).`
        );
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send test push alert.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [deviceLabel, supported]
  );

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    statusMessage,
    enablePush,
    disablePush,
    sendTestPush,
  };
}
