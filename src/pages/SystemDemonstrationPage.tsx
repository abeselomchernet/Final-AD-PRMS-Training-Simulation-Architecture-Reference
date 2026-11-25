import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  FileText,
  Film,
  Languages,
  Pause,
  Play,
  RotateCcw,
  Square,
  Video,
} from 'lucide-react';
import {
  DEMO_SCENARIOS,
  DemoScenario,
  DemoStakeholderId,
  formatAmharicCueHandout,
  STAKEHOLDER_CHAPTERS,
} from '../data/demoWalkthroughs';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { getModuleAccess } from '../policies/rbac';
import { WalkthroughScenePlayer } from '../components/demo/WalkthroughScenePlayer';
import { PresentationCues } from '../components/demo/PresentationCues';
import { TranscriptDisplayMode, TranscriptPanel } from '../components/demo/TranscriptPanel';
import { GovernanceCallout, Modal, StatusLabel } from '../components/ui/Primitives';
import { VideoPlayer } from '../components/ui/VideoPlayer';

type RecordingState = 'idle' | 'recording' | 'ready' | 'error';

const DEMO_PROGRESS_STORAGE_KEY = 'ad_prms_demo_completed_chapters_v1';
const EXECUTIVE_CHAPTER_IDS: DemoStakeholderId[] = ['owner', 'gm', 'finance', 'clerks'];

function formatElapsedTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const SystemDemonstrationPage: React.FC = () => {
  const {
    locale,
    setLocale,
    dateMode,
    setDateMode,
    currentPersona,
    activeOwner,
    setActiveSection,
    ownerApprovals,
    ownerAuditEvents,
    ownerCharges,
    ownerReceipts,
    ownerGatewayPayments,
    ownerThreeWayDeposit,
    ownerAccountingPeriods,
    ownerTrialBalance,
    ownerBuildings,
    ownerUnits,
    ownerDelegations,
    ownerTaxRules,
    taxRuleRegister,
    ownerBackupDrills,
    fmtShortEtb,
  } = usePrms();

  const [stakeholderFilter, setStakeholderFilter] = useState<'all' | DemoStakeholderId>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(DEMO_SCENARIOS[0].id);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.75 | 1 | 1.5>(1);
  const [stageMode, setStageMode] = useState<'interactive' | 'video'>('interactive');
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [transcriptDisplayMode, setTranscriptDisplayMode] =
    useState<TranscriptDisplayMode>('side');

  // Persistent Executive Presentation Progress Tracker (Owner, GM, Finance Head, Clerk)
  const [completedChapters, setCompletedChapters] = useState<DemoStakeholderId[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(DEMO_PROGRESS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is DemoStakeholderId =>
        EXECUTIVE_CHAPTER_IDS.includes(id as DemoStakeholderId)
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        DEMO_PROGRESS_STORAGE_KEY,
        JSON.stringify(completedChapters)
      );
    } catch {
      // Ignore storage quota or restricted context errors
    }
  }, [completedChapters]);

  const toggleChapterCompleted = (chapterId: DemoStakeholderId) => {
    setCompletedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const resetChapterProgress = () => {
    setCompletedChapters([]);
  };

  const executiveChapterItems = useMemo(
    () =>
      STAKEHOLDER_CHAPTERS.filter((c): c is typeof c & { id: DemoStakeholderId } =>
        EXECUTIVE_CHAPTER_IDS.includes(c.id as DemoStakeholderId)
      ),
    []
  );

  const coveragePercent = Math.round(
    (completedChapters.length / EXECUTIVE_CHAPTER_IDS.length) * 100
  );

  // Real live system status computed from active owner workspace state
  const liveScenarioStatusMap = useMemo(() => {
    const pendingApprovals = ownerApprovals.filter(
      (a) => a.status === 'Pending' || a.status === 'In Review'
    ).length;
    const approvedApprovals = ownerApprovals.filter(
      (a) => a.finalized || a.status === 'Approved'
    ).length;

    const openOrOverdueCharges = ownerCharges.filter(
      (c) => c.status === 'Open' || c.status === 'Overdue' || c.status === 'Partially Paid'
    ).length;
    const pendingGatewayCount = ownerGatewayPayments.filter(
      (g) => g.status === 'Pending Verification'
    ).length;
    const totalCollectedEtb = ownerReceipts.reduce((sum, r) => sum + r.amountEtb, 0);

    const closedPeriodCount = ownerAccountingPeriods.filter((p) => p.status === 'Closed').length;
    const depositEtb = ownerThreeWayDeposit.liability2120Cents / 100;
    const depositBalanced = ownerThreeWayDeposit.balanced && ownerTrialBalance.balanced;

    const occupiedUnitCount = ownerUnits.filter((u) => u.status === 'Occupied').length;
    const activeDelegationCount = ownerDelegations.filter((d) => d.status === 'Active').length;

    const confirmedTaxSignoffs = taxRuleRegister.filter(
      (item) => item.signOffStatus === 'Adviser Confirmed'
    ).length;
    const completedDrillCount = ownerBackupDrills.filter(
      (d) => d.status === 'Completed (Sim)' || d.status === 'Approved Drill (Sim)'
    ).length;
    const activeTaxRuleCount = ownerTaxRules.filter((t) => t.lifecycleStage === 'Active').length;

    const map: Record<string, { statusLabel: string; detailLine: string }> = {
      'demo-maker-checker': {
        statusLabel: pendingApprovals > 0 ? 'Pending' : 'Approved',
        detailLine: biText(
          locale,
          `${pendingApprovals} Pending · ${approvedApprovals} Approved · ${ownerAuditEvents.length} Audit Logs`,
          `${pendingApprovals} በመጠባበቅ ላይ · ${approvedApprovals} የጸደቁ · ${ownerAuditEvents.length} ኦዲት መዝገቦች`
        ),
      },
      'demo-tenant-collection': {
        statusLabel: pendingGatewayCount > 0 ? 'Pending' : 'Paid',
        detailLine: biText(
          locale,
          `${ownerReceipts.length} Receipts (${fmtShortEtb(totalCollectedEtb)}) · ${openOrOverdueCharges} Open Invoices`,
          `${ownerReceipts.length} ደረሰኞች (${fmtShortEtb(totalCollectedEtb)}) · ${openOrOverdueCharges} ክፍት ሂሳቦች`
        ),
      },
      'demo-three-way-deposit': {
        statusLabel: depositBalanced ? 'Pass' : 'Pending',
        detailLine: biText(
          locale,
          `${depositBalanced ? '3-Way Balanced' : 'Variance Alert'} · GL 2120 ${fmtShortEtb(depositEtb)} · ${closedPeriodCount}/${ownerAccountingPeriods.length} Closed`,
          `${depositBalanced ? '3-ዮሽ ሚዛን የተመጣጠነ' : 'ልዩነት ተገኝቷል'} · GL 2120 ${fmtShortEtb(depositEtb)} · ${closedPeriodCount}/${ownerAccountingPeriods.length} የተዘጉ`
        ),
      },
      'demo-owner-mobile': {
        statusLabel: 'Active',
        detailLine: biText(
          locale,
          `${ownerBuildings.length} ${ownerBuildings.length === 1 ? 'Building' : 'Buildings'} · ${occupiedUnitCount}/${ownerUnits.length} Occupied · ${activeDelegationCount} ${activeDelegationCount === 1 ? 'Active Delegation' : 'Active Delegations'}`,
          `${ownerBuildings.length} ሕንፃዎች · ${occupiedUnitCount}/${ownerUnits.length} የተያዙ ክፍሎች · ${activeDelegationCount} ንቁ ውክልናዎች`
        ),
      },
      'demo-erca-tax': {
        statusLabel: activeTaxRuleCount > 0 ? 'Active' : 'Draft',
        detailLine: biText(
          locale,
          `${confirmedTaxSignoffs}/${taxRuleRegister.length} Adviser Confirmed · ${completedDrillCount} Backup Drills`,
          `${confirmedTaxSignoffs}/${taxRuleRegister.length} በአማካሪ የተረጋገጡ · ${completedDrillCount} የምትኬ ሙከራዎች`
        ),
      },
    };
    return map;
  }, [
    fmtShortEtb,
    locale,
    ownerAccountingPeriods,
    ownerApprovals,
    ownerAuditEvents.length,
    ownerBackupDrills,
    ownerBuildings.length,
    ownerCharges,
    ownerDelegations,
    ownerGatewayPayments,
    ownerReceipts,
    ownerTaxRules,
    ownerThreeWayDeposit.balanced,
    ownerThreeWayDeposit.liability2120Cents,
    ownerTrialBalance.balanced,
    ownerUnits,
    taxRuleRegister,
  ]);

  // Real Browser MediaRecorder state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingElapsedSec, setRecordingElapsedSec] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedFileName, setRecordedFileName] = useState<string>('ad-prms-amharic-demo.webm');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chapterTabRailRef = useRef<HTMLDivElement | null>(null);
  const uploadVideoInputRef = useRef<HTMLInputElement | null>(null);

  const filteredScenarios = useMemo(() => {
    if (stakeholderFilter === 'all') return DEMO_SCENARIOS;
    return DEMO_SCENARIOS.filter((s) => s.stakeholders.includes(stakeholderFilter));
  }, [stakeholderFilter]);

  const selectedScenario: DemoScenario = useMemo(() => {
    return (
      filteredScenarios.find((s) => s.id === selectedScenarioId) ||
      filteredScenarios[0] ||
      DEMO_SCENARIOS[0]
    );
  }, [filteredScenarios, selectedScenarioId]);

  const activeKeyframe =
    selectedScenario.keyframes[
      Math.max(0, Math.min(activeStepIndex, selectedScenario.keyframes.length - 1))
    ];

  const targetAccess = getModuleAccess(currentPersona.role, selectedScenario.targetSection);
  const isAmharicExecutiveMode = locale === 'am' && dateMode === 'dual';

  // Keep selected scenario synced if filter changes
  useEffect(() => {
    if (!filteredScenarios.some((s) => s.id === selectedScenarioId) && filteredScenarios[0]) {
      setSelectedScenarioId(filteredScenarios[0].id);
      setActiveStepIndex(0);
      setIsPlaying(false);
    }
  }, [filteredScenarios, selectedScenarioId]);

  // Auto-advance simulated UI frames when playing
  useEffect(() => {
    if (!isPlaying) return;
    const stepDwellMs = Math.round(6500 / playbackSpeed);
    const timer = window.setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev + 1 < selectedScenario.keyframes.length) {
          return prev + 1;
        }
        // Advance cleanly into the next filtered scenario, or stop at end
        const currentIdx = filteredScenarios.findIndex((s) => s.id === selectedScenario.id);
        if (currentIdx >= 0 && currentIdx + 1 < filteredScenarios.length) {
          setSelectedScenarioId(filteredScenarios[currentIdx + 1].id);
          return 0;
        }
        setIsPlaying(false);
        return prev;
      });
    }, stepDwellMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, selectedScenario, filteredScenarios]);

  // Recording elapsed stopwatch
  useEffect(() => {
    if (recordingState !== 'recording') return;
    const timer = window.setInterval(() => {
      setRecordingElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recordingState]);

  // Clean up media stream & blob URL on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
      if (customVideoUrl) {
        URL.revokeObjectURL(customVideoUrl);
      }
    };
  }, [recordedVideoUrl, customVideoUrl]);

  const activeChapter = useMemo(
    () =>
      STAKEHOLDER_CHAPTERS.find((c) => c.id === stakeholderFilter) ||
      STAKEHOLDER_CHAPTERS[0],
    [stakeholderFilter]
  );

  const scrollChapterTabs = (direction: 'left' | 'right') => {
    const rail = chapterTabRailRef.current;
    if (!rail || typeof rail.scrollBy !== 'function') return;
    rail.scrollBy({
      left: direction === 'left' ? -220 : 220,
      behavior: 'smooth',
    });
  };

  const handleSelectChapter = (
    chapterId: 'all' | DemoStakeholderId,
    buttonEl?: HTMLButtonElement | null
  ) => {
    setStakeholderFilter(chapterId);
    if (buttonEl && typeof buttonEl.scrollIntoView === 'function') {
      buttonEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleUploadVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customVideoUrl) {
      URL.revokeObjectURL(customVideoUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setCustomVideoUrl(nextUrl);
    setStageMode('video');
  };

  const selectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setActiveStepIndex(0);
    setIsPlaying(false);
  };

  const toggleAmharicExecutiveMode = () => {
    if (isAmharicExecutiveMode) {
      setLocale('en');
    } else {
      setLocale('am');
      setDateMode('dual');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = async (autoPlay: boolean) => {
    setRecordingError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setRecordingState('error');
      setRecordingError(
        biText(
          locale,
          'Screen capture is unavailable in this browser context. Run "npm run record:demo" in your terminal to render an automated Amharic .webm presentation video.',
          'በዚህ አሳሽ ውስጥ የስክሪን ቀረጻ አይደገፍም። በተርሚናል "npm run record:demo" በማስኬድ ራስ-ሰር የአማርኛ .webm ቪዲዮ መቅረጽ ይችላሉ።'
        )
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });

      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
      }

      const preferredTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const mimeType =
        preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: mimeType || 'video/webm',
        });
        const nextUrl = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        setRecordedVideoUrl(nextUrl);
        setRecordedFileName(`ad-prms-amharic-presentation-${timestamp}.webm`);
        setRecordingState('ready');
        setIsPlaying(false);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
      };

      // Stop recording cleanly if user clicks Chrome's built-in "Stop sharing" bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        };
      }

      recorder.start(500);
      setRecordingElapsedSec(0);
      setRecordingState('recording');

      if (autoPlay) {
        setActiveStepIndex(0);
        setIsPlaying(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRecordingState('error');
      setRecordingError(
        biText(
          locale,
          `Recording canceled or permission denied (${message}). You can still run "npm run record:demo" for an unattended .webm video.`,
          `ቀረጻው ተቋርጧል ወይም ፈቃድ አልተሰጠም (${message})። ከፈለጉ "npm run record:demo" በመጠቀም ራስ-ሰር .webm ቪዲዮ መፍጠር ይችላሉ።`
        )
      );
    }
  };

  const handleDownloadHandout = () => {
    const content = formatAmharicCueHandout(filteredScenarios);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ad-prms-amharic-presenter-cues.txt';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Studio Control Header */}
      <section className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] p-5 shadow-xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Film className="w-5 h-5 text-[#166549] dark:text-[#34B684] shrink-0" />
              <h2 className="text-lg font-bold text-[#0F1D2F] dark:text-slate-100">
                {biText(
                  locale,
                  'Inaugural Amharic Presentation & Video Demo Studio',
                  'የመጀመሪያ የአማርኛ የሥርዓት ማቅረቢያና የቪዲዮ መቅረጫ ስቱዲዮ'
                )}
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {biText(
                locale,
                `${activeOwner.name} · 4 Stakeholder Chapters · ${DEMO_SCENARIOS.length} Interactive Workflows · Live Browser .webm Recorder`,
                `${activeOwner.name} · 4 የባለድርሻ አካላት ምዕራፎች · ${DEMO_SCENARIOS.length} ቀጥታ የሥራ ሂደቶች · የቪዲዮ መቅረጫ`
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleAmharicExecutiveMode}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isAmharicExecutiveMode
                  ? 'bg-[#166549] text-white border-[#166549]'
                  : 'bg-slate-50 dark:bg-[#162438] text-[#0F1D2F] dark:text-slate-100 border-[#DFE5EE] dark:border-[#233349] hover:bg-slate-100 dark:hover:bg-[#1D2E47]'
              }`}
            >
              <Languages className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isAmharicExecutiveMode
                  ? 'አማርኛ የአመራር ሁነታ ነቅቷል (Switch EN)'
                  : 'አማርኛ የአመራር ሁነታ (Amharic Executive Mode)'}
              </span>
            </button>

            {recordingState === 'recording' ? (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
              >
                <Square className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {biText(
                    locale,
                    `Stop Recording (${formatElapsedTime(recordingElapsedSec)})`,
                    `ቀረጻ አቁም (${formatElapsedTime(recordingElapsedSec)})`
                  )}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startRecording(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1D2E47] text-[#0F1D2F] dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Video className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{biText(locale, 'Record Screen (.webm)', 'ስክሪን ቅረጽ (.webm)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => startRecording(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#0F233A] dark:bg-[#248F64] hover:opacity-95 text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span>{biText(locale, 'Auto-Play & Record', 'ራስ-ሰር አጫውትና ቅረጽ')}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownloadHandout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1D2E47] text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{biText(locale, 'Download Cue Sheet (.txt)', 'የንግግር መመሪያ አውርድ (.txt)')}</span>
            </button>
          </div>
        </div>

        {/* Recording Output or Diagnostic Notice */}
        {recordingState === 'ready' && recordedVideoUrl && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-emerald-950 dark:text-emerald-100">
                {biText(
                  locale,
                  `Recording Ready: ${recordedFileName}`,
                  `የተቀረጸው ቪዲዮ ዝግጁ ነው፡ ${recordedFileName}`
                )}
              </p>
              <p className="text-emerald-800 dark:text-emerald-200 tabular-nums">
                {biText(
                  locale,
                  `Duration ${formatElapsedTime(recordingElapsedSec)} · Format WebM`,
                  `ቆይታ ${formatElapsedTime(recordingElapsedSec)} · WebM`
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="px-3 py-1.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#111C2C] text-emerald-900 dark:text-emerald-100 font-semibold cursor-pointer whitespace-nowrap"
              >
                {biText(locale, 'Preview Recording', 'ቪዲዮውን እይ')}
              </button>
              <a
                href={recordedVideoUrl}
                download={recordedFileName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#166549] text-white font-semibold whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                {biText(locale, 'Save .webm Video', '.webm አውርድ')}
              </a>
            </div>
          </div>
        )}

        {recordingState === 'error' && recordingError && (
          <GovernanceCallout
            variant="warning"
            title={biText(locale, 'Browser Recording Notice', 'የቪዲዮ መቅረጫ ማሳሰቢያ')}
            description={recordingError}
          />
        )}

        {/* Horizontal Scrollable Stakeholder Chapter Tab Navigation */}
        <div className="pt-2 border-t border-[#EAEFF5] dark:border-[#1E2E43] space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollChapterTabs('left')}
              aria-label={biText(locale, 'Scroll chapters left', 'ምዕራፎችን ወደ ግራ ሸብልል')}
              className="p-1.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1D2E47] cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={chapterTabRailRef}
              role="tablist"
              data-testid="horizontal-chapter-tabs"
              aria-label={biText(locale, 'Stakeholder Chapters', 'የባለድርሻ አካላት ምዕራፎች')}
              className="flex-1 flex flex-nowrap items-center gap-2 overflow-x-auto scroll-smooth pb-1"
            >
              {STAKEHOLDER_CHAPTERS.map((chapter) => {
                const active = stakeholderFilter === chapter.id;
                const isCompleted =
                  chapter.id !== 'all' &&
                  completedChapters.includes(chapter.id as DemoStakeholderId);
                const chapterCount =
                  chapter.id === 'all'
                    ? DEMO_SCENARIOS.length
                    : DEMO_SCENARIOS.filter((s) =>
                        s.stakeholders.includes(chapter.id as DemoStakeholderId)
                      ).length;

                return (
                  <button
                    key={chapter.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={(e) => handleSelectChapter(chapter.id, e.currentTarget)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-2 border ${
                      active
                        ? 'bg-[#0F233A] dark:bg-[#248F64] text-white border-[#0F233A] dark:border-[#248F64]'
                        : 'bg-slate-100 dark:bg-[#162438] text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-[#1D2E47]'
                    }`}
                  >
                    {isCompleted && (
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active ? 'text-[#F3D082]' : 'text-[#166549] dark:text-[#34B684]'
                        }`}
                      />
                    )}
                    <span>{biText(locale, chapter.labelEn, chapter.labelAm)}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        active ? 'text-[#F3D082]' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {chapterCount}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollChapterTabs('right')}
              aria-label={biText(locale, 'Scroll chapters right', 'ምዕራፎችን ወደ ቀኝ ሸብልል')}
              className="p-1.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1D2E47] cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-[#0F1D2F] dark:text-slate-200">
              {biText(locale, activeChapter.labelEn, activeChapter.labelAm)}
            </span>{' '}
            <span aria-hidden="true">·</span>{' '}
            <span>{biText(locale, activeChapter.roleFocusEn, activeChapter.roleFocusAm)}</span>
          </p>

          {/* Persistent Executive Chapter Coverage Progress Tracker */}
          <div
            data-testid="demo-progress-tracker"
            className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#0D1624] p-3 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#0F1D2F] dark:text-slate-100">
                  {biText(
                    locale,
                    'Executive Presentation Coverage',
                    'የአመራር ገለጻ ሽፋን መከታተያ'
                  )}
                </span>
                <span
                  data-testid="demo-progress-summary"
                  className="font-mono tabular-nums text-slate-600 dark:text-slate-300"
                >
                  {completedChapters.length} / {EXECUTIVE_CHAPTER_IDS.length}{' '}
                  {biText(locale, 'Chapters', 'ምዕራፎች')} · {coveragePercent}%
                </span>
                {completedChapters.length === EXECUTIVE_CHAPTER_IDS.length && (
                  <StatusLabel label="Completed" tone="green" />
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {stakeholderFilter !== 'all' && (
                  <button
                    type="button"
                    data-testid="mark-active-chapter-complete-btn"
                    onClick={() => toggleChapterCompleted(stakeholderFilter)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      completedChapters.includes(stakeholderFilter)
                        ? 'bg-[#166549] text-white border-[#166549]'
                        : 'bg-white dark:bg-[#111C2C] text-[#166549] dark:text-[#34B684] border-[#166549]/40 hover:bg-[#F3FAF6] dark:hover:bg-[#122623]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {completedChapters.includes(stakeholderFilter)
                        ? biText(locale, 'Chapter Covered', 'ምዕራፉ ተሸፍኗል')
                        : biText(locale, 'Mark Chapter Covered', 'ምዕራፉን እንደተጠናቀቀ ምልክት አድርግ')}
                    </span>
                  </button>
                )}

                {completedChapters.length > 0 && (
                  <button
                    type="button"
                    data-testid="reset-demo-progress-btn"
                    onClick={resetChapterProgress}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1D2E47] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span>{biText(locale, 'Reset Progress', 'እድገቱን ዳግም አስጀምር')}</span>
                  </button>
                )}
              </div>
            </div>

            <div
              role="progressbar"
              aria-label={biText(
                locale,
                'Executive presentation chapter completion percentage',
                'የአመራር ገለጻ ምዕራፍ መጠናቀቅ መቶኛ'
              )}
              aria-valuenow={coveragePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#1D2E47] overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-[#166549] dark:bg-[#34B684] transition-all duration-300"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {executiveChapterItems.map((chapter) => {
                const isDone = completedChapters.includes(chapter.id);
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    data-testid={`progress-chapter-${chapter.id}`}
                    aria-pressed={isDone}
                    onClick={() => toggleChapterCompleted(chapter.id)}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                      isDone
                        ? 'bg-[#F3FAF6] dark:bg-[#122623] border-[#166549]/60 dark:border-[#248F64] text-[#0F1D2F] dark:text-emerald-100'
                        : 'bg-white dark:bg-[#111C2C] border-[#DFE5EE] dark:border-[#233349] text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="truncate">{biText(locale, chapter.labelEn, chapter.labelAm)}</span>
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#166549] dark:text-[#34B684] shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main 2-Column Theater Stage + Synchronized Amharic Presenter Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Interactive Walkthrough Stage / Reusable Lazy VideoPlayer + Transport Bar + Dynamic Transcript */}
        <div className="lg:col-span-8 space-y-3">
          {/* Stage Surface Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#162438] border border-[#DFE5EE] dark:border-[#233349]">
              <button
                type="button"
                onClick={() => setStageMode('interactive')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  stageMode === 'interactive'
                    ? 'bg-white dark:bg-[#0F233A] text-[#0F1D2F] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0F1D2F] dark:hover:text-white'
                }`}
              >
                {biText(locale, 'Interactive Walkthrough', 'ቀጥታ የሥርዓት ማሳያ')}
              </button>
              <button
                type="button"
                onClick={() => setStageMode('video')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  stageMode === 'video'
                    ? 'bg-white dark:bg-[#0F233A] text-[#0F1D2F] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0F1D2F] dark:hover:text-white'
                }`}
              >
                {biText(locale, 'Video Explainer Player', 'የቪዲዮ ማጫወቻ')}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="transcript-toggle-btn"
                aria-pressed={showTranscript}
                onClick={() => setShowTranscript((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  showTranscript
                    ? 'bg-[#0F233A] dark:bg-[#248F64] text-white border-[#0F233A] dark:border-[#248F64]'
                    : 'bg-white dark:bg-[#162438] text-[#0F1D2F] dark:text-slate-100 border-[#DFE5EE] dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#1D2E47]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>{biText(locale, 'Transcript', 'ሙሉ ጽሑፍ (Transcript)')}</span>
              </button>

              <input
                ref={uploadVideoInputRef}
                type="file"
                accept="video/webm,video/mp4"
                onChange={handleUploadVideoFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => uploadVideoInputRef.current?.click()}
                className="text-xs font-semibold text-[#166549] dark:text-[#47C794] hover:underline cursor-pointer whitespace-nowrap"
              >
                {biText(locale, 'Load Local .webm/.mp4 Video', 'የተቀረጸ .webm/.mp4 ፋይል ክፈት')}
              </button>
            </div>
          </div>

          {stageMode === 'interactive' ? (
            <WalkthroughScenePlayer
              scenario={selectedScenario}
              activeStepIndex={activeStepIndex}
              locale={locale}
              isPlaying={isPlaying}
              onStepSelect={(idx) => {
                setActiveStepIndex(idx);
                setIsPlaying(false);
              }}
            />
          ) : (
            <VideoPlayer
              src={customVideoUrl || recordedVideoUrl || undefined}
              title={biText(locale, selectedScenario.titleEn, selectedScenario.titleAm)}
              subtitle={`${biText(
                locale,
                selectedScenario.audienceLabelEn,
                selectedScenario.audienceLabelAm
              )} · ${selectedScenario.keyframes.length} ${biText(locale, 'Steps', 'ደረጃዎች')}`}
              durationLabel={selectedScenario.totalDurationLabel}
              locale={locale}
              lazy
              emptyTitle={biText(
                locale,
                `Video Explainer Slot — ${selectedScenario.titleEn}`,
                `የቪዲዮ ማጫወቻ — ${selectedScenario.titleAm}`
              )}
              emptyDescription={biText(
                locale,
                'Record this walkthrough using Auto-Play & Record, run "npm run record:demo", or load a .webm/.mp4 recording to watch with custom brand controls.',
                'ይህን ማሳያ በ"ራስ-ሰር አጫውትና ቅረጽ" ይቅረጹ ወይም የተቀመጠ .webm/.mp4 ቪዲዮ በመጫን እዚህ ያጫውቱ።'
              )}
              emptyActionLabel={biText(locale, 'Start Auto-Play & Record', 'ራስ-ሰር ቀረጻ ጀምር')}
              onEmptyAction={() => startRecording(true)}
            />
          )}

          {/* Transport Controls */}
          <div className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533C] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>{biText(locale, 'Pause Walkthrough', 'አቁም')}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>{biText(locale, 'Play Walkthrough', 'አጫውት')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={activeStepIndex === 0}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStepIndex((i) => Math.max(0, i - 1));
                }}
                aria-label={biText(locale, 'Previous Step', 'ቀዳሚ ደረጃ')}
                className="p-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={activeStepIndex >= selectedScenario.keyframes.length - 1}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStepIndex((i) =>
                    Math.min(selectedScenario.keyframes.length - 1, i + 1)
                  );
                }}
                aria-label={biText(locale, 'Next Step', 'ቀጣይ ደረጃ')}
                className="p-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {biText(locale, 'Speed:', 'ፍጥነት፡')}
              </span>
              {([0.75, 1, 1.5] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2.5 py-1 rounded-md font-mono tabular-nums text-xs font-semibold cursor-pointer ${
                    playbackSpeed === speed
                      ? 'bg-[#0F233A] dark:bg-[#248F64] text-white'
                      : 'bg-slate-100 dark:bg-[#162438] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side-Panel Column: Synchronized Transcript Side-Panel + Bilingual PresentationCues */}
        <div className="lg:col-span-4 space-y-4">
          {showTranscript && (
            <TranscriptPanel
              scenario={selectedScenario}
              activeStepIndex={activeStepIndex}
              locale={locale}
              displayMode={transcriptDisplayMode}
              onDisplayModeChange={setTranscriptDisplayMode}
              onStepSelect={(idx) => {
                setActiveStepIndex(idx);
                setIsPlaying(false);
              }}
              onClose={() => setShowTranscript(false)}
            />
          )}

          <PresentationCues
            activeChapterId={stakeholderFilter}
            scenario={selectedScenario}
            activeKeyframe={activeKeyframe}
            activeStepIndex={activeStepIndex}
            locale={locale}
            targetAccessEnabled={targetAccess.enabled}
            currentRole={currentPersona.role}
            onJumpToModule={() => setActiveSection(selectedScenario.targetSection)}
            onStepChange={(nextIdx) => {
              setIsPlaying(false);
              setActiveStepIndex(nextIdx);
            }}
          />
        </div>
      </div>

      {/* Curated Walkthrough Catalog (Backed by Real Live PRMS Workspace Status) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-[#0F1D2F] dark:text-slate-100">
            {biText(
              locale,
              'Curated System Walkthroughs',
              'የተመረጡ የሥርዓት ማሳያ ምዕራፎች'
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {biText(
              locale,
              `${filteredScenarios.length} walkthroughs · Live State (${activeOwner.name}: ${ownerAuditEvents.length} Audit Logs, ${ownerReceipts.length} Receipts)`,
              `${filteredScenarios.length} የማሳያ ምዕራፎች · ቀጥታ ሁኔታ (${activeOwner.name}፡ ${ownerAuditEvents.length} ኦዲት፣ ${ownerReceipts.length} ደረሰኞች)`
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredScenarios.map((scenario) => {
            const isSelected = scenario.id === selectedScenario.id;
            const liveStatus = liveScenarioStatusMap[scenario.id];
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => selectScenario(scenario.id)}
                className={`text-left rounded-xl border p-4 transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#F3FAF6] dark:bg-[#122623] border-[#166549] dark:border-[#248F64]'
                    : 'bg-white dark:bg-[#111C2C] border-[#DFE5EE] dark:border-[#233349] hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#0F1D2F] dark:text-slate-100 leading-snug">
                      {scenario.chapterOrder}. {biText(locale, scenario.titleEn, scenario.titleAm)}
                    </h4>
                    {liveStatus && <StatusLabel label={liveStatus.statusLabel} />}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {biText(locale, scenario.audienceLabelEn, scenario.audienceLabelAm)} ·{' '}
                    {scenario.keyframes.length} {biText(locale, 'Steps', 'ደረጃዎች')} ·{' '}
                    <span className="tabular-nums">{scenario.totalDurationLabel}</span>
                  </p>

                  {liveStatus && (
                    <div
                      data-testid={`walkthrough-live-status-${scenario.id}`}
                      className="rounded-md border border-[#EAEFF5] dark:border-[#1E2E43] bg-slate-50 dark:bg-[#0D1624] px-2.5 py-1.5 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-200"
                    >
                      {liveStatus.detailLine}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                    {biText(locale, scenario.summaryEn, scenario.summaryAm)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#EAEFF5] dark:border-[#1E2E43] text-xs font-semibold w-full">
                  <span className="text-[#166549] dark:text-[#47C794]">
                    {isSelected
                      ? biText(locale, 'Loaded on Stage', 'በመድረኩ ላይ ተከፍቷል')
                      : biText(locale, 'Load Walkthrough', 'ማሳያውን ክፈት')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#166549] dark:text-[#47C794]" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recorded Video Preview Modal */}
      {previewOpen && recordedVideoUrl && (
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={biText(locale, 'Recorded Presentation Preview', 'የተቀረጸው ቪዲዮ ማሳያ')}
        >
          <div className="space-y-4">
            <VideoPlayer
              src={recordedVideoUrl}
              title={recordedFileName}
              subtitle={biText(
                locale,
                `${selectedScenario.titleEn} · Recorded WebM`,
                `${selectedScenario.titleAm} · የተቀረጸ WebM`
              )}
              durationLabel={formatElapsedTime(recordingElapsedSec)}
              locale={locale}
              lazy={false}
              autoPlay
            />
            <div className="flex items-center justify-end gap-2">
              <a
                href={recordedVideoUrl}
                download={recordedFileName}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#166549] text-white text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                {biText(locale, 'Download .webm File', '.webm ፋይል አውርድ')}
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
