import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { biText, UiLocale } from '../../data/i18n';

export interface VideoPlayerProps {
  src?: string;
  poster?: string;
  title: string;
  subtitle?: string;
  durationLabel?: string;
  locale?: UiLocale;
  lazy?: boolean;
  autoPlay?: boolean;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onVideoLoaded?: () => void;
}

const PLAYBACK_RATES = [0.75, 1, 1.5, 2] as const;

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  subtitle,
  durationLabel,
  locale = 'en',
  lazy = true,
  autoPlay = false,
  className = '',
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onVideoLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [inViewport, setInViewport] = useState<boolean>(!lazy);
  const [userActivated, setUserActivated] = useState<boolean>(autoPlay || !lazy);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [rateIndex, setRateIndex] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);

  const playbackRate = PLAYBACK_RATES[rateIndex];
  const shouldLoadAsset = Boolean(src) && (inViewport || userActivated);

  // Lazy-loading via IntersectionObserver so off-screen video assets do not preload eagerly
  useEffect(() => {
    if (!lazy) {
      setInViewport(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }
    const target = containerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInViewport(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [lazy]);

  // Reset player state whenever src changes
  useEffect(() => {
    setHasError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsBuffering(false);
  }, [src]);

  // Sync fullscreen document state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const togglePlay = async () => {
    if (!src) {
      onEmptyAction?.();
      return;
    }
    setUserActivated(true);
    setInViewport(true);
    const el = videoRef.current;
    if (!el) return;

    if (el.paused || el.ended) {
      try {
        setIsBuffering(true);
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      } finally {
        setIsBuffering(false);
      }
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (nextTime: number) => {
    const el = videoRef.current;
    setCurrentTime(nextTime);
    if (el && Number.isFinite(nextTime)) {
      el.currentTime = nextTime;
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (el) el.muted = nextMuted;
  };

  const cycleRate = () => {
    const nextIdx = (rateIndex + 1) % PLAYBACK_RATES.length;
    setRateIndex(nextIdx);
    if (videoRef.current) {
      videoRef.current.playbackRate = PLAYBACK_RATES[nextIdx];
    }
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen denial in restricted sandbox iframes
    }
  };

  const retryLoad = () => {
    setHasError(false);
    setUserActivated(true);
    setInViewport(true);
    const el = videoRef.current;
    if (el) {
      el.load();
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      data-testid="custom-video-player"
      data-lazy-loaded={shouldLoadAsset ? 'true' : 'false'}
      onMouseEnter={() => setControlsVisible(true)}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      className={`relative rounded-xl overflow-hidden border border-[#233349] bg-[#0B131E] text-white aspect-video select-none ${className}`}
    >
      {/* Video Element or Lazy/Empty Placeholder */}
      {src ? (
        <video
          ref={videoRef}
          src={shouldLoadAsset ? src : undefined}
          poster={poster}
          preload={shouldLoadAsset ? 'metadata' : 'none'}
          autoPlay={autoPlay && shouldLoadAsset}
          muted={isMuted}
          playsInline
          onClick={togglePlay}
          onLoadedMetadata={(e) => {
            const vid = e.currentTarget;
            setDuration(vid.duration || 0);
            vid.playbackRate = playbackRate;
          }}
          onLoadedData={() => {
            setIsBuffering(false);
            onVideoLoaded?.();
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setIsBuffering(false);
            setHasError(true);
          }}
          className="w-full h-full object-contain bg-[#08101A] cursor-pointer"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0E1928] to-[#08101A]">
          <p className="text-xs font-mono text-[#D9A441]">AD-PRMS · {durationLabel || 'HD WebM'}</p>
          <h4 className="text-base sm:text-lg font-semibold text-white mt-1.5 max-w-md text-balance">
            {emptyTitle ||
              biText(
                locale,
                'No Recorded Video Clip Selected Yet',
                'እስካሁን የተቀረጸ የቪዲዮ ክሊፕ አልተመረጠም'
              )}
          </h4>
          <p className="text-xs text-slate-300 mt-1.5 max-w-md leading-relaxed">
            {emptyDescription ||
              biText(
                locale,
                'Use Record Screen or Auto-Play & Record above to capture an Amharic presentation video directly into this player.',
                'የአማርኛ ማቅረቢያ ቪዲዮ በቀጥታ እዚህ ውስጥ ለመቅረጽ ከላይ ያለውን "ስክሪን ቅረጽ" ወይም "ራስ-ሰር አጫውትና ቅረጽ" ይጫኑ።'
              )}
          </p>
          {emptyActionLabel && onEmptyAction && (
            <button
              type="button"
              onClick={onEmptyAction}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#11513A] text-white text-xs font-semibold cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{emptyActionLabel}</span>
            </button>
          )}
        </div>
      )}

      {/* Top Brand Scrim Header */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 px-4 py-3 bg-gradient-to-b from-black/80 via-black/35 to-transparent transition-opacity duration-200 ${
          controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{title}</h4>
            {subtitle && (
              <p className="text-[11px] text-slate-300 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          {durationLabel && (
            <span className="text-[11px] font-mono tabular-nums text-[#D9A441] shrink-0">
              {durationLabel}
            </span>
          )}
        </div>
      </div>

      {/* Center Status / Play Overlay */}
      {src && !hasError && (!isPlaying || isBuffering) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={
              isPlaying
                ? biText(locale, 'Pause video', 'ቪዲዮ አቁም')
                : biText(locale, 'Play video', 'ቪዲዮ አጫውት')
            }
            className="pointer-events-auto w-14 h-14 rounded-full bg-[#0F233A]/90 hover:bg-[#166549] border border-[#D9A441]/60 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 cursor-pointer"
          >
            {isBuffering ? (
              <Loader2 className="w-6 h-6 animate-spin text-[#D9A441]" />
            ) : (
              <Play className="w-6 h-6 ml-0.5 text-white" />
            )}
          </button>
        </div>
      )}

      {/* Error State Overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-[#0B131E]/95 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-7 h-7 text-red-400 mb-2" />
          <p className="text-sm font-semibold text-white">
            {biText(locale, 'Unable to load video asset', 'የቪዲዮ ፋይሉን መጫን አልተቻለም')}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {biText(
              locale,
              'Check the video path or record a fresh WebM clip from the studio toolbar.',
              'የቪዲዮ አድራሻውን ያረጋግጡ ወይም አዲስ .webm ቅረጻ ይፍጠሩ።'
            )}
          </p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533C] text-xs font-semibold text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Retry Video', 'እንደገና ሞክር')}</span>
          </button>
        </div>
      )}

      {/* Bottom Brand-Aligned Custom Control Overlay */}
      {src && (
        <div
          data-testid="video-player-controls"
          className={`absolute inset-x-0 bottom-0 px-4 pt-8 pb-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent transition-opacity duration-200 ${
            controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Scrubber Bar */}
          <div className="relative flex items-center mb-2">
            <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-[#248F64] transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              aria-label={biText(locale, 'Seek video timeline', 'የቪዲዮ ጊዜ መፈለጊያ')}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={
                  isPlaying
                    ? biText(locale, 'Pause', 'አቁም')
                    : biText(locale, 'Play', 'አጫውት')
                }
                className="p-1.5 rounded-md hover:bg-white/15 text-white cursor-pointer shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={
                  isMuted
                    ? biText(locale, 'Unmute', 'ድምፅ ክፈት')
                    : biText(locale, 'Mute', 'ድምፅ ዝጋ')
                }
                className="p-1.5 rounded-md hover:bg-white/15 text-white cursor-pointer shrink-0"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <span className="font-mono tabular-nums text-[11px] text-slate-200 whitespace-nowrap">
                {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={cycleRate}
                aria-label={biText(locale, 'Playback speed', 'የማጫወቻ ፍጥነት')}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 font-mono tabular-nums text-[11px] font-semibold text-[#F3D082] cursor-pointer whitespace-nowrap"
              >
                {playbackRate}x
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={
                  isFullscreen
                    ? biText(locale, 'Exit fullscreen', 'ከሙሉ ስክሪን ውጣ')
                    : biText(locale, 'Fullscreen', 'ሙሉ ስክሪን')
                }
                className="p-1.5 rounded-md hover:bg-white/15 text-white cursor-pointer shrink-0"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
