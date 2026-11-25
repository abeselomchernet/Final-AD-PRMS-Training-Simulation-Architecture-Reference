import React, { useState } from 'react';
import { Download, RefreshCw, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';

export const PWAInstallButton: React.FC<{
  compact?: boolean;
  showGuideFallback?: boolean;
}> = ({ compact = false, showGuideFallback = false }) => {
  const { canInstall, isIOS, isStandalone, install } = usePWAInstall();
  const { locale } = usePrms();
  const [showInstructions, setShowInstructions] = useState(false);

  if (isStandalone) return null;
  if (!canInstall && !isIOS && !showGuideFallback) return null;

  const handleClick = async () => {
    if (canInstall) {
      const accepted = await install();
      if (!accepted && isIOS) setShowInstructions(true);
      return;
    }
    setShowInstructions(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={biText(locale, 'Install AD-PRMS App', 'AD-PRMS መተግበሪያን ጫን')}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          compact
            ? 'px-2.5 py-1.5 text-[11px] bg-[#166549] hover:bg-[#12533B] text-white min-h-[36px]'
            : 'px-3 py-2 text-xs bg-[#166549] hover:bg-[#12533B] text-white min-h-[40px]'
        }`}
      >
        {isIOS ? <Share className="w-3.5 h-3.5 shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
        <span>{biText(locale, 'Install App', 'መተግበሪያ ጫን')}</span>
      </button>

      {showInstructions && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#0D1D30] text-[#E5B85C] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="pwa-install-title" className="text-sm font-bold">
                    {biText(locale, 'Install AD-PRMS Mobile App', 'የAD-PRMS ሞባይል መተግበሪያን ይጫኑ')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {biText(
                      locale,
                      'Works offline & launches full-screen from your Home Screen.',
                      'ያለ ኢንተርኔትም ይሠራል፤ ከስልክዎ መነሻ ገጽ በቀጥታ ይከፈታል።'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                aria-label="Close install guide"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#162438] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#166549] dark:text-emerald-400">1.</span>
                  <span>
                    {biText(
                      locale,
                      'Tap the Share icon at the bottom of Safari.',
                      'በSafari ታችኛው ክፍል ላይ ያለውን የShare አዶ ይጫኑ።'
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#166549] dark:text-emerald-400">2.</span>
                  <span>
                    {biText(
                      locale,
                      'Scroll down and choose "Add to Home Screen".',
                      'ወደ ታች ሸብልለው "Add to Home Screen" የሚለውን ይምረጡ።'
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#166549] dark:text-emerald-400">3.</span>
                  <span>
                    {biText(
                      locale,
                      'Tap "Add" to install AD-PRMS on your device.',
                      'AD-PRMSን ለመጫን "Add" የሚለውን ይጫኑ።'
                    )}
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#166549] dark:text-emerald-400">1.</span>
                  <span>
                    {biText(
                      locale,
                      'Open your browser menu (⋮ in Chrome/Edge) or address-bar Install icon.',
                      'የአሳሽዎን ምናሌ (⋮ በChrome/Edge) ወይም የInstall አዶ ይክፈቱ።'
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#166549] dark:text-emerald-400">2.</span>
                  <span>
                    {biText(
                      locale,
                      'Select "Install AD-PRMS" or "Add to Home Screen".',
                      '"Install AD-PRMS" ወይም "Add to Home Screen" የሚለውን ይምረጡ።'
                    )}
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#0F233A] dark:bg-[#166549] text-white text-xs font-semibold cursor-pointer"
            >
              {biText(locale, 'Got it', 'ተረድቻለሁ')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const { isOnline, pendingSyncQueue, flushOfflineSyncQueue, locale } = usePrms();

  if (isOnline && pendingSyncQueue.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-3 py-2 text-xs font-medium flex flex-wrap items-center justify-between gap-2 border-b ${
        !isOnline
          ? 'bg-amber-950 text-amber-100 border-amber-800'
          : 'bg-emerald-950 text-emerald-100 border-emerald-800'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="w-3.5 h-3.5 shrink-0 text-[#E5B85C]" />
        <span className="truncate">
          {!isOnline
            ? biText(
                locale,
                `Offline — showing cached data (${pendingSyncQueue.length} queued actions)`,
                `ከመስመር ውጭ — የተቀመጠ መረጃ በመታየት ላይ (${pendingSyncQueue.length} የተጠራቀሙ ተግባራት)`
              )
            : biText(
                locale,
                `${pendingSyncQueue.length} offline queued action(s) ready to sync`,
                `${pendingSyncQueue.length} ከመስመር ውጭ የተያዙ ተግባራት ለማመሳሰል ዝግጁ ናቸው`
              )}
        </span>
      </div>
      {isOnline && pendingSyncQueue.length > 0 && (
        <button
          type="button"
          onClick={flushOfflineSyncQueue}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          <span>{biText(locale, 'Sync Now', 'አሁን አመሳስል')}</span>
        </button>
      )}
    </div>
  );
};
