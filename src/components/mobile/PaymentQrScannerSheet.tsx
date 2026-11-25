import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Camera, CheckCircle2, ImageUp, QrCode, RefreshCw, XCircle } from 'lucide-react';
import { UiLocale, biText } from '../../data/i18n';
import { ParsedPaymentQr, parsePaymentQrPayload } from '../../utils/paymentQr';
import { BottomSheet } from './BottomSheet';

export interface QrInvoiceMatchResult {
  matched: boolean;
  invoiceNumber?: string;
  reason?: string;
}

interface PaymentQrScannerSheetProps {
  open: boolean;
  onClose: () => void;
  onDecoded: (parsed: ParsedPaymentQr) => void;
  matchInvoice?: (parsed: ParsedPaymentQr) => QrInvoiceMatchResult;
  locale: UiLocale;
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]>;
};

type ScanFeedbackState =
  | {
      kind: 'success';
      title: string;
      detail: string;
    }
  | {
      kind: 'fail';
      title: string;
      detail: string;
    }
  | null;

export const PaymentQrScannerSheet: React.FC<PaymentQrScannerSheetProps> = ({
  open,
  onClose,
  onDecoded,
  matchInvoice,
  locale,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDecodedRef = useRef(false);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'unavailable'>('idle');
  const [cameraMessage, setCameraMessage] = useState<string>('');
  const [manualPayload, setManualPayload] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedbackState>(null);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    clearPendingTimer();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [clearPendingTimer]);

  const triggerFailFeedback = useCallback(
    (title: string, detail: string) => {
      hasDecodedRef.current = true;
      setScanError(detail);
      setScanFeedback({ kind: 'fail', title, detail });
      clearPendingTimer();
      timerRef.current = setTimeout(() => {
        hasDecodedRef.current = false;
      }, 650);
    },
    [clearPendingTimer]
  );

  const handleParsedSuccess = useCallback(
    (rawText: string) => {
      if (hasDecodedRef.current) return;
      const parsed = parsePaymentQrPayload(rawText);
      if (!parsed) {
        triggerFailFeedback(
          biText(locale, 'Invalid QR Payload', 'ልክ ያልሆነ የQR ኮድ'),
          biText(
            locale,
            'QR code did not contain a valid payment reference.',
            'የQR ኮዱ ትክክለኛ የክፍያ ማጣቀሻ አልያዘም።'
          )
        );
        return;
      }

      const matchResult = matchInvoice ? matchInvoice(parsed) : { matched: true };
      if (!matchResult.matched) {
        triggerFailFeedback(
          biText(locale, 'Invoice Match Failed', 'ተዛማጅ ደረሰኝ አልተገኘም'),
          matchResult.reason ||
            biText(
              locale,
              `Reference ${parsed.reference} could not be matched to an open invoice.`,
              `ማጣቀሻ ${parsed.reference} ከክፍት ደረሰኝ ጋር አልተዛመደም።`
            )
        );
        return;
      }

      hasDecodedRef.current = true;
      stopCamera();
      setScanError(null);
      setScanFeedback({
        kind: 'success',
        title: matchResult.invoiceNumber
          ? biText(
              locale,
              `Matched ${matchResult.invoiceNumber}`,
              `ከ ${matchResult.invoiceNumber} ጋር ተዛምዷል`
            )
          : biText(locale, 'Payment QR Matched', 'የክፍያ QR ተዛምዷል'),
        detail: `${parsed.gateway} · ${parsed.reference}`,
      });

      const delayMs = prefersReducedMotion ? 160 : 380;
      timerRef.current = setTimeout(() => {
        onDecoded(parsed);
      }, delayMs);
    },
    [locale, matchInvoice, onDecoded, prefersReducedMotion, stopCamera, triggerFailFeedback]
  );

  const startCamera = useCallback(async () => {
    stopCamera();
    hasDecodedRef.current = false;
    setScanError(null);
    setScanFeedback(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraState('unavailable');
      setCameraMessage(
        biText(
          locale,
          'Live camera API is unavailable in this browser/session. Upload a QR image or paste a QR payload below.',
          'በዚህ አሳሽ ውስጥ የቀጥታ ካሜራ አገልግሎት የለም። የQR ምስል ይስቀሉ ወይም የQR ኮድ ከታች ያስገቡ።'
        )
      );
      return;
    }

    setCameraState('starting');
    setCameraMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCameraState('scanning');

      const DetectorCtor = (
        window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
      ).BarcodeDetector;
      const detector = DetectorCtor ? new DetectorCtor({ formats: ['qr_code'] }) : null;

      let lastTick = 0;
      const scanFrame = async (ts: number) => {
        if (!streamRef.current || hasDecodedRef.current) return;
        const vid = videoRef.current;
        const canvas = canvasRef.current;

        if (vid && canvas && vid.readyState >= 2 && vid.videoWidth > 0 && ts - lastTick >= 140) {
          lastTick = ts;
          const width = vid.videoWidth;
          const height = vid.videoHeight;
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(vid, 0, 0, width, height);
            if (detector) {
              try {
                const detected = await detector.detect(canvas);
                const val = detected.find((d) => d.rawValue)?.rawValue;
                if (val) {
                  handleParsedSuccess(val);
                  return;
                }
              } catch {
                // Fall through to jsQR
              }
            }
            const imgData = ctx.getImageData(0, 0, width, height);
            const code = jsQR(imgData.data, width, height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code?.data) {
              handleParsedSuccess(code.data);
              return;
            }
          }
        }

        rafRef.current = requestAnimationFrame((nextTs) => {
          void scanFrame(nextTs);
        });
      };

      rafRef.current = requestAnimationFrame((ts) => {
        void scanFrame(ts);
      });
    } catch (err) {
      stopCamera();
      setCameraState('unavailable');
      const reason = err instanceof Error ? err.message : 'Permission denied';
      setCameraMessage(
        biText(
          locale,
          `Camera access unavailable (${reason}). Upload a QR screenshot or paste the QR payload below.`,
          `ካሜራ መክፈት አልተቻለም (${reason})። የQR ምስል ይስቀሉ ወይም የQR ኮድ ከታች ያስገቡ።`
        )
      );
    }
  }, [handleParsedSuccess, locale, stopCamera]);

  useEffect(() => {
    if (open) {
      void startCamera();
    } else {
      stopCamera();
      setCameraState('idle');
      setScanError(null);
      setScanFeedback(null);
    }
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanError(null);
    setScanFeedback(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read QR image file.'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Invalid image file.'));
        image.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        triggerFailFeedback(
          biText(locale, 'Decode Failed', 'ማንበብ አልተቻለም'),
          'Canvas decoding unavailable.'
        );
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (!decoded?.data) {
        triggerFailFeedback(
          biText(locale, 'QR Not Detected', 'QR ኮድ አልተገኘም'),
          biText(
            locale,
            'No readable QR code found in the selected image. Try a clearer crop of the Telebirr or ArifPay QR.',
            'በተመረጠው ምስል ውስጥ የሚነበብ QR ኮድ አልተገኘም። እባክዎ የቴሌብር ወይም አሪፍፔይ QR ምስል ይምረጡ።'
          )
        );
        return;
      }

      hasDecodedRef.current = false;
      handleParsedSuccess(decoded.data);
    } catch (err) {
      triggerFailFeedback(
        biText(locale, 'Upload Error', 'የፋይል ስህተት'),
        err instanceof Error ? err.message : 'Unable to decode uploaded QR image.'
      );
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPayload.trim()) return;
    hasDecodedRef.current = false;
    setScanFeedback(null);
    handleParsedSuccess(manualPayload.trim());
  };

  const viewfinderBorderClass =
    scanFeedback?.kind === 'success'
      ? 'border-emerald-500 ring-2 ring-emerald-500/40'
      : scanFeedback?.kind === 'fail'
        ? 'border-red-500 ring-2 ring-red-500/40'
        : 'border-[#233349]';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={biText(locale, 'Scan Telebirr / ArifPay QR', 'የቴሌብር / አሪፍፔይ QR ስካን ያድርጉ')}
      subtitle={biText(
        locale,
        'Point your camera at a checkout QR code to auto-populate the reference field',
        'የክፍያ ማጣቀሻውን በራስ-ሰር ለመሙላት ካሜራውን ወደ QR ኮዱ ያቅኑ'
      )}
    >
      <div
        className="space-y-4 text-xs"
        data-testid="payment-qr-scanner-sheet"
        data-scan-status={scanFeedback?.kind ?? 'idle'}
      >
        {/* Live Camera Viewfinder with Subtle Success / Fail Visual Feedback */}
        <motion.div
          animate={
            !prefersReducedMotion && scanFeedback?.kind === 'fail'
              ? { x: [0, -6, 6, -4, 4, 0] }
              : { x: 0 }
          }
          transition={{ duration: 0.32 }}
          className={`relative rounded-2xl overflow-hidden bg-[#08121E] border-2 aspect-4/3 flex items-center justify-center transition-colors ${viewfinderBorderClass}`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover ${cameraState === 'scanning' ? 'block' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          {cameraState === 'scanning' && !scanFeedback && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="w-44 h-44 relative">
                <span className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-[#E5B85C] rounded-tl-md" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-[#E5B85C] rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-[#E5B85C] rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-[#E5B85C] rounded-br-md" />
              </div>
              <span className="mt-3 px-2.5 py-1 rounded-md bg-black/70 text-[11px] font-mono text-white">
                {biText(locale, 'Align QR inside frame…', 'QR ኮዱን በክፈፉ ውስጥ ያስገቡ…')}
              </span>
            </div>
          )}

          {cameraState === 'starting' && !scanFeedback && (
            <div className="p-6 text-center text-slate-300 space-y-2">
              <Camera className="w-8 h-8 mx-auto text-[#E5B85C]" />
              <p>{biText(locale, 'Initializing device camera…', 'ካሜራ በመክፈት ላይ…')}</p>
            </div>
          )}

          {cameraState === 'unavailable' && !scanFeedback && (
            <div className="p-5 text-center text-slate-200 space-y-3 max-w-xs">
              <QrCode className="w-8 h-8 mx-auto text-[#E5B85C]" />
              <p className="text-xs leading-relaxed text-slate-300">{cameraMessage}</p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Retry Camera', 'ካሜራ እንደገና ሞክር')}</span>
              </button>
            </div>
          )}

          {/* Subtle Success / Fail Animation Overlay */}
          <AnimatePresence>
            {scanFeedback && (
              <motion.div
                key={scanFeedback.kind}
                initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.96 }}
                transition={{ duration: prefersReducedMotion ? 0.08 : 0.22 }}
                data-testid={`qr-scan-${scanFeedback.kind}-feedback`}
                className={`absolute inset-0 flex flex-col items-center justify-center p-5 text-center backdrop-blur-[2px] ${
                  scanFeedback.kind === 'success'
                    ? 'bg-emerald-950/85 text-emerald-50'
                    : 'bg-red-950/85 text-red-50'
                }`}
              >
                <div className="relative flex items-center justify-center mb-2.5">
                  {!prefersReducedMotion && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0.7 }}
                      animate={{ scale: 1.55, opacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className={`absolute w-14 h-14 rounded-full ${
                        scanFeedback.kind === 'success' ? 'bg-emerald-400/50' : 'bg-red-400/50'
                      }`}
                    />
                  )}
                  <motion.div
                    initial={{ scale: prefersReducedMotion ? 1 : 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      scanFeedback.kind === 'success'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {scanFeedback.kind === 'success' ? (
                      <CheckCircle2 className="w-7 h-7" />
                    ) : (
                      <XCircle className="w-7 h-7" />
                    )}
                  </motion.div>
                </div>
                <p className="text-sm font-bold">{scanFeedback.title}</p>
                <p className="text-[11px] font-mono opacity-90 mt-1 max-w-xs break-all">
                  {scanFeedback.detail}
                </p>
                {scanFeedback.kind === 'fail' && (
                  <button
                    type="button"
                    onClick={() => {
                      hasDecodedRef.current = false;
                      setScanFeedback(null);
                      setScanError(null);
                    }}
                    className="mt-3 min-h-[36px] px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {biText(locale, 'Dismiss & Scan Again', 'ዝጋና እንደገና ስካን አድርግ')}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {scanError && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2 text-red-800 dark:text-red-200"
          >
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{scanError}</span>
          </div>
        )}

        {/* Fallback 1: Upload QR Image */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#DFE5EE] dark:border-[#233349]">
          <label className="w-full min-h-[44px] rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236] hover:border-[#166549] font-semibold flex items-center justify-center gap-2 cursor-pointer px-3">
            <ImageUp className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
            <span>{biText(locale, 'Upload QR Screenshot / Image', 'የQR ምስል ከፋይል ይስቀሉ')}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void handleUploadQrImage(e)}
              className="sr-only"
            />
          </label>
        </div>

        {/* Fallback 2: Paste QR Payload (for desktop training / verification) */}
        <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t border-[#DFE5EE] dark:border-[#233349]">
          <label htmlFor="manual-qr-payload" className="block font-semibold text-slate-700 dark:text-slate-200">
            {biText(locale, 'Or Paste Decoded QR Payload', 'ወይም የQR መረጃ እዚህ ያስገቡ')}
          </label>
          <div className="flex gap-2">
            <input
              id="manual-qr-payload"
              type="text"
              value={manualPayload}
              onChange={(e) => setManualPayload(e.target.value)}
              placeholder="telebirr://pay?merch=204910&inv=... or AP-SESS-..."
              className="flex-1 min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236] font-mono text-[11px]"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer shrink-0"
            >
              {biText(locale, 'Apply', 'አስገባ')}
            </button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
};
