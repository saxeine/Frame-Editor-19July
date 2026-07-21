/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Layout, Film, Plus, Download, FolderPlus, Save, Trash2, Printer, Loader2,
  SlidersHorizontal, Volume2, VolumeX, ChevronLeft, ChevronRight,
  Copy, RotateCcw, SkipBack, SkipForward, Play, Search, PlayCircle, List,
  GripVertical, CheckSquare, Square, Sparkles, Maximize2, Minimize2, Move,
  Eye, EyeOff, Settings, Menu, Repeat, Mic, Music, Pause, Upload,
  Palette, LayoutGrid, RefreshCw, FileText, Video, Wrench, Hash
} from 'lucide-react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import UploadModal, { UploadedFile } from './components/UploadModal';
import FrameEdit from './components/FrameEdit';
import GridEdit from './components/GridEdit';
import ScreenplayWriter from './components/ScreenplayWriter';
import { Slide, AspectRatioKey, TransitionStyle, COLOR_LABELS, SHOT_TYPES, PlaybackTrack } from './types';
import { ASPECT_RATIOS, GRADIENT_PRESETS } from './constants';
import { useAudio } from './useAudio';
import { cn } from './utils/cn';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { resizeImage } from './utils/image';

const storage = getStorage();

interface Theme {
  id: string;
  name: string;
  variables: Record<string, string>;
}

const THEMES: Theme[] = [
  {
    id: 'cinema',
    name: 'Dark Cinema',
    variables: {
      '--theme-bg-app': '#09090b',
      '--theme-bg-header': '#121217',
      '--theme-bg-panel': '#161622',
      '--theme-border': '#252538',
      '--theme-text-primary': '#e2e8f0',
      '--theme-text-heading': '#ffffff',
      '--theme-text-muted': '#94a3b8',
      '--theme-accent': '#6366f1',
      '--theme-accent-hover': '#818cf8',
      '--theme-accent-text': '#ffffff',
      '--theme-badge-bg': '#1e1e2f',
    }
  },
  {
    id: 'silver',
    name: 'Light Silver',
    variables: {
      '--theme-bg-app': '#f1f5f9',
      '--theme-bg-header': '#e2e8f0',
      '--theme-bg-panel': '#ffffff',
      '--theme-border': '#cbd5e1',
      '--theme-text-primary': '#334155',
      '--theme-text-heading': '#0f172a',
      '--theme-text-muted': '#64748b',
      '--theme-accent': '#64748b',
      '--theme-accent-hover': '#475569',
      '--theme-accent-text': '#ffffff',
      '--theme-badge-bg': '#e2e8f0',
    }
  },
  {
    id: 'pastel_green',
    name: 'Pastel Green',
    variables: {
      '--theme-bg-app': '#f0fdf4',
      '--theme-bg-header': '#dcfce7',
      '--theme-bg-panel': '#ffffff',
      '--theme-border': '#bbf7d0',
      '--theme-text-primary': '#166534',
      '--theme-text-heading': '#14532d',
      '--theme-text-muted': '#15803d',
      '--theme-accent': '#16a34a',
      '--theme-accent-hover': '#15803d',
      '--theme-accent-text': '#ffffff',
      '--theme-badge-bg': '#dcfce7',
    }
  },
  {
    id: 'navy',
    name: 'Midnight Navy',
    variables: {
      '--theme-bg-app': '#020617',
      '--theme-bg-header': '#0f172a',
      '--theme-bg-panel': '#1e293b',
      '--theme-border': '#334155',
      '--theme-text-primary': '#cbd5e1',
      '--theme-text-heading': '#f8fafc',
      '--theme-text-muted': '#64748b',
      '--theme-accent': '#38bdf8',
      '--theme-accent-hover': '#7dd3fc',
      '--theme-accent-text': '#020617',
      '--theme-badge-bg': '#1e293b',
    }
  },
  {
    id: 'sage',
    name: 'Forest Sage',
    variables: {
      '--theme-bg-app': '#050c0a',
      '--theme-bg-header': '#0b1612',
      '--theme-bg-panel': '#11221c',
      '--theme-border': '#1d3b30',
      '--theme-text-primary': '#cbd5e1',
      '--theme-text-heading': '#ecfdf5',
      '--theme-text-muted': '#647a6d',
      '--theme-accent': '#10b981',
      '--theme-accent-hover': '#34d399',
      '--theme-accent-text': '#050c0a',
      '--theme-badge-bg': '#11221c',
    }
  },
  {
    id: 'cyber',
    name: 'Neon Cyber',
    variables: {
      '--theme-bg-app': '#090115',
      '--theme-bg-header': '#130429',
      '--theme-bg-panel': '#1d0a3a',
      '--theme-border': '#41147a',
      '--theme-text-primary': '#f3e8ff',
      '--theme-text-heading': '#fdf4ff',
      '--theme-text-muted': '#a855f7',
      '--theme-accent': '#f43f5e',
      '--theme-accent-hover': '#fda4af',
      '--theme-accent-text': '#ffffff',
      '--theme-badge-bg': '#2e105a',
    }
  }
];

export default function App() {
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    return localStorage.getItem('storyboard_theme') || 'cinema';
  });

  const handleSetTheme = (themeId: string) => {
    setCurrentThemeId(themeId);
    localStorage.setItem('storyboard_theme', themeId);
  };

  const [customBgColor, setCustomBgColor] = useState<string>(() => {
    return localStorage.getItem('storyboard_custom_bg') || '';
  });
  const [customTextColor, setCustomTextColor] = useState<string>(() => {
    return localStorage.getItem('storyboard_custom_text') || '#10b981';
  });
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  const handleSetCustomBgColor = (color: string) => {
    setCustomBgColor(color);
    if (color) {
      localStorage.setItem('storyboard_custom_bg', color);
    } else {
      localStorage.removeItem('storyboard_custom_bg');
    }
  };

  const handleSetCustomTextColor = (color: string) => {
    setCustomTextColor(color);
    if (color) {
      localStorage.setItem('storyboard_custom_text', color);
    } else {
      localStorage.removeItem('storyboard_custom_text');
    }
  };

  const [slides, setSlides] = useState<Slide[]>([]);
  const [firebaseQuotaError, setFirebaseQuotaError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  
  // Image Studio States
  const [showImageStudio, setShowImageStudio] = useState(false);
  const [imageStudioTab, setImageStudioTab] = useState<'enhance' | 'textToImage' | 'sequence'>('enhance');

  // Enhancer States
  const [enhanceImgBase64, setEnhanceImgBase64] = useState<string>('');
  const [enhanceImgMimeType, setEnhanceImgMimeType] = useState<string>('');
  const [enhanceStyle, setEnhanceStyle] = useState<string>('cinematic');
  const [enhanceScaleSize, setEnhanceScaleSize] = useState<string>('2K');
  const [enhancedResultUrl, setEnhancedResultUrl] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Text to Image States
  const [t2iPrompt, setT2iPrompt] = useState('');
  const [t2iAspectRatio, setT2iAspectRatio] = useState('16:9');
  const [t2iImageSize, setT2iImageSize] = useState('1K');
  const [t2iResultUrl, setT2iResultUrl] = useState('');
  const [isGeneratingT2i, setIsGeneratingT2i] = useState(false);

  // Image to Sequence States
  const [seqImgBase64, setSeqImgBase64] = useState<string>('');
  const [seqImgMimeType, setSeqImgMimeType] = useState<string>('');
  const [seqMovementType, setSeqMovementType] = useState<string>('dolly_in');
  const [suggestedSequenceFrames, setSuggestedSequenceFrames] = useState<any[]>([]);
  const [isGeneratingSequence, setIsGeneratingSequence] = useState(false);
  const [sequenceFrameVisuals, setSequenceFrameVisuals] = useState<Record<number, string>>({}); // maps shotNo to image URL
  const [isGeneratingFrameVisual, setIsGeneratingFrameVisual] = useState<Record<number, boolean>>({});

  const [editingFrame, setEditingFrame] = useState<{imageUrl: string; index: number; initialTextLayers?: any[]} | null>(null);
  const [editingGridFrame, setEditingGridFrame] = useState<{imageUrl: string; index: number} | null>(null);
  const [showVectorEditOnPanels, setShowVectorEditOnPanels] = useState<boolean>(false);
  const [folderName, setFolderName] = useState('My-Storyboard');
  const [storyboardId] = useState('default-storyboard');

  // Density & Screenplay States
  const [viewDensity, setViewDensity] = useState<'full' | 'compact' | 'strip' | 'icon' | 'grid-storyboard'>('strip');
  const [videoDownloadUrlExtension, setVideoDownloadUrlExtension] = useState<string>('mp4');
  const [showScriptEditor, setShowScriptEditor] = useState<boolean>(() => {
    return localStorage.getItem('storyboard_show_script') === 'true';
  });
  const [scriptWriterFullScreen, setScriptWriterFullScreen] = useState(false);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const handleSelectSlide = (id: string | null) => {
    setActiveSlideId(id);
    if (id) {
      const idx = slides.findIndex(s => s.id === id);
      if (idx !== -1) {
        setCurrentSlideIndex(idx);
      }
    }
  };

  // Sync active slide and current indices unidirectionally to avoid circular resets
  useEffect(() => {
    if (slides.length > 0) {
      let indexToUse = currentSlideIndex;
      if (indexToUse < 0 || indexToUse >= slides.length) {
        indexToUse = 0;
        setCurrentSlideIndex(0);
      }
      const targetId = slides[indexToUse]?.id || null;
      if (targetId && targetId !== activeSlideId) {
        setActiveSlideId(targetId);
      }
    } else {
      if (activeSlideId !== null) {
        setActiveSlideId(null);
      }
    }
  }, [currentSlideIndex, slides, activeSlideId]);

  useEffect(() => {
    localStorage.setItem('storyboard_density', viewDensity);
  }, [viewDensity]);

  useEffect(() => {
    localStorage.setItem('storyboard_show_script', String(showScriptEditor));
  }, [showScriptEditor]);

  const [headerDisplayMode, setHeaderDisplayMode] = useState<'icons' | 'text' | 'both'>(() => {
    return (localStorage.getItem('storyboard_header_display_mode') as 'icons' | 'text' | 'both') || 'icons';
  });

  useEffect(() => {
    localStorage.setItem('storyboard_header_display_mode', headerDisplayMode);
  }, [headerDisplayMode]);

  // Sequencer Playback & View States
  const [isPlaying, setIsPlaying] = useState(false);
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>('none');
  const [activeLayout, setActiveLayout] = useState<'grid' | 'spreadsheet' | 'player'>('grid');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioKey>('16:9');
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [enableBeeps, setEnableBeeps] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const [showAddBlankDropdown, setShowAddBlankDropdown] = useState(false);
  const [fullscreenPlayer, setFullscreenPlayer] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'filmstrip' | 'tracks'>('filmstrip');
  const [activePlaybackTrackId, setActivePlaybackTrackId] = useState<string | null>(null);
  const [enableTransitionSpeed, setEnableTransitionSpeed] = useState<boolean>(false);
  const [playbackTimingMode, setPlaybackTimingMode] = useState<'duration' | 'fps'>('fps');
  const [playbackFps, setPlaybackFps] = useState<number>(30);

  // Selection & Drag/Drop states for List Sequencer
  const [selectedSlideIds, setSelectedSlideIds] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Triple Zoom Variations
  const [zoomVariationsSource, setZoomVariationsSource] = useState<Slide | null>(null);
  const [zoomRatios, setZoomRatios] = useState<[number, number, number]>([1.2, 1.8, 2.5]);
  const [zoomPanOffsets, setZoomPanOffsets] = useState<Array<{ x: number; y: number }>>([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  // Print / PDF Export states
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printTitle, setPrintTitle] = useState('');
  const [printAuthor, setPrintAuthor] = useState('');
  const [printLayout, setPrintLayout] = useState<'grid' | 'list'>('grid');
  const [printCols, setPrintCols] = useState<number>(2);
  const [printNotes, setPrintNotes] = useState(true);
  const [printDialogue, setPrintDialogue] = useState(true);
  const [printMeta, setPrintMeta] = useState(true);
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // SxaBoardTool additions: voiceover synthesis and ZIP export config
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false);
  const [showZipDialog, setShowZipDialog] = useState(false);
  const [zipFileName, setZipFileName] = useState('storyboard');
  const [isExportingZip, setIsExportingZip] = useState(false);

  // Video Export states
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoFileName, setVideoFileName] = useState('storyboard_playback');
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoExportProgress, setVideoExportProgress] = useState(0);
  const [videoExportStatus, setVideoExportStatus] = useState('');
  const [videoDownloadUrl, setVideoDownloadUrl] = useState<string | null>(null);
  const [videoSubtitlesEnabled, setVideoSubtitlesEnabled] = useState(true);
  const videoCancelRef = useRef(false);
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // State for CSS transitions in Playback Mode
  const [prevSlideImageUrl, setPrevSlideImageUrl] = useState<string | null>(null);
  const [prevSlideFitMode, setPrevSlideFitMode] = useState<'contain' | 'cover'>('contain');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Dynamic timing and recorded playbacks
  const [transitionDuration, setTransitionDuration] = useState<number>(0.5);
  const [playbackTracks, setPlaybackTracks] = useState<PlaybackTrack[]>([]);
  const [isRecordingPlayback, setIsRecordingPlayback] = useState(false);
  const [recordedTimings, setRecordedTimings] = useState<Record<string, number>>({});

  // Custom Confirmation Modal for Clear Session
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // Batch rename states
  const [showBatchRenameUI, setShowBatchRenameUI] = useState(false);
  const [batchRenameTarget, setBatchRenameTarget] = useState<'sceneNo' | 'shotNo'>('sceneNo');
  const [batchRenameBase, setBatchRenameBase] = useState<number>(1);

  const { triggerAudioBeep } = useAudio();
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processedImagesRef = useRef<Set<string>>(new Set());

  // Audio recording states
  const [recordingIdx, setRecordingIdx] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async (idx: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (re) => {
          const dataUrl = re.target?.result as string;
          handleUpdateSlideField(idx, 'audioUrl', dataUrl);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecordingIdx(idx);
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingIdx(null);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  // Audio Playback Controller
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    if (isPlaying && slides.length > 0) {
      const currentSlide = slides[currentSlideIndex];
      if (currentSlide && currentSlide.audioUrl) {
        const audio = new Audio(currentSlide.audioUrl);
        activeAudioRef.current = audio;
        audio.play().catch(err => {
          console.warn("Audio autoplay blocked or failed:", err);
        });
      }
    }

    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, [currentSlideIndex, isPlaying, slides]);

  // Pause playback when switching layout modes away from 'player' (Playback / Preview)
  useEffect(() => {
    if (activeLayout !== 'player' && isPlaying) {
      setIsPlaying(false);
    }
  }, [activeLayout, isPlaying]);

  useEffect(() => {
    const hasQuotaErr = localStorage.getItem('storyboard_quota_exceeded') === 'true';
    if (hasQuotaErr) {
      setFirebaseQuotaError("Daily read quota limit exceeded.");
      const localData = localStorage.getItem(`storyboard_${storyboardId}`);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setSlides(parsed.slides || []);
          setFolderName(parsed.folderName || 'My-Storyboard');
          setPlaybackTracks(parsed.playbackTracks || []);
        } catch (e) {
          console.error("Failed to parse local storyboard backup:", e);
        }
      }
      return;
    }

    const unsub = onSnapshot(doc(db, 'storyboards', storyboardId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSlides(data.slides || []);
        setFolderName(data.folderName || 'My-Storyboard');
        setPlaybackTracks(data.playbackTracks || []);
      } else {
        // Fallback to localStorage backup on load if Firestore is empty
        const localData = localStorage.getItem(`storyboard_${storyboardId}`);
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            setSlides(parsed.slides || []);
            setFolderName(parsed.folderName || 'My-Storyboard');
            setPlaybackTracks(parsed.playbackTracks || []);
          } catch (e) {
            console.error("Failed to parse local storyboard backup:", e);
          }
        }
      }
    }, (error) => {
      console.error("Firestore listener failed, falling back to local storage backup:", error);
      const localData = localStorage.getItem(`storyboard_${storyboardId}`);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setSlides(parsed.slides || []);
          setFolderName(parsed.folderName || 'My-Storyboard');
          setPlaybackTracks(parsed.playbackTracks || []);
        } catch (e) {
          console.error("Failed to parse local storyboard backup:", e);
        }
      }
      
      const errStr = error instanceof Error ? error.message : String(error);
      if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('exhausted') || errStr.toLowerCase().includes('resource')) {
        setFirebaseQuotaError("Daily read quota limit exceeded.");
        localStorage.setItem('storyboard_quota_exceeded', 'true');
      }
      
      try {
        handleFirestoreError(error, OperationType.GET, `storyboards/${storyboardId}`);
      } catch (e) {
        console.warn("Handled firestore error logged.");
      }
    });
    return () => unsub();
  }, [storyboardId]);

  // Handle dragging/panning in Zoom Variations
  useEffect(() => {
    if (draggingIdx === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current || !panStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // Map pixel delta to normalized layout translation offset.
      // We assume average container width is 300px, height is 169px (16:9 aspect).
      const scaleX = dx / 300;
      const scaleY = dy / 169;

      const baseZoom = zoomRatios[draggingIdx];
      const maxPan = Math.max(0, (baseZoom - 1) / 2);

      setZoomPanOffsets((prev) => {
        const next = [...prev];
        next[draggingIdx] = {
          x: Math.max(-maxPan, Math.min(maxPan, panStartRef.current!.x + scaleX)),
          y: Math.max(-maxPan, Math.min(maxPan, panStartRef.current!.y + scaleY)),
        };
        return next;
      });
    };

    const handlePointerUp = () => {
      setDraggingIdx(null);
      dragStartRef.current = null;
      panStartRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingIdx, zoomRatios]);

  const handlePanStart = (e: React.MouseEvent | React.TouchEvent, idx: number) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
    panStartRef.current = { ...zoomPanOffsets[idx] };
    setDraggingIdx(idx);
  };

  // Handle Playback Interval
  useEffect(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
    }

    if (!isPlaying || slides.length === 0) return;

    const currentSlide = slides[currentSlideIndex];
    const duration = playbackTimingMode === 'fps' ? (1000 / playbackFps) : (currentSlide?.duration || 3000);

    // Trigger SpeechSynthesis voiceover if enabled
    if (voiceoverEnabled && currentSlide && (currentSlide.action || currentSlide.dialogue)) {
      try {
        window.speechSynthesis.cancel();
        const textToSpeak = currentSlide.dialogue || currentSlide.action;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
      }
    }

    playTimerRef.current = setTimeout(() => {
      if (currentSlideIndex < slides.length - 1) {
        if (enableBeeps) {
          triggerAudioBeep(600, 'sine', 0.08);
        }
        setCurrentSlideIndex((prev) => prev + 1);
      } else {
        if (isLooping) {
          if (enableBeeps) {
            triggerAudioBeep(800, 'sine', 0.12);
          }
          setCurrentSlideIndex(0);
        } else {
          setIsPlaying(false);
          if (voiceoverEnabled) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
          }
        }
      }
    }, duration);

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentSlideIndex, slides, isLooping, enableBeeps, triggerAudioBeep, voiceoverEnabled, playbackTimingMode, playbackFps]);

  // Cancel SpeechSynthesis when playback is paused or stopped
  useEffect(() => {
    if (!isPlaying && voiceoverEnabled) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }, [isPlaying, voiceoverEnabled]);

  // Synchronize CSS Transitions on Slide Changes
  useEffect(() => {
    if (slides.length > 0 && slides[currentSlideIndex]) {
      const currentUrl = slides[currentSlideIndex].imageUrl;
      const currentFit = slides[currentSlideIndex].fitMode || 'contain';

      // Only transition if the previous image was actually different and exists
      if (prevSlideImageUrl && prevSlideImageUrl !== currentUrl) {
        setIsTransitioning(true);
        const timer = setTimeout(() => {
          setIsTransitioning(false);
          setPrevSlideImageUrl(currentUrl);
          setPrevSlideFitMode(currentFit);
        }, transitionDuration * 1000); // matches dynamic transition duration in seconds
        return () => clearTimeout(timer);
      } else {
        setPrevSlideImageUrl(currentUrl);
        setPrevSlideFitMode(currentFit);
      }
    } else {
      setPrevSlideImageUrl(null);
    }
  }, [currentSlideIndex, slides, transitionDuration]);

  const saveToFirebase = async (newSlides: Slide[], name: string, updatedTracks?: PlaybackTrack[]) => {
    let slidesToSave = newSlides;
    const tracksToSave = updatedTracks !== undefined ? updatedTracks : playbackTracks;

    try {
      slidesToSave = await Promise.all(newSlides.map(async (s) => {
        if (s.imageUrl.startsWith('data:image')) {
          if (processedImagesRef.current.has(s.imageUrl)) {
            return s;
          }
          try {
            const storageRef = ref(storage, `storyboards/${storyboardId}/${s.id}.jpg`);
            await uploadString(storageRef, s.imageUrl, 'data_url');
            const downloadUrl = await getDownloadURL(storageRef);
            processedImagesRef.current.add(downloadUrl);
            processedImagesRef.current.add(s.imageUrl);
            return { ...s, imageUrl: downloadUrl };
          } catch (storageErr) {
            console.warn("Firebase Storage upload failed, falling back to inline compressed base64:", storageErr);
            const compressed = await resizeImage(s.imageUrl, 1280, 720, 0.8);
            processedImagesRef.current.add(compressed);
            processedImagesRef.current.add(s.imageUrl);
            return { ...s, imageUrl: compressed };
          }
        }
        return s;
      }));
    } catch (err) {
      console.error("Error preparing slides for saving:", err);
    }

    // Always create a local backup so changes are persistent
    try {
      localStorage.setItem(`storyboard_${storyboardId}`, JSON.stringify({
        slides: slidesToSave,
        folderName: name,
        id: storyboardId,
        playbackTracks: tracksToSave
      }));
    } catch (localErr) {
      console.error("Failed to write to localStorage:", localErr);
    }

    try {
      await setDoc(doc(db, 'storyboards', storyboardId), {
        slides: slidesToSave,
        folderName: name,
        id: storyboardId,
        playbackTracks: tracksToSave
      });
    } catch (dbErr) {
      console.error("Firestore save failed, using local backup:", dbErr);
      const errStr = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('exhausted') || errStr.toLowerCase().includes('resource')) {
        setFirebaseQuotaError("Daily write quota limit exceeded.");
      } else {
        setFirebaseQuotaError(errStr);
      }
      try {
        handleFirestoreError(dbErr, OperationType.WRITE, `storyboards/${storyboardId}`);
      } catch (e) {
        console.warn("Handled firestore save error logged.");
      }
    }
  };

  // Live timing recording mechanism
  const lastActiveSlideIdRef = useRef<string | null>(null);
  const recordStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isRecordingPlayback) {
      const now = Date.now();
      const prevSlideId = lastActiveSlideIdRef.current;
      
      if (prevSlideId) {
        const elapsed = now - recordStartTimeRef.current;
        if (elapsed > 200) {
          setRecordedTimings(prev => ({
            ...prev,
            [prevSlideId]: elapsed
          }));
        }
      }
      recordStartTimeRef.current = now;
    }
    
    if (slides[currentSlideIndex]) {
      lastActiveSlideIdRef.current = slides[currentSlideIndex].id;
    } else {
      lastActiveSlideIdRef.current = null;
    }
  }, [currentSlideIndex, isRecordingPlayback, slides]);

  // Handle auto-completion of recording when playback reaches end and stops
  useEffect(() => {
    if (isRecordingPlayback && !isPlaying && Object.keys(recordedTimings).length > 0) {
      // If playback naturally stopped, prompt to save the recording
      handleStopRecordingPlayback();
    }
  }, [isPlaying]);

  const [showSaveTrackDialog, setShowSaveTrackDialog] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');

  const handleStartRecordingPlayback = () => {
    setIsRecordingPlayback(true);
    setRecordedTimings({});
    recordStartTimeRef.current = Date.now();
    if (slides[currentSlideIndex]) {
      lastActiveSlideIdRef.current = slides[currentSlideIndex].id;
    }
    if (!isPlaying) {
      setIsPlaying(true);
    }
    if (enableBeeps) triggerAudioBeep(600, 'sine', 0.1);
  };

  const handleStopRecordingPlayback = () => {
    if (!isRecordingPlayback) return;
    
    const now = Date.now();
    const prevSlideId = lastActiveSlideIdRef.current;
    const finalTimings = { ...recordedTimings };
    
    if (prevSlideId) {
      const elapsed = now - recordStartTimeRef.current;
      if (elapsed > 200) {
        finalTimings[prevSlideId] = elapsed;
      }
    }

    setRecordedTimings(finalTimings);
    setIsPlaying(false);
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const totalRecordedSecs = (Object.values(finalTimings) as number[]).reduce((sum, val) => sum + val, 0) / 1000;
    setNewTrackName(`Live Cut (${totalRecordedSecs.toFixed(1)}s) - ${timestamp}`);
    setShowSaveTrackDialog(true);
    if (enableBeeps) triggerAudioBeep(450, 'sine', 0.1);
  };

  const handleSaveCurrentTimingsAsTrack = () => {
    const currentTimings: Record<string, number> = {};
    slides.forEach(s => {
      currentTimings[s.id] = s.duration || 3000;
    });

    const totalSecs = slides.reduce((sum, s) => sum + (s.duration || 3000), 0) / 1000;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRecordedTimings(currentTimings);
    setNewTrackName(`Manual Cut (${totalSecs.toFixed(1)}s) - ${timestamp}`);
    setShowSaveTrackDialog(true);
    if (enableBeeps) triggerAudioBeep(600, 'sine', 0.1);
  };

  const handleConfirmSaveTrack = () => {
    if (!newTrackName.trim()) return;

    const newTrack: PlaybackTrack = {
      id: Math.random().toString(36).substring(2, 9),
      name: newTrackName.trim(),
      timings: recordedTimings,
      createdAt: new Date().toISOString()
    };

    const updatedTracks = [...playbackTracks, newTrack];
    setPlaybackTracks(updatedTracks);
    setActivePlaybackTrackId(newTrack.id);
    setIsRecordingPlayback(false);
    setShowSaveTrackDialog(false);

    const updatedSlides = slides.map(s => {
      if (recordedTimings[s.id] !== undefined) {
        return { ...s, duration: recordedTimings[s.id] };
      }
      return s;
    });
    setSlides(updatedSlides);
    saveToFirebase(updatedSlides, folderName, updatedTracks);
    
    if (enableBeeps) triggerAudioBeep(650, 'sine', 0.15);
  };

  const handleCancelSaveTrack = () => {
    setIsRecordingPlayback(false);
    setShowSaveTrackDialog(false);
    if (enableBeeps) triggerAudioBeep(400, 'sine', 0.05);
  };

  const handleLoadPlaybackTrack = (track: PlaybackTrack) => {
    const updatedSlides = slides.map(s => {
      const savedDuration = track.timings[s.id];
      if (savedDuration !== undefined) {
        return { ...s, duration: savedDuration };
      }
      return s;
    });
    setSlides(updatedSlides);
    setActivePlaybackTrackId(track.id);
    saveToFirebase(updatedSlides, folderName, playbackTracks);
    if (enableBeeps) triggerAudioBeep(580, 'sine', 0.1);
  };

  const handleDeletePlaybackTrack = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTracks = playbackTracks.filter(t => t.id !== trackId);
    setPlaybackTracks(updatedTracks);
    if (activePlaybackTrackId === trackId) {
      setActivePlaybackTrackId(null);
    }
    saveToFirebase(slides, folderName, updatedTracks);
    if (enableBeeps) triggerAudioBeep(400, 'sine', 0.1);
  };

  const handleImport = (files: UploadedFile[], folder?: string) => {
    const newFolderName = folder || folderName;
    if (newFolderName !== folderName) {
      setFolderName(newFolderName);
      setZipFileName(newFolderName);
    }
    
    const lastSlide = slides[slides.length - 1];
    let cScene = lastSlide ? lastSlide.sceneNo : 1;
    let cShot = lastSlide ? lastSlide.shotNo : 0;

    const newSlides: Slide[] = [...slides, ...files.map((f) => {
      cShot++;
      const cleanName = f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      return {
        id: Math.random().toString(36).substring(2, 9),
        sceneNo: cScene,
        shotNo: cShot,
        action: cleanName || 'Imported frame',
        dialogue: '',
        duration: 3000,
        imageUrl: f.dataUrl,
        notes: f.relativePath || '',
        shotType: 'MS',
        colorLabel: 'none'
      };
    })];
    setSlides(newSlides);
    saveToFirebase(newSlides, newFolderName);
    if (enableBeeps) triggerAudioBeep(520, 'sine', 0.15);
  };

  const handleEditFrame = (imageUrl: string, index: number) => {
    setEditingFrame({ imageUrl, index });
  };

  const handleSaveEditedFrame = (dataUrl: string) => {
    if (!editingFrame) return;
    const newSlides = slides.map((s, i) => i === editingFrame.index ? { ...s, imageUrl: dataUrl } : s);
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    setEditingFrame(null);
  };

  const handleSaveAsNewFrame = (dataUrl: string) => {
    if (!editingFrame) return;
    const baseSlide = slides[editingFrame.index];
    if (!baseSlide) return;
    const newSlide: Slide = {
      ...baseSlide,
      id: Math.random().toString(36).substring(2, 9),
      sceneNo: baseSlide.sceneNo,
      shotNo: baseSlide.shotNo + 1,
      imageUrl: dataUrl
    };
    const newSlides = [...slides];
    newSlides.splice(editingFrame.index + 1, 0, newSlide);
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    
    // Increment the active editing index so the editor stays open on the newly cloned frame,
    // allowing repeated adjustments and save copies sequentially.
    setEditingFrame({
      ...editingFrame,
      index: editingFrame.index + 1
    });

    if (enableBeeps) triggerAudioBeep(600, 'sine', 0.1);
  };

  const handleEditGridFrame = (imageUrl: string, index: number) => {
    setEditingGridFrame({ imageUrl, index });
  };

  const handleSaveEditedGridFrame = (dataUrl: string) => {
    if (!editingGridFrame) return;
    const newSlides = slides.map((s, i) => i === editingGridFrame.index ? { ...s, imageUrl: dataUrl } : s);
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    setEditingGridFrame(null);
  };

  const handleSaveAsNewGridFrame = (dataUrl: string) => {
    if (!editingGridFrame) return;
    const baseSlide = slides[editingGridFrame.index];
    if (!baseSlide) return;
    const baseShotInt = Math.floor(baseSlide.shotNo || 1);
    const newSlide: Slide = {
      ...baseSlide,
      id: Math.random().toString(36).substring(2, 9),
      sceneNo: baseSlide.sceneNo,
      shotNo: parseFloat((baseShotInt + 0.1).toFixed(2)),
      imageUrl: dataUrl
    };
    const newSlides = [...slides];
    newSlides.splice(editingGridFrame.index + 1, 0, newSlide);
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    
    // Same behavior for grid edit save-as-new copy
    setEditingGridFrame({
      ...editingGridFrame,
      index: editingGridFrame.index + 1
    });

    if (enableBeeps) triggerAudioBeep(600, 'sine', 0.1);
  };

  const handleSaveSlicesToSlides = (resolvedSlices: { dataUrl: string; name: string }[]) => {
    if (!editingGridFrame || resolvedSlices.length === 0) return;
    const baseSlide = slides[editingGridFrame.index];
    if (!baseSlide) return;
    const baseShotInt = Math.floor(baseSlide.shotNo || 1);

    // Map resolved slices to new Slide objects with beautiful, distinct shot numbers
    const newSlidesToInsert: Slide[] = resolvedSlices.map((slice, idx) => {
      const sliceNum = idx + 1;
      const sequentialShotNo = parseFloat((baseShotInt + sliceNum / 100).toFixed(2));

      return {
        ...baseSlide,
        id: Math.random().toString(36).substring(2, 9),
        sceneNo: baseSlide.sceneNo,
        shotNo: sequentialShotNo,
        action: baseSlide.action ? `${baseSlide.action} (Slice ${sliceNum})` : `Slice ${sliceNum}`,
        notes: baseSlide.notes ? `${baseSlide.notes} [Grid Slice #${sliceNum}]` : `Grid Slice #${sliceNum} of original Shot ${baseSlide.shotNo}`,
        imageUrl: slice.dataUrl
      };
    });

    const newSlides = [...slides];
    // Replace the single editing slide with the entire sequence of slices
    newSlides.splice(editingGridFrame.index, 1, ...newSlidesToInsert);
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    setEditingGridFrame(null);
  };

  // Generate 3 customizable zoom variations of a frame
  const handleGenerateVariations = (sourceSlide: Slide, zooms: [number, number, number]) => {
    const globalIndex = slides.findIndex(s => s.id === sourceSlide.id);
    if (globalIndex === -1) return;

    const promises = zooms.map((zoom, idx) => {
      const pan = zoomPanOffsets[idx] || { x: 0, y: 0 };
      return new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 1280;
          canvas.height = img.naturalHeight || 720;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(sourceSlide.imageUrl);
            return;
          }

          // Mathematically perfect pan and zoom center calculation:
          const cx = (0.5 - pan.x / zoom) * canvas.width;
          const cy = (0.5 - pan.y / zoom) * canvas.height;

          const w = canvas.width / zoom;
          const h = canvas.height / zoom;
          
          // Clamp cx and cy to prevent any out-of-bounds crop
          const minCx = w / 2;
          const maxCx = canvas.width - w / 2;
          const minCy = h / 2;
          const maxCy = canvas.height - h / 2;

          const clampedCx = Math.max(minCx, Math.min(maxCx, cx));
          const clampedCy = Math.max(minCy, Math.min(maxCy, cy));

          const x = clampedCx - w / 2;
          const y = clampedCy - h / 2;

          ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            resolve(sourceSlide.imageUrl);
          }
        };
        img.onerror = () => {
          resolve(sourceSlide.imageUrl);
        };
        img.src = sourceSlide.imageUrl;
      });
    });

    Promise.all(promises).then((zoomedDataUrls) => {
      const newVariations: Slide[] = zoomedDataUrls.map((dataUrl, idx) => {
        let shotType = 'MS';
        if (zooms[idx] >= 2.4) shotType = 'ECU';
        else if (zooms[idx] >= 1.7) shotType = 'CU';
        else if (zooms[idx] >= 1.25) shotType = 'MCU';

        return {
          id: Math.random().toString(36).substring(2, 9),
          sceneNo: sourceSlide.sceneNo,
          shotNo: sourceSlide.shotNo + idx + 1,
          action: `${sourceSlide.action || 'Visual direction'} (${zooms[idx]}x Zoom Variation)`,
          dialogue: sourceSlide.dialogue,
          duration: sourceSlide.duration || 3000,
          imageUrl: dataUrl,
          notes: `Auto Zoom Variation of shot ${sourceSlide.shotNo} at ${zooms[idx]}x`,
          shotType,
          colorLabel: sourceSlide.colorLabel || 'none'
        };
      });

      const nextSlides = [...slides];
      nextSlides.splice(globalIndex + 1, 0, ...newVariations);
      setSlides(nextSlides);
      saveToFirebase(nextSlides, folderName);
      setZoomVariationsSource(null);
      if (enableBeeps) triggerAudioBeep(700, 'sine', 0.12);
    });
  };

  // Create a blank solid / gradient frame
  const handleAddBlankFrame = (color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (color.startsWith('linear-gradient')) {
        const grad = ctx.createLinearGradient(0, 0, 1280, 720);
        const hexes = color.match(/#[0-9a-fA-F]{6}/g);
        if (hexes && hexes.length >= 2) {
          grad.addColorStop(0, hexes[0]);
          grad.addColorStop(1, hexes[1]);
        } else {
          grad.addColorStop(0, '#1e293b');
          grad.addColorStop(1, '#0f172a');
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = color;
      }
      ctx.fillRect(0, 0, 1280, 720);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const newSlide: Slide = {
        id: Math.random().toString(36).substring(2, 9),
        sceneNo: slides.length + 1,
        shotNo: 1,
        action: 'New blank scene',
        dialogue: '',
        duration: 3000,
        imageUrl: dataUrl,
        notes: '',
        shotType: 'MS',
        colorLabel: 'none'
      };
      
      const newSlides = [...slides, newSlide];
      setSlides(newSlides);
      saveToFirebase(newSlides, folderName);
    }
    setShowAddBlankDropdown(false);
  };

  // Re-number frames sequentially
  const handleAutoNumber = () => {
    const renumbered = slides.map((slide, i) => ({
      ...slide,
      sceneNo: i + 1,
      shotNo: 1
    }));
    setSlides(renumbered);
    saveToFirebase(renumbered, folderName);
    if (enableBeeps) triggerAudioBeep(500, 'sine', 0.1);
  };

  // Duplicate slide
  const handleDuplicateSlide = (index: number) => {
    const slideToCopy = slides[index];
    if (!slideToCopy) return;
    const duplicated: Slide = {
      ...slideToCopy,
      id: Math.random().toString(36).substring(2, 9),
      sceneNo: slideToCopy.sceneNo,
      shotNo: (slideToCopy.shotNo || 1) + 1,
    };
    const newSlides = [...slides];
    newSlides.splice(index + 1, 0, duplicated);
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
  };

  // Move slide position
  const handleMoveSlide = (index: number, direction: 'left' | 'right' | 'up' | 'down') => {
    const targetIndex = (direction === 'left' || direction === 'up') ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const newSlides = [...slides];
    const [moved] = newSlides.splice(index, 1);
    newSlides.splice(targetIndex, 0, moved);
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
  };

  // Clear entire session and start anew
  const handleClearSession = () => {
    setShowClearConfirmModal(true);
  };

  // Batch rename / renumber scenes or shots sequentially starting from a base number
  const handleBatchSequentialRename = (target: 'sceneNo' | 'shotNo', baseNum: number) => {
    if (selectedSlideIds.length === 0) return;
    let sequenceCounter = baseNum;
    const newSlides = slides.map(s => {
      if (selectedSlideIds.includes(s.id)) {
        const updated = { ...s, [target]: sequenceCounter };
        sequenceCounter += 1;
        return updated;
      }
      return s;
    });
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    if (enableBeeps) triggerAudioBeep(600, 'sine', 0.05);
  };

  // Update specific field of a slide
  const handleUpdateSlideField = (index: number, field: keyof Slide, value: any) => {
    const newSlides = slides.map((s, i) => i === index ? { ...s, [field]: value } : s);
    setSlides(newSlides);
    // Debounce or save on blur can be handled, but simple state save is responsive
    saveToFirebase(newSlides, folderName);
  };

  // Toggle single slide selection (supporting Shift-Click for range select)
  const handleToggleSelectSlide = (id: string, event?: React.MouseEvent) => {
    if (event?.shiftKey && selectedSlideIds.length > 0) {
      const lastSelectedId = selectedSlideIds[selectedSlideIds.length - 1];
      const lastIndex = slides.findIndex(s => s.id === lastSelectedId);
      const currentIndex = slides.findIndex(s => s.id === id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = slides.slice(start, end + 1).map(s => s.id);
        
        setSelectedSlideIds(prev => {
          const base = prev.filter(x => !rangeIds.includes(x));
          return [...base, ...rangeIds];
        });
        return;
      }
    }
    
    setSelectedSlideIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toggle selection of all currently visible filtered slides
  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredSlides.map(s => s.id);
    const allSelectedAlready = currentFilteredIds.every(id => selectedSlideIds.includes(id));

    if (allSelectedAlready) {
      setSelectedSlideIds(prev => prev.filter(id => !currentFilteredIds.includes(id)));
    } else {
      setSelectedSlideIds(prev => {
        const unique = new Set([...prev, ...currentFilteredIds]);
        return Array.from(unique);
      });
    }
  };

  // Delete all selected slides
  const handleDeleteSelected = () => {
    if (selectedSlideIds.length === 0) return;
    const newSlides = slides.filter(s => !selectedSlideIds.includes(s.id));
    setSlides(newSlides);
    setSelectedSlideIds([]);
    saveToFirebase(newSlides, folderName);
    if (enableBeeps) triggerAudioBeep(450, 'sine', 0.1);
  };

  // Duplicate all selected slides, inserting them next to originals
  const handleDuplicateSelected = () => {
    if (selectedSlideIds.length === 0) return;
    const newSlides: Slide[] = [];
    slides.forEach(s => {
      newSlides.push(s);
      if (selectedSlideIds.includes(s.id)) {
        newSlides.push({
          ...s,
          id: Math.random().toString(36).substring(2, 9),
          shotNo: s.shotNo + 1
        });
      }
    });
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    if (enableBeeps) triggerAudioBeep(520, 'sine', 0.15);
  };

  // Image Studio API Helpers
  const handleReadFileAsBase64 = (file: File, callback: (base64: string, mimeType: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const parts = reader.result.split(',');
        const b64 = parts[1] || '';
        const mime = file.type || 'image/png';
        callback(b64, mime);
      }
    };
    reader.readAsDataURL(file);
  };

  const extractBase64FromDataUrl = (dataUrl: string) => {
    if (!dataUrl.startsWith('data:')) return null;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        mimeType: match[1],
        base64: match[2]
      };
    }
    return null;
  };

  const handleEnhanceImage = async () => {
    if (!enhanceImgBase64) return;
    setIsEnhancing(true);
    setEnhancedResultUrl('');
    try {
      const response = await fetch('/api/gemini/enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: enhanceImgBase64,
          mimeType: enhanceImgMimeType,
          style: enhanceStyle,
          scaleSize: enhanceScaleSize
        })
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setEnhancedResultUrl(data.imageUrl);
        if (enableBeeps) triggerAudioBeep(650, 'sine', 0.1);
      } else {
        alert(data.error || "Enhance failed. Please check backend log.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error enhancing image: " + err.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateT2i = async () => {
    if (!t2iPrompt.trim()) return;
    setIsGeneratingT2i(true);
    setT2iResultUrl('');
    try {
      const response = await fetch('/api/gemini/text-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: t2iPrompt,
          aspectRatio: t2iAspectRatio,
          imageSize: t2iImageSize
        })
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setT2iResultUrl(data.imageUrl);
        if (enableBeeps) triggerAudioBeep(650, 'sine', 0.1);
      } else {
        alert(data.error || "Generation failed. Please check backend log.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error generating image: " + err.message);
    } finally {
      setIsGeneratingT2i(false);
    }
  };

  const handleGenerateSequence = async () => {
    if (!seqImgBase64) return;
    setIsGeneratingSequence(true);
    setSuggestedSequenceFrames([]);
    setSequenceFrameVisuals({});
    try {
      const response = await fetch('/api/gemini/image-to-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: seqImgBase64,
          mimeType: seqImgMimeType,
          movementType: seqMovementType
        })
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.sequence)) {
        setSuggestedSequenceFrames(data.sequence);
        // Set the anchor frame as the first visual immediately!
        setSequenceFrameVisuals({
          1: `data:${seqImgMimeType};base64,${seqImgBase64}`
        });
        if (enableBeeps) triggerAudioBeep(700, 'sine', 0.15);
      } else {
        alert(data.error || "Failed to generate story sequence suggestions.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error generating sequence suggestions: " + err.message);
    } finally {
      setIsGeneratingSequence(false);
    }
  };

  const handleGenerateFrameVisual = async (shotNo: number, actionPrompt: string) => {
    setIsGeneratingFrameVisual(prev => ({ ...prev, [shotNo]: true }));
    try {
      // Create a visual based on the action prompt and matching the widescreen aspect ratio
      const response = await fetch('/api/gemini/text-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: actionPrompt,
          aspectRatio: '16:9',
          imageSize: '1K'
        })
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setSequenceFrameVisuals(prev => ({ ...prev, [shotNo]: data.imageUrl }));
        if (enableBeeps) triggerAudioBeep(650, 'sine', 0.05);
      } else {
        alert(data.error || "Failed to generate visual for frame.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error generating visual: " + err.message);
    } finally {
      setIsGeneratingFrameVisual(prev => ({ ...prev, [shotNo]: false }));
    }
  };

  const handleAddSequenceToStoryboard = () => {
    if (suggestedSequenceFrames.length === 0) return;
    
    // Check if we have visual for at least the anchor frame
    const startScene = slides.length > 0 ? slides[slides.length - 1].sceneNo : 1;
    let nextShot = slides.length + 1;

    const newSlides: Slide[] = suggestedSequenceFrames.map((frame, index) => {
      return {
        id: 'slide_' + Date.now() + '_' + index,
        sceneNo: startScene,
        shotNo: nextShot++,
        action: frame.action || 'Cinematic continuation',
        dialogue: frame.dialogue || '',
        duration: (frame.duration || 2000) / 1000,
        imageUrl: sequenceFrameVisuals[frame.shotNo] || `data:${seqImgMimeType};base64,${seqImgBase64}`,
        notes: frame.notes || frame.movementSuggestion || 'AI Sequence Extension',
        colorLabel: 'none'
      };
    });

    const updated = [...slides, ...newSlides];
    setSlides(updated);
    saveToFirebase(updated, folderName);
    setShowImageStudio(false);
    alert(`Successfully appended ${newSlides.length} sequential frames to your storyboard!`);
  };

  // Batch update any field on all selected slides at once
  const handleBatchUpdateField = (field: keyof Slide, value: any) => {
    if (selectedSlideIds.length === 0) return;
    const newSlides = slides.map(s => 
      selectedSlideIds.includes(s.id) ? { ...s, [field]: value } : s
    );
    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);
    if (enableBeeps) triggerAudioBeep(600, 'sine', 0.05);
  };

  // HTML5 Drag and Drop handlers for row reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const draggedId = slides[draggedIndex].id;
    let newSlides = [...slides];

    if (selectedSlideIds.includes(draggedId)) {
      // Dragging multiple selected rows together
      const selectedSlides = slides.filter(s => selectedSlideIds.includes(s.id));
      const unselectedSlides = slides.filter(s => !selectedSlideIds.includes(s.id));

      const targetSlide = slides[targetIndex];
      let insertIndex = unselectedSlides.findIndex(s => s.id === targetSlide.id);
      if (insertIndex === -1) {
        insertIndex = targetIndex;
      } else {
        if (targetIndex > draggedIndex) {
          insertIndex += 1;
        }
      }

      const reordered = [...unselectedSlides];
      reordered.splice(insertIndex, 0, ...selectedSlides);
      newSlides = reordered;
    } else {
      // Dragging a single unselected row
      const [moved] = newSlides.splice(draggedIndex, 1);
      newSlides.splice(targetIndex, 0, moved);
    }

    setSlides(newSlides);
    saveToFirebase(newSlides, folderName);

    setDraggedIndex(null);
    setDragOverIndex(null);
    if (enableBeeps) triggerAudioBeep(650, 'sine', 0.05);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const dataUrlToUint8 = (dataUrl: string): Uint8Array => {
    const raw = atob(dataUrl.split(',')[1]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  };

  const fetchImageAsDataUrl = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
      }
    } catch (e) {
      console.warn("Failed to fetch image as dataUrl:", url, e);
    }
    return '';
  };

  const exportZip = async () => {
    if (slides.length === 0) return;
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(zipFileName || 'storyboard')!;

      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        const num = String(i + 1).padStart(3, '0');
        const fname = `${num}_S${s.sceneNo}_Shot${s.shotNo}.png`;

        let dataUrl = '';
        if (s.imageUrl) {
          dataUrl = await fetchImageAsDataUrl(s.imageUrl);
        }

        if (dataUrl) {
          folder.file(fname, dataUrlToUint8(dataUrl), { binary: true });
        } else {
          // Generate placeholder
          const cw = ASPECT_RATIOS[selectedAspectRatio]?.canvasWidth || 1280;
          const ch = ASPECT_RATIOS[selectedAspectRatio]?.canvasHeight || 720;
          const c = document.createElement('canvas');
          c.width = cw;
          c.height = ch;
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, cw, ch);
          ctx.fillStyle = '#475569';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.action || `Frame ${i + 1}`, cw / 2, ch / 2);
          folder.file(fname, dataUrlToUint8(c.toDataURL('image/png')), { binary: true });
        }
      }

      folder.file('storyboard.json', JSON.stringify({
        selectedAspectRatio,
        transitionStyle,
        slides: slides.map((s, i) => ({
          index: i,
          sceneNo: s.sceneNo,
          shotNo: s.shotNo,
          action: s.action,
          dialogue: s.dialogue,
          duration: s.duration,
          notes: s.notes,
          shotType: s.shotType || 'MS',
          colorLabel: s.colorLabel || 'none'
        })),
      }, null, 2));

      // Add package.json and README.md if they exist
      try {
        const response = await fetch('/package.json');
        const packageJson = await response.text();
        folder.file("package.json", packageJson);

        const readmeResponse = await fetch('/README.md');
        const readme = await readmeResponse.text();
        folder.file("README.md", readme);
      } catch (err) {
        console.warn("Failed to attach package/readme to zip:", err);
      }

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${zipFileName || 'storyboard'}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
      setShowZipDialog(false);
      if (enableBeeps) triggerAudioBeep(600, 'sine', 0.15);
    } catch (err) {
      console.error('ZIP export failed:', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  const exportVideo = async () => {
    if (slides.length === 0) return;
    setIsExportingVideo(true);
    setVideoExportProgress(0);
    setVideoExportStatus("Preloading storyboard frames...");
    setVideoDownloadUrl(null);
    videoCancelRef.current = false;

    try {
      // 1. Preload images
      const imageCache: Record<string, HTMLImageElement> = {};
      for (let i = 0; i < slides.length; i++) {
        if (videoCancelRef.current) return;
        const s = slides[i];
        setVideoExportStatus(`Loading scene frame ${i + 1}/${slides.length}...`);
        setVideoExportProgress(Math.round((i / slides.length) * 30)); // 0% - 30% for loading

        if (s.imageUrl) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              imageCache[s.id] = img;
              resolve();
            };
            img.onerror = () => {
              console.warn("Failed to pre-load slide image:", s.imageUrl);
              resolve(); // Continue even if load fails
            };
            img.src = s.imageUrl;
          });
        }
      }

      if (videoCancelRef.current) return;
      setVideoExportProgress(30);
      setVideoExportStatus("Initializing video stream...");

      // 2. Set Canvas dimensions based on active Aspect Ratio
      let width = 1280;
      let height = 720;
      if (selectedAspectRatio === '4:3') {
        width = 960;
        height = 720;
      } else if (selectedAspectRatio === '1:1') {
        width = 720;
        height = 720;
      } else if (selectedAspectRatio === '9:16') {
        width = 720;
        height = 1280;
      } else if (selectedAspectRatio === '2.39:1') {
        width = 1280;
        height = 536;
      }

      const canvas = videoCanvasRef.current || document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not construct 2D Canvas context.");

      // 3. Setup Audio Source & Node Mixers ONLY if voiceover/audio exists to prevent silent/empty audio track encoding crashes
      let audioCtx: AudioContext | null = null;
      let audioDest: MediaStreamAudioDestinationNode | null = null;
      const hasAudio = slides.some(s => s.audioUrl);
      if (hasAudio) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            audioDest = audioCtx.createMediaStreamDestination();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
          }
        } catch (ae) {
          console.warn("AudioContext setup not supported or failed:", ae);
        }
      }

      // 4. Record canvas stream
      const videoStream = canvas.captureStream(30); // 30 FPS
      const combinedStream = new MediaStream();
      videoStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      
      if (audioDest) {
        audioDest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
      }

      // Ensure tracks are enabled and active
      combinedStream.getTracks().forEach(track => {
        track.enabled = true;
      });

      // Determine Recorder supported MIME types - prioritize real MP4 codecs if supported by system
      let recorderMimeType = '';
      const mimesToTry = [
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      for (const m of mimesToTry) {
        if (MediaRecorder.isTypeSupported(m)) {
          recorderMimeType = m;
          break;
        }
      }

      const recorder = new MediaRecorder(combinedStream, recorderMimeType ? { mimeType: recorderMimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (videoCancelRef.current) {
          setIsExportingVideo(false);
          return;
        }
        const actualMime = recorder.mimeType || 'video/webm';
        const videoBlob = new Blob(chunks, { type: actualMime });
        const downloadUrl = URL.createObjectURL(videoBlob);
        
        // Save the correct file extension dynamically
        const isMp4 = actualMime.toLowerCase().includes('mp4');
        setVideoDownloadUrlExtension(isMp4 ? 'mp4' : 'webm');
        
        setVideoDownloadUrl(downloadUrl);
        setVideoExportStatus("Video export complete!");
        setVideoExportProgress(100);
        setIsExportingVideo(false);
        if (enableBeeps) triggerAudioBeep(600, 'sine', 0.15);
      };

      // Helper function to draw frame on Canvas
      const drawExportFrame = (
        currentSlide: Slide, 
        prevSlide: Slide | null, 
        progress: number
      ) => {
        // Background slate
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);

        const drawSingleSlide = (slide: Slide, opacity = 1, offsetX = 0, offsetY = 0, scale = 1, blurPx = 0) => {
          const img = imageCache[slide.id];
          if (!img) {
            // Draw placeholder slate if image is missing
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(offsetX, offsetY, width, height);
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = '#818cf8';
            ctx.textAlign = 'center';
            ctx.fillText(slide.action || `Frame`, width / 2 + offsetX, height / 2 + offsetY);
            ctx.restore();
            return;
          }

          ctx.save();
          ctx.globalAlpha = opacity;
          if (blurPx > 0) {
            ctx.filter = `blur(${blurPx}px)`;
          }

          const fitMode = slide.fitMode || 'contain';
          const imgW = img.width;
          const imgH = img.height;

          let drawW = width;
          let drawH = height;
          let drawX = 0;
          let drawY = 0;

          if (fitMode === 'contain') {
            const imgRatio = imgW / imgH;
            const canvasRatio = width / height;
            if (imgRatio > canvasRatio) {
              drawW = width;
              drawH = width / imgRatio;
              drawX = 0;
              drawY = (height - drawH) / 2;
            } else {
              drawH = height;
              drawW = height * imgRatio;
              drawX = (width - drawW) / 2;
              drawY = 0;
            }
          } else {
            // cover
            const imgRatio = imgW / imgH;
            const canvasRatio = width / height;
            if (imgRatio > canvasRatio) {
              drawH = height;
              drawW = height * imgRatio;
              drawX = (width - drawW) / 2;
              drawY = 0;
            } else {
              drawW = width;
              drawH = width / imgRatio;
              drawX = 0;
              drawY = (height - drawH) / 2;
            }
          }

          // Apply transformations
          if (scale !== 1) {
            const cx = drawX + drawW / 2;
            const cy = drawY + drawH / 2;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
          }

          ctx.drawImage(img, drawX + offsetX, drawY + offsetY, drawW, drawH);
          ctx.restore();
        };

        // Transition blends
        if (progress > 0 && progress < 1 && prevSlide && transitionStyle !== 'none') {
          if (transitionStyle === 'fade') {
            drawSingleSlide(prevSlide, 1 - progress);
            drawSingleSlide(currentSlide, progress);
          } else if (transitionStyle === 'wipe') {
            const offset = progress * width;
            drawSingleSlide(prevSlide, 1, -offset, 0);
            drawSingleSlide(currentSlide, 1, width - offset, 0);
          } else if (transitionStyle === 'slideUp') {
            const offset = progress * height;
            drawSingleSlide(prevSlide, 1, 0, -offset);
            drawSingleSlide(currentSlide, 1, 0, height - offset);
          } else if (transitionStyle === 'zoom') {
            drawSingleSlide(prevSlide, 1 - progress, 0, 0, 1 + progress * 0.15);
            drawSingleSlide(currentSlide, progress, 0, 0, 0.85 + progress * 0.15);
          } else if (transitionStyle === 'blur') {
            const maxBlur = 12;
            const blurPrev = progress < 0.5 ? progress * 2 * maxBlur : 0;
            const blurCurr = progress >= 0.5 ? (1 - progress) * 2 * maxBlur : 0;
            if (progress < 0.5) {
              drawSingleSlide(prevSlide, 1 - progress, 0, 0, 1, blurPrev);
            } else {
              drawSingleSlide(currentSlide, progress, 0, 0, 1, blurCurr);
            }
          } else {
            drawSingleSlide(currentSlide, 1);
          }
        } else {
          drawSingleSlide(currentSlide, 1);
        }

        // Draw Screenplay Overlay Text
        const overlayH = height * 0.22;
        const grad = ctx.createLinearGradient(0, height - overlayH, 0, height);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.82)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.96)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height - overlayH, width, overlayH);

        // Drawing pills
        let badgeX = 24;
        const badgeY = height - overlayH + 18;
        const badgeH = 20;

        const drawPill = (label: string, bgColor: string, textColor: string, isMono = false) => {
          ctx.font = isMono ? 'bold 10px monospace' : 'bold 10px sans-serif';
          const textW = ctx.measureText(label).width;
          const padX = 7;
          const badgeW = textW + padX * 2;

          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
          ctx.fill();

          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, badgeX + padX, badgeY + badgeH / 2 + 1);

          badgeX += badgeW + 6;
        };

        drawPill(`Scene ${currentSlide.sceneNo || 1}`, '#4f46e5', '#ffffff');
        drawPill(`Shot ${currentSlide.shotNo || 1} • ${currentSlide.shotType || 'MS'}`, '#27272a', '#a1a1aa');
        const durSecs = ((currentSlide.duration || 3000) / 1000).toFixed(1);
        drawPill(`${durSecs}s`, '#18181b', '#71717a');

        let currentY = badgeY + badgeH + 14;

        if (currentSlide.action) {
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const maxTextW = width - 64;
          const words = currentSlide.action.split(' ');
          let line = '';
          const lines = [];
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxTextW && n > 0) {
              lines.push(line);
              line = words[n] + ' ';
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          for (let i = 0; i < Math.min(lines.length, 2); i++) {
            ctx.fillText(lines[i].trim(), width / 2, currentY);
            currentY += 15;
          }
        }

        if (currentSlide.dialogue) {
          ctx.font = 'italic 11px sans-serif';
          ctx.fillStyle = '#a5b4fc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const maxTextW = width - 80;
          const words = `"${currentSlide.dialogue}"`.split(' ');
          let line = '';
          const lines = [];
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxTextW && n > 0) {
              lines.push(line);
              line = words[n] + ' ';
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          for (let i = 0; i < Math.min(lines.length, 2); i++) {
            ctx.fillText(lines[i].trim(), width / 2, currentY + 3);
            currentY += 13;
          }
        }

        // Dedicated Subtitle Track Overlay (Cinematic burn-in subtitle)
        if (videoSubtitlesEnabled && currentSlide.dialogue) {
          ctx.save();
          // Subtitles font size scales with height
          const subtitleFontSize = Math.max(15, Math.round(height * 0.04));
          ctx.font = `bold ${subtitleFontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const maxSubW = width - 120;
          const subWords = currentSlide.dialogue.split(' ');
          let subLine = '';
          const subLines = [];
          for (let n = 0; n < subWords.length; n++) {
            const testLine = subLine + subWords[n] + ' ';
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxSubW && n > 0) {
              subLines.push(subLine);
              subLine = subWords[n] + ' ';
            } else {
              subLine = testLine;
            }
          }
          subLines.push(subLine);

          // Position subtitles near the middle-bottom, safely above the Screenplay bar (top of bar is at height * 0.78)
          const subtitleLineHeight = subtitleFontSize + 8;
          const startSubY = (height * 0.78) - (subLines.length * subtitleLineHeight) - 10;

          subLines.forEach((sLine, index) => {
            const cleanText = sLine.trim();
            if (!cleanText) return;

            const textWidth = ctx.measureText(cleanText).width;
            const textY = startSubY + (index * subtitleLineHeight);

            // Semi-transparent black background box for premium readability
            const padX = 14;
            const padY = 5;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(
              (width / 2) - (textWidth / 2) - padX,
              textY - (subtitleFontSize / 2) - padY,
              textWidth + (padX * 2),
              subtitleFontSize + (padY * 2),
              6
            );
            ctx.fill();

            // Text stroke
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(cleanText, width / 2, textY);

            // Text color (cinematic soft yellow)
            ctx.fillStyle = '#fef08a';
            ctx.fillText(cleanText, width / 2, textY);
          });

          ctx.restore();
        }
      };

      // Helper to play slide voiceover connected to media recorder destination
      const playSlideExportAudio = async (slide: Slide) => {
        if (!audioCtx || !audioDest || !slide.audioUrl) return;
        try {
          const fetched = await fetch(slide.audioUrl);
          const arrayBuf = await fetched.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arrayBuf);
          const srcNode = audioCtx.createBufferSource();
          srcNode.buffer = decoded;
          srcNode.connect(audioDest);
          srcNode.connect(audioCtx.destination);
          srcNode.start(0);
        } catch (err) {
          console.warn("Could not play slide audio in video record:", err);
        }
      };

      // Draw the first frame immediately before starting the recorder to initialize the canvas size and pixels
      drawExportFrame(slides[0], null, 1);

      // Start recording
      recorder.start(100); // 100ms timeslices is much more stable than 10ms for encoder engines
      
      let slideIdx = 0;
      let slideStartTime = performance.now();
      
      // Play voiceover audio for first slide
      playSlideExportAudio(slides[0]);

      const fps = 30;
      const frameInterval = 1000 / fps;

      const loop = () => {
        if (videoCancelRef.current) {
          try {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          } catch (e) {}
          if (audioCtx) {
            try { audioCtx.close(); } catch (e) {}
          }
          setIsExportingVideo(false);
          return;
        }

        const now = performance.now();
        const elapsed = now - slideStartTime;
        const currentSlide = slides[slideIdx];
        const prevSlide = slideIdx > 0 ? slides[slideIdx - 1] : null;
        const duration = currentSlide?.duration || 3000;

        // Progress bar calculation (mapped from 30% to 100%)
        const completedSlidesRatio = (slideIdx + Math.min(elapsed / duration, 1)) / slides.length;
        setVideoExportProgress(Math.round(30 + completedSlidesRatio * 70));
        setVideoExportStatus(`Recording slide ${slideIdx + 1} of ${slides.length}...`);

        // Compute transition progress (0 -> 1)
        let transProg = 1;
        const transDurMs = transitionDuration * 1000;
        if (slideIdx > 0 && transitionStyle !== 'none' && elapsed < transDurMs) {
          transProg = elapsed / transDurMs;
        }

        // Draw current frame on the canvas
        drawExportFrame(currentSlide, prevSlide, transProg);

        if (elapsed >= duration) {
          if (slideIdx < slides.length - 1) {
            slideIdx++;
            slideStartTime = performance.now();
            playSlideExportAudio(slides[slideIdx]);
            setTimeout(loop, frameInterval);
          } else {
            setVideoExportStatus("Processing video encoding...");
            try {
              if (recorder.state !== 'inactive') {
                recorder.stop();
              }
            } catch (e) {}
            if (audioCtx) {
              setTimeout(() => {
                try { audioCtx?.close(); } catch (e) {}
              }, 500);
            }
          }
        } else {
          setTimeout(loop, frameInterval);
        }
      };

      // Launch background-safe render & encode loop
      setTimeout(loop, frameInterval);

    } catch (error) {
      console.error("Video export failed:", error);
      setVideoExportStatus(`Video Export failed: ${error instanceof Error ? error.message : "Internal error"}`);
      setIsExportingVideo(false);
    }
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 640, 360);
          ctx.fillStyle = '#475569';
          ctx.font = '24px sans-serif';
          ctx.fillText('Frame Image Not Loaded', 180, 190);
        }
        const dummyImg = new Image();
        dummyImg.onload = () => resolve(dummyImg);
        dummyImg.src = canvas.toDataURL();
      };
      img.src = url;
    });
  };

  const handleDownloadPDF = async () => {
    if (isGeneratingPDF || slides.length === 0) return;
    setIsGeneratingPDF(true);

    try {
      const loadedImages = await Promise.all(slides.map(slide => loadImage(slide.imageUrl)));
      const doc = new jsPDF({
        orientation: printOrientation,
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = printOrientation === 'portrait' ? 210 : 297;
      const pageHeight = printOrientation === 'portrait' ? 297 : 210;
      const margin = 15;
      const colGap = 8;
      const rowGap = 8;

      let currentY = margin;
      let pageNum = 1;

      const drawHeader = (pNum: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(17, 24, 39);
        const titleText = printTitle || folderName || 'Storyboard Sequence';
        doc.text(titleText, margin, margin + 4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text('CINEMATIC STORYBOARD SEQUENCE', margin, margin + 9);

        if (printAuthor) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(75, 85, 99);
          doc.text(`Director: ${printAuthor}`, pageWidth - margin, margin + 4, { align: 'right' });
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        const statsText = `Frames: ${slides.length} | Page ${pNum}`;
        doc.text(statsText, pageWidth - margin, margin + 9, { align: 'right' });

        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(margin, margin + 12, pageWidth - margin, margin + 12);
      };

      const drawFooter = (pNum: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Generated via AI Studio Storyboard Editor`, margin, pageHeight - 8);
        doc.text(`Page ${pNum}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      };

      drawHeader(pageNum);
      currentY = margin + 18;

      if (printLayout === 'grid') {
        const cols = printCols;
        const colWidth = (pageWidth - 2 * margin - (cols - 1) * colGap) / cols;
        const imgHeight = colWidth * 9 / 16;

        const rows: Array<Array<{ slide: Slide; img: HTMLImageElement; index: number }>> = [];
        for (let i = 0; i < slides.length; i += cols) {
          const rowItems = [];
          for (let j = 0; j < cols && (i + j) < slides.length; j++) {
            rowItems.push({
              slide: slides[i + j],
              img: loadedImages[i + j],
              index: i + j
            });
          }
          rows.push(rowItems);
        }

        for (const row of rows) {
          const rowHeights = row.map(({ slide }) => {
            let itemHeight = imgHeight;
            if (printMeta) {
              itemHeight += 6;
            }
            if (printNotes && slide.action) {
              const lines = doc.splitTextToSize(slide.action, colWidth - 6);
              itemHeight += lines.length * 3.5 + 3;
            }
            if (printDialogue && slide.dialogue) {
              const lines = doc.splitTextToSize(`"${slide.dialogue}"`, colWidth - 8);
              itemHeight += lines.length * 3.5 + 5;
            }
            if (printNotes && slide.notes) {
              const lines = doc.splitTextToSize(slide.notes, colWidth - 6);
              itemHeight += lines.length * 3 + 3;
            }
            itemHeight += 5;
            return itemHeight;
          });

          const maxRowHeight = Math.max(...rowHeights);

          if (currentY + maxRowHeight > pageHeight - margin - 12) {
            drawFooter(pageNum);
            doc.addPage();
            pageNum++;
            drawHeader(pageNum);
            currentY = margin + 18;
          }

          for (let c = 0; c < row.length; c++) {
            const { slide, img, index } = row[c];
            const x = margin + c * (colWidth + colGap);
            let itemY = currentY;

            doc.setDrawColor(229, 231, 235);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x, itemY, colWidth, maxRowHeight, 1.5, 1.5, 'FD');

            try {
              doc.addImage(img, 'PNG', x + 1, itemY + 1, colWidth - 2, imgHeight - 1);
            } catch (err) {
              console.error("Error adding image in PDF:", err);
            }

            doc.setDrawColor(243, 244, 246);
            doc.rect(x + 1, itemY + 1, colWidth - 2, imgHeight - 1);

            itemY += imgHeight + 2;

            if (printMeta) {
              doc.setFont('courier', 'bold');
              doc.setFontSize(7.5);
              doc.setTextColor(79, 70, 229);
              const metaText = `SCENE ${slide.sceneNo} · SHOT ${slide.shotNo}`;
              doc.text(metaText, x + 3, itemY + 3);

              if (slide.shotType) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.5);
                doc.setTextColor(107, 114, 128);
                doc.text(slide.shotType.toUpperCase(), x + colWidth - 3, itemY + 3, { align: 'right' });
              }
              itemY += 5;
            }

            if (printNotes && slide.action) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.5);
              doc.setTextColor(156, 163, 175);
              doc.text('ACTION / DIRECTION', x + 3, itemY + 2);
              itemY += 4.5;

              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7.5);
              doc.setTextColor(55, 65, 81);
              const lines = doc.splitTextToSize(slide.action, colWidth - 6);
              doc.text(lines, x + 3, itemY);
              itemY += lines.length * 3.5;
            }

            if (printDialogue && slide.dialogue) {
              const lines = doc.splitTextToSize(`"${slide.dialogue}"`, colWidth - 8);
              const boxHeight = lines.length * 3.5 + 3.5;

              doc.setFillColor(249, 250, 251);
              doc.setDrawColor(243, 244, 246);
              doc.rect(x + 3, itemY, colWidth - 6, boxHeight, 'F');

              doc.setFillColor(156, 163, 175);
              doc.rect(x + 3, itemY, 1.2, boxHeight, 'F');

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6);
              doc.setTextColor(156, 163, 175);
              doc.text('DIALOGUE / CUE', x + 5, itemY + 2.5);

              doc.setFont('helvetica', 'italic');
              doc.setFontSize(7);
              doc.setTextColor(31, 41, 55);
              doc.text(lines, x + 5, itemY + 5.5);

              itemY += boxHeight + 2;
            }

            if (printNotes && slide.notes) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.5);
              doc.setTextColor(156, 163, 175);
              doc.text("DIRECTOR'S NOTES", x + 3, itemY + 2.5);
              itemY += 5;

              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.setTextColor(107, 114, 128);
              const lines = doc.splitTextToSize(slide.notes, colWidth - 6);
              doc.text(lines, x + 3, itemY);
              itemY += lines.length * 3;
            }

            doc.setFont('courier', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(209, 213, 219);
            doc.text(`#${index + 1}`, x + colWidth - 3, currentY + maxRowHeight - 2, { align: 'right' });
          }

          currentY += maxRowHeight + rowGap;
        }
      } else {
        const imgWidth = printOrientation === 'portrait' ? 55 : 65;
        const imgHeight = imgWidth * 9 / 16;
        const rightWidth = pageWidth - 2 * margin - imgWidth - colGap;

        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          const img = loadedImages[i];

          let detailsHeight = 4;
          if (printMeta) detailsHeight += 6;
          if (printNotes && slide.action) {
            const lines = doc.splitTextToSize(slide.action, rightWidth - 4);
            detailsHeight += lines.length * 3.5 + 5;
          }
          if (printDialogue && slide.dialogue) {
            const lines = doc.splitTextToSize(`"${slide.dialogue}"`, rightWidth - 8);
            detailsHeight += lines.length * 3.5 + 7;
          }
          if (printNotes && slide.notes) {
            const lines = doc.splitTextToSize(slide.notes, rightWidth - 4);
            detailsHeight += lines.length * 3 + 5;
          }

          const maxItemHeight = Math.max(imgHeight + 4, detailsHeight);

          if (currentY + maxItemHeight > pageHeight - margin - 12) {
            drawFooter(pageNum);
            doc.addPage();
            pageNum++;
            drawHeader(pageNum);
            currentY = margin + 18;
          }

          doc.setDrawColor(229, 231, 235);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(margin, currentY, pageWidth - 2 * margin, maxItemHeight, 1.5, 1.5, 'FD');

          try {
            doc.addImage(img, 'PNG', margin + 2, currentY + 2, imgWidth - 2, imgHeight);
          } catch (err) {
            console.error("Error adding list image:", err);
          }

          doc.setDrawColor(243, 244, 246);
          doc.rect(margin + 2, currentY + 2, imgWidth - 2, imgHeight);

          const rightX = margin + imgWidth + colGap;
          let detailY = currentY + 2;

          if (printMeta) {
            doc.setFont('courier', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(79, 70, 229);
            const metaText = `SCENE ${slide.sceneNo} · SHOT ${slide.shotNo}`;
            doc.text(metaText, rightX + 2, detailY + 3);

            if (slide.shotType) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7);
              doc.setTextColor(107, 114, 128);
              doc.text(slide.shotType.toUpperCase(), rightX + rightWidth - 4, detailY + 3, { align: 'right' });
            }
            detailY += 6;
          }

          if (printNotes && slide.action) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(156, 163, 175);
            doc.text('ACTION / DIRECTION', rightX + 2, detailY + 1.5);
            detailY += 4.5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(55, 65, 81);
            const lines = doc.splitTextToSize(slide.action, rightWidth - 4);
            doc.text(lines, rightX + 2, detailY);
            detailY += lines.length * 3.5;
          }

          if (printDialogue && slide.dialogue) {
            const lines = doc.splitTextToSize(`"${slide.dialogue}"`, rightWidth - 8);
            const boxHeight = lines.length * 3.5 + 3.5;

            doc.setFillColor(249, 250, 251);
            doc.setDrawColor(243, 244, 246);
            doc.rect(rightX + 2, detailY, rightWidth - 4, boxHeight, 'F');

            doc.setFillColor(156, 163, 175);
            doc.rect(rightX + 2, detailY, 1.2, boxHeight, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(156, 163, 175);
            doc.text('DIALOGUE / CUE', rightX + 4, detailY + 2.5);

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(31, 41, 55);
            doc.text(lines, rightX + 4, detailY + 5.5);

            detailY += boxHeight + 2;
          }

          if (printNotes && slide.notes) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(156, 163, 175);
            doc.text("DIRECTOR'S NOTES", rightX + 2, detailY + 2.5);
            detailY += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(107, 114, 128);
            const lines = doc.splitTextToSize(slide.notes, rightWidth - 4);
            doc.text(lines, rightX + 2, detailY);
            detailY += lines.length * 3;
          }

          doc.setFont('courier', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(209, 213, 219);
          doc.text(`#${i + 1}`, pageWidth - margin - 3, currentY + maxItemHeight - 2, { align: 'right' });

          currentY += maxItemHeight + rowGap;
        }
      }

      drawFooter(pageNum);

      const filename = `${(printTitle || folderName || 'storyboard').toLowerCase().replace(/\s+/g, '-')}-storyboard.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("Failed to generate PDF document:", err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Calculate project statistics
  const totalDurationSeconds = slides.reduce((acc, curr) => acc + (curr.duration || 3000), 0) / 1000;

  // Filter and search slides safely
  const filteredSlides = slides.filter((slide) => {
    if (!slide) return false;
    const action = slide.action || '';
    const dialogue = slide.dialogue || '';
    const notes = slide.notes || '';
    const sceneNo = slide.sceneNo !== undefined ? String(slide.sceneNo) : '';

    const matchesSearch = 
      action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dialogue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `scene ${sceneNo}`.includes(searchQuery.toLowerCase());
    
    const slideColor = slide.colorLabel || 'none';
    const matchesColor = colorFilter === 'all' || slideColor === colorFilter;

    return matchesSearch && matchesColor;
  });

  const selectedTheme = THEMES.find(t => t.id === currentThemeId) || THEMES[0];

  return (
    <>
      <style>{`
        :root {
          ${Object.entries(selectedTheme.variables).map(([key, val]) => {
            if (customBgColor) {
              if (key === '--theme-bg-app') return `${key}: ${customBgColor};`;
              if (key === '--theme-bg-header') return `${key}: ${customBgColor};`;
              if (key === '--theme-bg-panel') return `${key}: ${customBgColor};`;
              if (key === '--theme-badge-bg') return `${key}: ${customBgColor};`;
              if (key === '--theme-border') return `${key}: ${customBgColor}40;`;
            }
            if (customTextColor) {
              if (key === '--theme-text-primary') return `${key}: ${customTextColor};`;
              if (key === '--theme-text-heading') return `${key}: ${customTextColor};`;
              if (key === '--theme-text-muted') return `${key}: ${customTextColor}b3;`;
            }
            return `${key}: ${val};`;
          }).join('\n          ')}
        }
        .bg-theme-app { background-color: var(--theme-bg-app) !important; }
        .bg-theme-header { background-color: var(--theme-bg-header) !important; }
        .bg-theme-panel { background-color: var(--theme-bg-panel) !important; }
        .border-theme { border-color: var(--theme-border) !important; }
        .text-theme-primary { color: var(--theme-text-primary) !important; }
        .text-theme-heading { color: var(--theme-text-heading) !important; }
        .text-theme-muted { color: var(--theme-text-muted) !important; }
        .bg-theme-badge { background-color: var(--theme-badge-bg) !important; }
        .bg-theme-accent { background-color: var(--theme-accent) !important; }
        .text-theme-accent { color: var(--theme-accent-text) !important; }

        /* Force standard neutral/slate text colors to respect the theme text colors inside any themed areas */
        .bg-theme-app .text-neutral-100, .bg-theme-app .text-slate-100 { color: var(--theme-text-heading) !important; }
        .bg-theme-app .text-neutral-200, .bg-theme-app .text-slate-200 { color: var(--theme-text-heading) !important; }
        .bg-theme-app .text-neutral-300, .bg-theme-app .text-slate-300 { color: var(--theme-text-primary) !important; }
        .bg-theme-app .text-neutral-400, .bg-theme-app .text-slate-400 { color: var(--theme-text-muted) !important; }
        .bg-theme-app .text-neutral-500, .bg-theme-app .text-slate-500 { color: var(--theme-text-muted) !important; }

        /* Tab Switcher Styling */
        .theme-tab-inactive {
          color: var(--theme-text-muted) !important;
          background-color: transparent !important;
        }
        .theme-tab-inactive:hover {
          color: var(--theme-text-primary) !important;
          background-color: rgba(120, 120, 120, 0.12) !important;
        }
        .theme-tab-active {
          background-color: var(--theme-accent) !important;
          color: var(--theme-accent-text) !important;
        }
      `}</style>

      <div className="flex flex-col h-screen bg-[#0A0A0B] bg-theme-app text-neutral-300 text-theme-primary overflow-hidden font-sans print:hidden">
        {firebaseQuotaError && (
          <div className="bg-amber-950/50 border-b border-amber-900/50 px-6 py-2.5 flex items-center justify-between text-amber-300 text-xs animate-fade-in shrink-0 z-50">
            <div className="flex items-center gap-2.5">
              <span className="flex-none bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider border border-amber-500/30">Quota Notice</span>
              <p className="leading-normal">
                Firestore daily database limit reached ({firebaseQuotaError}). 
                <strong> Storyboard Editor has automatically enabled Local Mode.</strong> Your edits are saved securely in your browser's local storage and can still be exported! 
              </p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <a 
                href="https://console.firebase.google.com/project/gen-lang-client-0744426338/firestore/databases/ai-studio-framesequencerv0-c1378c94-1469-4c6a-8342-609eb52630d5/data?openUpgradeDialog=true" 
                target="_blank" 
                rel="noreferrer" 
                className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/35 border border-amber-600/30 text-amber-200 rounded font-bold transition-all text-[10px] uppercase tracking-wider whitespace-nowrap"
              >
                Check Quota / Upgrade
              </a>
              <button 
                onClick={() => setFirebaseQuotaError(null)} 
                className="text-amber-500 hover:text-amber-300 font-extrabold text-sm px-1 cursor-pointer"
                title="Close Banner"
              >
                ×
              </button>
            </div>
          </div>
        )}
      {/* Primary Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 border-theme bg-[#0C0C0E] bg-theme-header shrink-0 z-10">
        <div className="flex items-center gap-6">
          {/* Theme panel gear icon on the FAR LEFT */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg border transition-all cursor-pointer shadow-sm",
                showSettingsDropdown 
                  ? "bg-amber-600/25 border-amber-500/40 text-amber-400" 
                  : "bg-amber-600/15 border-amber-500/20 text-amber-500 hover:bg-amber-600/25"
              )}
              title="Appearance & Theme Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {showSettingsDropdown && (
              <div className="absolute left-0 mt-2 w-64 bg-neutral-950 bg-theme-panel border border-neutral-800 border-theme rounded-xl p-4 shadow-2xl z-[150] text-left animate-fade-in text-theme-primary">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-extrabold text-neutral-400 text-theme-muted uppercase tracking-wider">Preset Themes</h4>
                  <span className="text-[9px] text-neutral-600 font-mono">Select Base</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  {THEMES.map((t) => {
                    const isActive = currentThemeId === t.id && !customBgColor && !customTextColor;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          handleSetTheme(t.id);
                          handleSetCustomBgColor('');
                          handleSetCustomTextColor('');
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-2 rounded-lg border text-[9px] font-bold transition-all cursor-pointer truncate",
                          isActive 
                            ? "border-indigo-500 bg-indigo-500/10 text-white" 
                            : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        )}
                        title={t.name}
                      >
                        <span 
                          className="w-4 h-4 rounded-full border border-neutral-700/50 flex items-center justify-center shrink-0"
                          style={{ 
                            background: `linear-gradient(135deg, ${t.variables['--theme-bg-app']} 50%, ${t.variables['--theme-text-primary']} 50%)`
                          }}
                        />
                        <span className="truncate max-w-[62px] text-center">{t.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="h-px bg-neutral-800/80 border-theme my-3" />

                {/* Button Style / Display Mode Switcher */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-extrabold text-neutral-400 text-theme-muted uppercase tracking-wider">Button Display Mode</h4>
                    <span className="text-[9px] text-indigo-400 font-bold font-mono font-sans">Header Style</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['icons', 'text', 'both'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setHeaderDisplayMode(mode)}
                        className={cn(
                          "py-1 px-1.5 rounded-lg border text-[9px] font-extrabold transition-all cursor-pointer text-center",
                          headerDisplayMode === mode
                            ? "border-indigo-500 bg-indigo-500/15 text-indigo-400"
                            : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-400 hover:text-white"
                        )}
                      >
                        {mode === 'icons' ? 'Icons' : mode === 'text' ? 'Text' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-neutral-800/80 border-theme my-3" />

                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-extrabold text-neutral-400 text-theme-muted uppercase tracking-wider">Custom Color Tuner</h4>
                  <span className="text-[9px] text-indigo-400 font-bold font-mono">Live</span>
                </div>
                
                <div className="space-y-3 mb-4 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-neutral-400 text-theme-muted">Background</span>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="color" 
                        value={customBgColor || selectedTheme.variables['--theme-bg-app']} 
                        onChange={(e) => handleSetCustomBgColor(e.target.value)} 
                        className="w-6 h-6 rounded cursor-pointer border border-neutral-700/60 p-0 overflow-hidden bg-transparent shrink-0" 
                      />
                      <span className="text-[9px] font-mono text-neutral-500 select-all">
                        {customBgColor || selectedTheme.variables['--theme-bg-app']}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-neutral-400 text-theme-muted">Text / Headings</span>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="color" 
                        value={customTextColor || selectedTheme.variables['--theme-text-primary']} 
                        onChange={(e) => handleSetCustomTextColor(e.target.value)} 
                        className="w-6 h-6 rounded cursor-pointer border border-neutral-700/60 p-0 overflow-hidden bg-transparent shrink-0" 
                      />
                      <span className="text-[9px] font-mono text-neutral-500 select-all">
                        {customTextColor || selectedTheme.variables['--theme-text-primary']}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-neutral-800/80 border-theme my-3" />

                <button
                  onClick={() => {
                    handleSetCustomBgColor('');
                    handleSetCustomTextColor('#10b981');
                  }}
                  disabled={!customBgColor && (customTextColor === '' || customTextColor === '#10b981')}
                  className={cn(
                    "w-full py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border",
                    (customBgColor || customTextColor)
                      ? "bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400 cursor-pointer"
                      : "bg-neutral-900 border-neutral-850 text-neutral-600 cursor-not-allowed"
                  )}
                  title="Reset customization to default preset values"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to Preset
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-emerald-400" />
            <span className="text-base font-black tracking-tight text-emerald-400">FilmStrip Editor</span>
          </div>
          
          <div className="h-4 w-px bg-neutral-800 border-theme" />
 
          {/* Project Details */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                saveToFirebase(slides, e.target.value);
              }}
              className="bg-transparent border border-transparent hover:border-neutral-800 focus:border-emerald-500 focus:bg-[#121215] hover:border-theme focus:bg-theme-panel px-2 py-1 rounded text-sm text-emerald-400 font-extrabold uppercase tracking-widest transition-all outline-none max-w-[200px]"
              title="Click to rename sequence"
            />
            <div className="text-[11px] text-emerald-500 font-mono font-bold flex items-center gap-1.5 bg-emerald-950/20 px-2.5 py-1 rounded-md border border-emerald-500/30">
              <span className="text-emerald-400 font-extrabold">{slides.length}</span> frames • 
              <span className="text-emerald-400 font-extrabold">{totalDurationSeconds.toFixed(1)}s</span> sequence
            </div>
          </div>
        </div>
 
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setImageStudioTab('enhance');
              setShowImageStudio(true);
            }}
            className="flex items-center justify-center w-9 h-9 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 rounded-lg border border-emerald-500/20 border-theme transition-all cursor-pointer text-xs"
            title="Open Image Studio AI (Toolbox)"
          >
            <Wrench className="w-4 h-4 text-emerald-400" />
          </button>

          <button 
            onClick={() => {
              setVideoFileName(folderName + '_playback');
              setShowVideoDialog(true);
            }} 
            disabled={slides.length === 0} 
            className="flex items-center justify-center w-9 h-9 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 rounded-lg border border-indigo-500/20 border-theme transition-all disabled:opacity-40 cursor-pointer text-xs"
            title="Export Playback as Video (MP4)"
          >
            <Video className="w-4 h-4 text-indigo-400" />
          </button>

          <button 
            onClick={() => {
              setZipFileName(folderName);
              setShowZipDialog(true);
            }} 
            disabled={slides.length === 0} 
            className="flex items-center justify-center w-9 h-9 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 rounded-lg border border-blue-500/20 border-theme transition-all disabled:opacity-40"
            title="Export Project ZIP: Download all storyboard frames"
          >
            <Download className="w-4 h-4 text-blue-400" />
          </button>
 
          <button 
            onClick={() => setShowPrintPreview(true)} 
            disabled={slides.length === 0} 
            className="flex items-center justify-center w-9 h-9 bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 rounded-lg border border-rose-500/20 border-theme transition-all disabled:opacity-40 cursor-pointer text-xs"
            title="Export to PDF: Open PDF layout configuration"
          >
            <Printer className="w-4 h-4 text-rose-400" />
          </button>

          <button 
            onClick={handleClearSession}
            className="flex items-center justify-center w-9 h-9 bg-red-600/15 hover:bg-red-600/25 text-red-400 rounded-lg border border-red-500/20 border-theme transition-all cursor-pointer text-xs"
            title="Clear Session: Delete all frames and start anew"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>


        </div>
      </header>
 
      {/* Control Rail */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-800/60 border-theme bg-[#0A0A0B] bg-theme-app shrink-0 z-10 text-xs">
        {activeLayout !== 'player' ? (
          <>
            {/* Left Section for Grid / List Sequencer views */}
            <div className="flex items-center gap-4">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search actions, script..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-neutral-900 bg-theme-panel border border-neutral-800/80 border-theme rounded-lg pl-8 pr-3 py-1.5 w-48 text-xs text-neutral-300 text-theme-primary focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Group of 3 buttons (FolderPlus, Plus, SlidersHorizontal) */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowUpload(true)} 
                  className="flex items-center justify-center w-8 h-8 bg-emerald-950/20 hover:bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 hover:border-emerald-500/30 rounded-lg transition-all text-xs font-bold cursor-pointer"
                  title="Import Frames: Drag & drop or choose images"
                >
                  <FolderPlus className="w-4 h-4 text-emerald-400" />
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setShowAddBlankDropdown(!showAddBlankDropdown)} 
                    className="flex items-center justify-center w-8 h-8 bg-emerald-950/20 hover:bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 hover:border-emerald-500/30 rounded-lg transition-all text-xs font-bold cursor-pointer"
                    title="Add Blank Frame: Create canvas with color or gradient"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                  </button>
                  {showAddBlankDropdown && (
                    <div className="absolute left-0 mt-1.5 w-56 bg-[#0E0E11] bg-theme-panel border border-neutral-800 border-theme rounded-xl p-2 shadow-2xl z-40 animate-fade-in">
                      <p className="text-[10px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider px-2 py-1">Canvas Presets</p>
                      <div className="grid grid-cols-2 gap-1 p-1">
                        <button onClick={() => { handleAddBlankFrame('#000000'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-black hover:opacity-90 text-white rounded text-[10px] font-bold border border-neutral-800 border-theme text-left">Solid Black</button>
                        <button onClick={() => { handleAddBlankFrame('#ffffff'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-white hover:opacity-90 text-black rounded text-[10px] font-bold border border-neutral-200 border-theme text-left">Solid White</button>
                        <button onClick={() => { handleAddBlankFrame('#1a1a1c'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-neutral-900 bg-theme-badge hover:opacity-90 text-neutral-300 text-theme-primary rounded text-[10px] font-bold border border-neutral-800 border-theme text-left">Cinematic Gray</button>
                        <button onClick={() => { handleAddBlankFrame('#1e293b'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-slate-800 hover:opacity-90 text-slate-300 rounded text-[10px] font-bold border border-slate-700 border-theme text-left">Slate Blue</button>
                      </div>
                      <div className="h-px bg-neutral-800 border-theme my-1.5" />
                      <p className="text-[10px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider px-2 py-1">Gradient Backdrops</p>
                      <div className="space-y-1 p-1 max-h-[140px] overflow-y-auto">
                        {GRADIENT_PRESETS.map((grad, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => { handleAddBlankFrame(grad); setShowAddBlankDropdown(false); }}
                            className="w-full h-6 rounded border border-neutral-800 border-theme hover:scale-[1.02] transition-transform"
                            style={{ background: grad }}
                            title="Select gradient"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleAutoNumber} 
                  disabled={slides.length === 0}
                  className="flex items-center justify-center w-8 h-8 bg-emerald-950/20 hover:bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 hover:border-emerald-500/30 rounded-lg transition-all text-xs font-bold cursor-pointer disabled:opacity-40"
                  title="Auto-Number: Sequentially re-number Scene/Shot"
                >
                  <div className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full border border-emerald-400/90 text-[10px] font-black leading-none select-none text-emerald-400">
                    {slides.length}
                  </div>
                </button>
              </div>

              {/* Vertical Separator */}
              <div className="h-5 w-px bg-neutral-800 border-theme" />

              {/* Layout Pill Capsule */}
              <div className="flex bg-emerald-950/10 p-0.5 rounded-lg border border-emerald-900/40 border-theme">
                <button 
                  onClick={() => setActiveLayout(activeLayout === 'grid' ? 'spreadsheet' : 'grid')} 
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md transition-all cursor-pointer bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)] hover:bg-emerald-500"
                  )}
                  title={activeLayout === 'grid' ? "Switch to List Sequencer" : "Switch to Grid Storyboard"}
                >
                  {activeLayout === 'grid' ? (
                    <Layout className="w-4 h-4" />
                  ) : (
                    <List className="w-4 h-4" />
                  )}
                </button>
                <button 
                  onClick={() => setShowScriptEditor(!showScriptEditor)} 
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md transition-all cursor-pointer",
                    showScriptEditor 
                      ? "bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                      : "text-emerald-400 hover:bg-[#0C0C0F]"
                  )}
                  title={showScriptEditor ? "Hide Screenplay Editor" : "Show Screenplay Editor"}
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setActiveLayout('player')} 
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md transition-all cursor-pointer",
                    activeLayout === 'player' 
                      ? "bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                      : "text-emerald-400 hover:bg-emerald-950/35"
                  )}
                  title="Playback / Preview"
                >
                  <PlayCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Cyclic View Density Button */}
              <button
                onClick={() => {
                  setViewDensity((prev) => {
                    if (prev === 'full') return 'compact';
                    if (prev === 'compact') return 'strip';
                    if (prev === 'strip') return 'icon';
                    if (prev === 'icon') return 'grid-storyboard';
                    return 'full';
                  });
                }}
                className="flex items-center justify-center w-8 h-8 bg-emerald-950/20 hover:bg-emerald-950/45 text-emerald-400 rounded-lg border border-emerald-900/40 transition-all cursor-pointer"
                title={showScriptEditor 
                  ? `Cycle Screenplay Sizing (Current: ${
                      viewDensity === 'full' ? 'FULLSCREEN' : 
                      viewDensity === 'compact' ? 'HALF-SCREEN RIGHT' : 
                      viewDensity === 'strip' ? 'HALF-SCREEN LEFT' : 
                      viewDensity === 'grid-storyboard' ? 'GRID STORYBOARD' : 'STANDARD'
                    })`
                  : `Cycle view density (Current: ${viewDensity === 'grid-storyboard' ? 'GRID STORYBOARD' : viewDensity.toUpperCase()})`
                }
              >
                <Menu className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Player View Control Rail */}
            {/* Left Section (No search bar in player view) */}
            <div className="flex items-center gap-4">
              {/* Group of 3 buttons */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowUpload(true)} 
                  className="flex items-center justify-center w-8 h-8 bg-emerald-950/20 hover:bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 hover:border-emerald-500/30 rounded-lg transition-all text-xs font-bold cursor-pointer"
                  title="Import Frames: Drag & drop or choose images"
                >
                  <FolderPlus className="w-4 h-4 text-emerald-400" />
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setShowAddBlankDropdown(!showAddBlankDropdown)} 
                    className="flex items-center justify-center w-8 h-8 bg-emerald-950/20 hover:bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 hover:border-emerald-500/30 rounded-lg transition-all text-xs font-bold cursor-pointer"
                    title="Add Blank Frame: Create canvas with color or gradient"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                  </button>
                  {showAddBlankDropdown && (
                    <div className="absolute left-0 mt-1.5 w-56 bg-[#0E0E11] bg-theme-panel border border-neutral-800 border-theme rounded-xl p-2 shadow-2xl z-40 animate-fade-in">
                      <p className="text-[10px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider px-2 py-1">Canvas Presets</p>
                      <div className="grid grid-cols-2 gap-1 p-1">
                        <button onClick={() => { handleAddBlankFrame('#000000'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-black hover:opacity-90 text-white rounded text-[10px] font-bold border border-neutral-800 border-theme text-left">Solid Black</button>
                        <button onClick={() => { handleAddBlankFrame('#ffffff'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-white hover:opacity-90 text-black rounded text-[10px] font-bold border border-neutral-200 border-theme text-left">Solid White</button>
                        <button onClick={() => { handleAddBlankFrame('#1a1a1c'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-neutral-900 bg-theme-badge hover:opacity-90 text-neutral-300 text-theme-primary rounded text-[10px] font-bold border border-neutral-800 border-theme text-left">Cinematic Gray</button>
                        <button onClick={() => { handleAddBlankFrame('#1e293b'); setShowAddBlankDropdown(false); }} className="px-2 py-1.5 bg-slate-800 hover:opacity-90 text-slate-300 rounded text-[10px] font-bold border border-slate-700 border-theme text-left">Slate Blue</button>
                      </div>
                      <div className="h-px bg-neutral-800 border-theme my-1.5" />
                      <p className="text-[10px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider px-2 py-1">Gradient Backdrops</p>
                      <div className="space-y-1 p-1 max-h-[140px] overflow-y-auto">
                        {GRADIENT_PRESETS.map((grad, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => { handleAddBlankFrame(grad); setShowAddBlankDropdown(false); }}
                            className="w-full h-6 rounded border border-neutral-800 border-theme hover:scale-[1.02] transition-transform"
                            style={{ background: grad }}
                            title="Select gradient"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleAutoNumber} 
                  disabled={slides.length === 0}
                  className="flex items-center justify-center w-8 h-8 bg-emerald-950/20 hover:bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 hover:border-emerald-500/30 rounded-lg transition-all text-xs font-bold cursor-pointer disabled:opacity-40"
                  title="Auto-Number: Sequentially re-number Scene/Shot"
                >
                  <div className="flex items-center justify-center w-[18px] h-[18px] rounded-full border border-emerald-400/90 text-[10px] font-black leading-none select-none text-emerald-400">
                    1
                  </div>
                </button>
              </div>

              {/* Vertical Separator */}
              <div className="h-5 w-px bg-neutral-800 border-theme" />

              {/* Layout Pill Capsule (Only Grid and List switcher in player view) */}
              <div className="flex bg-emerald-950/10 p-0.5 rounded-lg border border-emerald-900/40 border-theme">
                <button 
                  onClick={() => setActiveLayout(activeLayout === 'grid' ? 'spreadsheet' : 'grid')} 
                  className="flex items-center justify-center w-8 h-8 rounded-md text-emerald-400 hover:bg-emerald-950/35 transition-all cursor-pointer"
                  title={activeLayout === 'grid' ? "Switch to List Sequencer" : "Switch to Grid Storyboard"}
                >
                  {activeLayout === 'grid' ? (
                    <Layout className="w-4 h-4" />
                  ) : (
                    <List className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Center Transport Controls */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#141417]/80 p-1 rounded-xl border border-neutral-850">
              <button
                onClick={() => {
                  setCurrentSlideIndex(0);
                  setIsPlaying(false);
                }}
                className="p-1.5 bg-transparent hover:bg-emerald-950/40 text-neutral-400 hover:text-emerald-400 rounded-md transition-all cursor-pointer flex items-center justify-center"
                title="Reset sequence playhead"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  if (currentSlideIndex > 0) setCurrentSlideIndex(prev => prev - 1);
                }}
                disabled={currentSlideIndex === 0}
                className="p-1.5 bg-transparent hover:bg-emerald-950/40 text-neutral-400 hover:text-emerald-400 rounded-md transition-all disabled:opacity-20 cursor-pointer flex items-center justify-center"
                title="Previous Frame"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setIsPlaying(!isPlaying);
                  if (!isPlaying && enableBeeps) {
                    triggerAudioBeep(440, 'sine', 0.15);
                  }
                }}
                className="w-7 h-7 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.3)] border border-emerald-500/30 shrink-0"
                title={isPlaying ? "Pause playback" : "Start playback"}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 text-white fill-white" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                )}
              </button>

              <button
                onClick={() => {
                  if (currentSlideIndex < slides.length - 1) setCurrentSlideIndex(prev => prev + 1);
                }}
                disabled={currentSlideIndex === slides.length - 1}
                className="p-1.5 bg-transparent hover:bg-emerald-950/40 text-neutral-400 hover:text-emerald-400 rounded-md transition-all disabled:opacity-20 cursor-pointer flex items-center justify-center"
                title="Next Frame"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsLooping(!isLooping)}
                className={cn(
                  "p-1.5 rounded-md transition-all border border-transparent cursor-pointer flex items-center justify-center",
                  isLooping 
                    ? "bg-emerald-600/20 text-emerald-400" 
                    : "text-neutral-500 hover:bg-emerald-950/40 hover:text-emerald-400"
                )}
                title="Toggle auto-loop sequence"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setVoiceoverEnabled(!voiceoverEnabled);
                  if (enableBeeps) triggerAudioBeep(480, 'sine', 0.05);
                }}
                className={cn(
                  "p-1.5 rounded-md transition-all border border-transparent cursor-pointer flex items-center justify-center",
                  voiceoverEnabled 
                    ? "bg-indigo-600/20 text-indigo-400" 
                    : "text-neutral-500 hover:bg-indigo-950/40 hover:text-indigo-400"
                )}
                title="Toggle Speech-Synthesis Voiceover"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              <button 
                onClick={() => setEnableBeeps(!enableBeeps)} 
                className="p-1.5 rounded-md text-neutral-500 hover:text-emerald-400 transition-all cursor-pointer"
                title={enableBeeps ? "Transition sound enabled" : "Transition sound muted"}
              >
                {enableBeeps ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-3">
              {/* Timing Mode Control (Duration vs FPS) */}
              <div className="flex items-center gap-1.5 bg-[#0C0C0E] bg-theme-panel px-2.5 py-1.5 rounded-lg border border-neutral-800 border-theme">
                <span className="text-[9px] text-neutral-500 font-bold uppercase select-none">Timing:</span>
                <select
                  value={playbackTimingMode}
                  onChange={(e) => {
                    setPlaybackTimingMode(e.target.value as 'duration' | 'fps');
                    if (enableBeeps) triggerAudioBeep(480, 'sine', 0.05);
                  }}
                  className="bg-[#0C0C0E] bg-theme-panel text-neutral-300 outline-none text-[10px] font-bold cursor-pointer font-sans focus:text-emerald-400 transition-colors border-0"
                >
                  <option value="duration" className="bg-[#0C0C0E] text-neutral-300">Slide Durations</option>
                  <option value="fps" className="bg-[#0C0C0E] text-neutral-300">Constant FPS</option>
                </select>

                {playbackTimingMode === 'fps' && (
                  <div className="flex items-center gap-1 border-l border-neutral-800 pl-2 ml-1 animate-fade-in">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      step="1"
                      value={playbackFps}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
                        setPlaybackFps(val);
                      }}
                      className="w-10 bg-[#121215] border border-neutral-800 text-neutral-300 text-xs font-mono font-bold text-center rounded px-1 py-0.5 outline-none focus:border-indigo-500/50"
                      title="Frames per second"
                    />
                    <span className="text-[9px] text-neutral-500 font-bold uppercase select-none">FPS</span>
                  </div>
                )}
              </div>

              {/* Transition Selector Dropdown */}
              <div className="flex items-center gap-1.5 bg-[#0C0C0E] bg-theme-panel px-2 py-1.5 rounded-lg border border-neutral-800 border-theme">
                <select
                  value={transitionStyle}
                  onChange={(e) => {
                    setTransitionStyle(e.target.value as TransitionStyle);
                    if (enableBeeps) triggerAudioBeep(480, 'sine', 0.05);
                  }}
                  className="bg-[#0C0C0E] bg-theme-panel text-neutral-300 outline-none text-[10px] font-bold cursor-pointer font-sans focus:text-emerald-400 transition-colors border-0"
                >
                  <option value="none" className="bg-[#0C0C0E] text-neutral-300">Cut (None)</option>
                  <option value="fade" className="bg-[#0C0C0E] text-neutral-300">Cross-Fade</option>
                  <option value="wipe" className="bg-[#0C0C0E] text-neutral-300">Slide-In</option>
                  <option value="zoom" className="bg-[#0C0C0E] text-neutral-300">Zoom Dissolve</option>
                  <option value="slideUp" className="bg-[#0C0C0E] text-neutral-300">Vertical Slide</option>
                  <option value="blur" className="bg-[#0C0C0E] text-neutral-300">Defocus Blur</option>
                </select>
              </div>

              {/* Slider Toggle and slider itself */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableTransitionSpeed}
                  onChange={(e) => {
                    setEnableTransitionSpeed(e.target.checked);
                    if (enableBeeps) triggerAudioBeep(480, 'sine', 0.05);
                  }}
                  className="rounded border-neutral-700 bg-neutral-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                  title="Toggle transition speed adjustment"
                />
                {enableTransitionSpeed && (
                  <div className="flex items-center gap-1.5 bg-[#141417]/80 px-2 py-1 rounded-lg border border-neutral-850 animate-fade-in">
                    <span className="text-[9px] text-neutral-500 font-bold uppercase select-none">SPEED:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="4.0"
                      step="0.1"
                      value={transitionDuration}
                      onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                      className="w-16 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] text-neutral-400 font-mono font-bold w-10 text-right">
                      {transitionDuration.toFixed(1)}s
                    </span>
                  </div>
                )}
              </div>

              {/* Frame Counter Badge */}
              <div className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/25 px-2.5 py-1.5 rounded-md border border-emerald-500/20 shadow-[0_0_6px_rgba(16,185,129,0.05)]">
                <span className="text-emerald-500/80">Frame</span>
                <span className="text-emerald-400 font-extrabold">{slides.length > 0 ? currentSlideIndex + 1 : 0}</span>
                <span className="text-emerald-600">/</span>
                <span className="text-emerald-400">{slides.length}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Container */}
      <div className={cn(
        "flex-1 overflow-hidden relative flex",
        (showScriptEditor && viewDensity === 'strip') ? "flex-row-reverse" : "flex-row"
      )}>
        {slides.length === 0 ? (
          <div className="flex-1 h-full flex flex-col md:flex-row items-center justify-center p-8 gap-8 max-w-5xl mx-auto w-full select-none animate-fade-in">
            {/* Left Panel: Sequencer Setup */}
            <div className="flex-1 bg-[#0E0E11]/80 bg-theme-panel border border-neutral-800/80 border-theme p-6 rounded-2xl flex flex-col items-center text-center shadow-xl max-w-sm">
              <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Film className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-sm font-black text-white text-theme-heading uppercase tracking-wider">Cinematic Sequencer</h3>
              <p className="text-[11px] text-neutral-400 text-theme-muted mt-2 leading-relaxed">
                Load sequence frames from folders or files, or append fresh blank backdrops to start writing screenplay directions directly inside the suite.
              </p>
              <div className="flex flex-col gap-2 w-full mt-5">
                <button 
                  onClick={() => setShowUpload(true)} 
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  Import Sequence Frames
                </button>
                <button 
                  onClick={() => handleAddBlankFrame('#1a1a1c')} 
                  className="w-full px-4 py-2.5 bg-neutral-900 bg-theme-badge hover:bg-neutral-850 text-neutral-300 text-theme-primary rounded-xl text-xs font-bold transition-all border border-neutral-800 border-theme cursor-pointer"
                >
                  Create Blank Cinematic Canvas
                </button>
              </div>
            </div>

            {/* Right Panel: Filmmaker's Toolbox with Image Studio */}
            <div className="flex-1 bg-[#0E0E11]/80 bg-theme-panel border border-neutral-800/80 border-theme p-6 rounded-2xl flex flex-col items-center text-center shadow-xl max-w-sm">
              <div className="w-14 h-14 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Wrench className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-sm font-black text-white text-theme-heading uppercase tracking-wider">Creative Toolbox</h3>
              <p className="text-[11px] text-neutral-400 text-theme-muted mt-2 leading-relaxed">
                Access advanced generative art pipelines. Craft beautiful visuals, upscale framing to 4K resolution, or generate movement sequences from a single shot.
              </p>
              
              <div className="w-full h-px bg-neutral-800/60 my-4 border-theme" />
              
              {/* Tool Option: Image Studio */}
              <button 
                onClick={() => {
                  setImageStudioTab('enhance');
                  setShowImageStudio(true);
                }}
                className="w-full group p-3 bg-neutral-900/60 hover:bg-emerald-950/20 border border-neutral-800 hover:border-emerald-500/30 rounded-xl transition-all flex items-center gap-3 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-wide">Image Studio AI</h4>
                  <p className="text-[10px] text-neutral-500 text-theme-muted mt-0.5 leading-snug truncate">Upscale, text-to-image, and sequence generators</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Left Workspace */}
            <div className={cn(
              "h-full overflow-hidden flex flex-col relative",
              (showScriptEditor && viewDensity === 'full') ? "hidden" : "flex-1",
              (showScriptEditor && viewDensity === 'compact') ? "w-1/2 flex-none" : "",
              (showScriptEditor && viewDensity === 'strip') ? "w-1/2 flex-none" : ""
            )}>
              <div className="h-full overflow-y-auto">
            {activeLayout === 'grid' && (
              <div className={cn(
                "p-6 grid gap-6",
                viewDensity === 'full' && "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
                viewDensity === 'compact' && "grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4",
                viewDensity === 'strip' && "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3",
                viewDensity === 'icon' && "grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2",
                viewDensity === 'grid-storyboard' && "grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5"
              )}>
                {filteredSlides.map((slide, index) => {
                  const globalIndex = slides.findIndex(s => s.id === slide.id);
                  return (
                    <div 
                      key={slide.id} 
                      className={cn(
                        "bg-[#0C0C0E] bg-theme-panel border border-neutral-800/80 border-theme rounded-xl overflow-hidden shadow-xl flex flex-col group transition-all text-theme-primary cursor-pointer",
                        activeSlideId === slide.id ? "ring-2 ring-indigo-500 border-indigo-500/50" : ""
                      )}
                      onClick={() => handleSelectSlide(slide.id)}
                      onDoubleClick={() => handleEditFrame(slide.imageUrl, globalIndex)}
                    >
                      {/* Image Frame Canvas container */}
                      <div className="relative bg-black select-none overflow-hidden group/frame flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                        <img 
                          src={slide.imageUrl} 
                          alt={`Scene ${slide.sceneNo}`} 
                          className={cn("w-full h-full", slide.fitMode === 'cover' ? "object-cover" : "object-contain")}
                        />
                        
                        {/* Overlay Labels */}
                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-neutral-800/60 rounded px-2 py-0.5 text-[10px] font-mono font-black text-neutral-300 flex items-center gap-1.5">
                          <span className="text-white">Scene {slide.sceneNo}</span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-indigo-400">Shot {slide.shotNo}</span>
                        </div>
                      </div>

                      {/* Control Panel / Parameters */}
                      {viewDensity !== 'icon' && (
                        <div className="p-3 flex-1 flex flex-col gap-3 border-t border-neutral-900 border-theme bg-[#0E0E11]/60 bg-theme-panel/60 text-theme-primary" onClick={(e) => e.stopPropagation()}>
                          {viewDensity === 'grid-storyboard' ? (
                            <div className="flex-1 flex flex-col justify-between h-full space-y-2">
                              <div>
                                <p className="text-[10px] text-neutral-400 font-mono font-bold uppercase">
                                  {slide.shotType || 'MS'} • {((slide.duration || 3000) / 1000).toFixed(1)}s
                                </p>
                                <p className="text-xs text-neutral-200 mt-1 line-clamp-2 font-medium leading-normal">
                                  {slide.action || <span className="text-neutral-600 italic">No visual direction</span>}
                                </p>
                                {slide.dialogue && (
                                  <p className="text-[11px] text-indigo-400 italic font-medium mt-1.5 line-clamp-2">
                                    "{slide.dialogue}"
                                  </p>
                                )}
                                {slide.notes && (
                                  <p className="text-[10px] text-neutral-500 italic mt-1 line-clamp-1">
                                    Notes: {slide.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-between border-t border-neutral-800/45 pt-1.5 mt-auto">
                                <span className="text-[9px] text-neutral-500 font-mono">
                                  Panel #{globalIndex + 1}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button 
                                    onClick={() => handleEditGridFrame(slide.imageUrl, globalIndex)}
                                    className="p-1 text-purple-400 hover:text-purple-350 transition-colors cursor-pointer bg-transparent"
                                    title="Grid Edit"
                                  >
                                    <LayoutGrid className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (re) => {
                                            handleUpdateSlideField(globalIndex, 'imageUrl', re.target?.result as string);
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      };
                                      input.click();
                                    }}
                                    className="p-1 text-red-500 hover:text-red-450 transition-colors cursor-pointer bg-transparent"
                                    title="Replace File"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newSlides = slides.filter((_, i) => i !== globalIndex);
                                      setSlides(newSlides);
                                      saveToFirebase(newSlides, folderName);
                                    }}
                                    className="p-1 text-neutral-500 hover:text-rose-400 rounded transition-all shrink-0 cursor-pointer"
                                    title="Delete sequence frame"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : viewDensity === 'strip' ? (
                            <div className="flex-1 flex flex-col justify-between h-full">
                              <p className="text-[10px] text-neutral-400 font-mono font-bold uppercase truncate">
                                {slide.shotType || 'MS'} • {((slide.duration || 3000) / 1000).toFixed(1)}s
                              </p>
                              <p className="text-[10px] text-neutral-300 truncate mt-1">
                                {slide.action || <span className="text-neutral-600 italic">No visual direction</span>}
                              </p>
                              <div className="flex items-center justify-between border-t border-neutral-800/40 pt-1.5 mt-2">
                                <span className="text-[9px] text-indigo-400 font-bold truncate max-w-[80px]">
                                  {slide.dialogue ? `"${slide.dialogue}"` : ''}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {showVectorEditOnPanels && (
                                    <button 
                                      onClick={() => handleEditFrame(slide.imageUrl, globalIndex)}
                                      className="p-1 text-violet-450 hover:text-violet-350 transition-colors cursor-pointer bg-transparent"
                                      title="Vector Edit"
                                    >
                                      <Palette className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleEditGridFrame(slide.imageUrl, globalIndex)}
                                    className="p-1 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer bg-transparent"
                                    title="Grid Edit"
                                  >
                                    <LayoutGrid className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (re) => {
                                            handleUpdateSlideField(globalIndex, 'imageUrl', re.target?.result as string);
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      };
                                      input.click();
                                    }}
                                    className="p-1 text-red-500 hover:text-red-450 transition-colors cursor-pointer bg-transparent"
                                    title="Replace File"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newSlides = slides.filter((_, i) => i !== globalIndex);
                                      setSlides(newSlides);
                                      saveToFirebase(newSlides, folderName);
                                    }}
                                    className="p-1 text-neutral-500 hover:text-rose-400 rounded transition-all shrink-0 cursor-pointer"
                                    title="Delete sequence frame"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1">Shot Frame Type</label>
                                  <select
                                    value={slide.shotType || 'MS'}
                                    onChange={(e) => handleUpdateSlideField(globalIndex, 'shotType', e.target.value)}
                                    className="w-full bg-[#121215] bg-theme-app border border-neutral-800 border-theme text-neutral-300 text-theme-primary rounded px-2 py-1 text-xs font-bold outline-none cursor-pointer"
                                  >
                                    {SHOT_TYPES.map(st => (
                                      <option key={st.id} value={st.id} className="bg-theme-panel">{st.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1">Duration (Sec)</label>
                                  <div className="flex items-center bg-[#121215] bg-theme-app border border-neutral-800 border-theme rounded px-2 py-0.5">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0.5"
                                      value={((slide.duration || 3000) / 1000).toFixed(1)}
                                      onChange={(e) => handleUpdateSlideField(globalIndex, 'duration', Math.max(500, parseFloat(e.target.value) * 1000))}
                                      className="w-full bg-transparent text-neutral-300 text-theme-primary text-xs font-mono font-bold border-none outline-none"
                                    />
                                    <span className="text-[10px] text-neutral-500 text-theme-muted font-mono">s</span>
                                  </div>
                                </div>
                              </div>

                              {/* Script Inputs */}
                              <div className="space-y-2">
                                <div>
                                  <span className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1">Action / Visual Direction</span>
                                  <textarea
                                    rows={viewDensity === 'compact' ? 1 : 2}
                                    value={slide.action}
                                    onChange={(e) => handleUpdateSlideField(globalIndex, 'action', e.target.value)}
                                    placeholder="Describe camera movement, physical action..."
                                    className="w-full bg-[#121215] bg-theme-app border border-neutral-800 border-theme text-neutral-300 text-theme-primary rounded p-1.5 text-xs outline-none focus:border-indigo-500/50 resize-none"
                                  />
                                </div>

                                {viewDensity === 'full' && (
                                  <>
                                    <div>
                                      <span className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1">Dialogue / Audio Cue</span>
                                      <textarea
                                        rows={1}
                                        value={slide.dialogue}
                                        onChange={(e) => handleUpdateSlideField(globalIndex, 'dialogue', e.target.value)}
                                        placeholder="Dialogue spoken or background track..."
                                        className="w-full bg-[#121215] bg-theme-app border border-neutral-800 border-theme text-indigo-200 text-theme-primary rounded p-1.5 text-xs font-medium italic outline-none focus:border-indigo-500/50 resize-none"
                                      />
                                    </div>

                                    <div>
                                      <span className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1">Director's Notes</span>
                                      <input
                                        type="text"
                                        value={slide.notes || ''}
                                        onChange={(e) => handleUpdateSlideField(globalIndex, 'notes', e.target.value)}
                                        placeholder="Lenses, lighting cues, stage directions..."
                                        className="w-full bg-[#121215] bg-theme-app border border-neutral-800 border-theme text-neutral-400 text-theme-muted rounded px-2 py-1 text-xs outline-none focus:border-indigo-500/50"
                                      />
                                    </div>

                                    <div>
                                      <span className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1">Audio Voiceover Input</span>
                                      {slide.audioUrl ? (
                                        <div className="flex items-center gap-2 bg-[#18181c] border border-neutral-800 rounded p-1.5">
                                          <Music className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                                          <audio src={slide.audioUrl} controls className="h-6 w-full max-w-[170px] outline-none text-xs" />
                                          <button
                                            onClick={() => handleUpdateSlideField(globalIndex, 'audioUrl', '')}
                                            className="p-1 text-red-400 hover:text-red-300 hover:bg-neutral-855 rounded transition-colors cursor-pointer"
                                            title="Remove audio track"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          {recordingIdx === globalIndex && isRecording ? (
                                            <button
                                              onClick={() => stopRecording()}
                                              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded border border-red-500/20 transition-all cursor-pointer shadow-md animate-pulse shrink-0"
                                            >
                                              <Pause className="w-3 h-3 fill-white" />
                                              <span>Stop ({recordingDuration}s)</span>
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => startRecording(globalIndex)}
                                              disabled={recordingIdx !== null && isRecording}
                                              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 bg-theme-badge hover:bg-neutral-850 text-neutral-300 hover:text-white text-[10px] font-bold rounded border border-neutral-800 border-theme transition-all disabled:opacity-40 cursor-pointer shrink-0"
                                              title="Record narration directly"
                                            >
                                              <Mic className="w-3 h-3 text-rose-500" />
                                              <span>Record Voice</span>
                                            </button>
                                          )}

                                          <button
                                            onClick={() => {
                                              const input = document.createElement('input');
                                              input.type = 'file';
                                              input.accept = 'audio/*';
                                              input.onchange = (e) => {
                                                const file = (e.target as HTMLInputElement).files?.[0];
                                                if (file) {
                                                  const reader = new FileReader();
                                                  reader.onload = (re) => {
                                                    handleUpdateSlideField(globalIndex, 'audioUrl', re.target?.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              };
                                              input.click();
                                            }}
                                            disabled={recordingIdx === globalIndex && isRecording}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 bg-theme-badge hover:bg-neutral-850 text-neutral-300 hover:text-white text-[10px] font-bold rounded border border-neutral-800 border-theme transition-all disabled:opacity-40 cursor-pointer shrink-0"
                                            title="Upload existing audio file"
                                          >
                                            <Upload className="w-3 h-3 text-indigo-400" />
                                            <span>Upload Audio</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Deck Control buttons */}
                              <div className="flex items-center justify-between border-t border-neutral-800/40 pt-2.5 mt-1">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleMoveSlide(globalIndex, 'left')}
                                    disabled={globalIndex === 0}
                                    className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-20 transition-all cursor-pointer"
                                    title="Move sequence left"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveSlide(globalIndex, 'right')}
                                    disabled={globalIndex === slides.length - 1}
                                    className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-20 transition-all cursor-pointer"
                                    title="Move sequence right"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateSlide(globalIndex)}
                                    className="p-1.5 text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800 rounded transition-all cursor-pointer"
                                    title="Duplicate frame"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setZoomVariationsSource(slide);
                                      setZoomRatios([1.2, 1.8, 2.5]);
                                      setZoomPanOffsets([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
                                    }}
                                    className="p-1.5 text-neutral-500 hover:text-indigo-400 hover:bg-neutral-800 rounded transition-all cursor-pointer"
                                    title="Create 3 Zoom Variations"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1">
                                  {showVectorEditOnPanels && (
                                    <button 
                                      onClick={() => handleEditFrame(slide.imageUrl, globalIndex)}
                                      className="p-1.5 text-violet-450 hover:text-violet-350 transition-colors cursor-pointer bg-transparent"
                                      title="Vector Edit"
                                    >
                                      <Palette className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleEditGridFrame(slide.imageUrl, globalIndex)}
                                    className="p-1.5 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer bg-transparent"
                                    title="Grid Edit"
                                  >
                                    <LayoutGrid className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (re) => {
                                            handleUpdateSlideField(globalIndex, 'imageUrl', re.target?.result as string);
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      };
                                      input.click();
                                    }}
                                    className="p-1.5 text-red-500 hover:text-red-450 transition-colors cursor-pointer bg-transparent"
                                    title="Replace File"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newSlides = slides.filter((_, i) => i !== globalIndex);
                                      setSlides(newSlides);
                                      saveToFirebase(newSlides, folderName);
                                    }}
                                    className="p-1 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded transition-all cursor-pointer"
                                    title="Delete sequence frame"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Assignment Color Band */}
                      {viewDensity !== 'icon' && (
                        <div className="px-3 py-1.5 border-t border-neutral-900/60 bg-[#0C0C0E]/40 flex items-center justify-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {COLOR_LABELS.map((label) => (
                              <button
                                key={label.id}
                                onClick={() => handleUpdateSlideField(globalIndex, 'colorLabel', label.id)}
                                className={cn(
                                  "w-3 h-3 rounded-full hover:scale-125 transition-transform cursor-pointer border border-black/40",
                                  slide.colorLabel === label.id ? "ring-1 ring-white ring-offset-1 ring-offset-black" : "opacity-60 hover:opacity-100"
                                )}
                                style={{ backgroundColor: label.color === 'transparent' ? '#374151' : label.color }}
                                title={label.label}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {slide.colorLabel && slide.colorLabel !== 'none' && (
                        <div 
                          className="h-1.5 w-full shrink-0 mt-auto" 
                          style={{ backgroundColor: COLOR_LABELS.find(cl => cl.id === slide.colorLabel)?.color }} 
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeLayout === 'spreadsheet' && (
              <div className="p-6">
                {/* Batch Action bar when items are selected */}
                {selectedSlideIds.length > 0 && (
                  <div className="mb-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-xs font-black text-indigo-200 uppercase tracking-wider">
                        {selectedSlideIds.length} of {slides.length} Selected
                      </span>
                      <button 
                        onClick={() => setSelectedSlideIds([])}
                        className="text-[10px] text-indigo-400 hover:text-indigo-200 underline font-extrabold"
                      >
                        Deselect All
                      </button>
                    </div>

                    <div className="flex items-center flex-wrap gap-4 text-xs font-medium">
                      {/* Batch Operations */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDuplicateSelected}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#121215] border border-neutral-800 hover:border-neutral-700 hover:text-white text-neutral-300 rounded-lg transition-colors font-bold cursor-pointer"
                          title="Duplicate all selected slides"
                        >
                          <Copy className="w-3 h-3 text-neutral-400" /> Duplicate
                        </button>
                        <button
                          onClick={handleDeleteSelected}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/20 border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400 rounded-lg transition-colors font-bold cursor-pointer"
                          title="Delete all selected slides"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" /> Delete
                        </button>
                      </div>

                      <div className="h-5 w-px bg-neutral-800" />

                      {/* Fit Screen (Contain / Cover) */}
                      {(() => {
                        const selectedSlides = slides.filter(s => selectedSlideIds.includes(s.id));
                        const firstSelectedFit = selectedSlides.length > 0 ? (selectedSlides[0].fitMode || 'contain') : 'contain';
                        return (
                          <div className="flex items-center gap-1.5 bg-[#121215] px-2 py-1 rounded-lg border border-neutral-800">
                            <span className="text-[10px] text-neutral-500 font-bold uppercase mr-1">Fit Screen:</span>
                            <button
                              onClick={() => handleBatchUpdateField('fitMode', 'contain')}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer",
                                firstSelectedFit === 'contain'
                                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md hover:bg-indigo-500"
                                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800"
                              )}
                              title="Fit entire image on screen with letterboxing"
                            >
                              Contain
                            </button>
                            <button
                              onClick={() => handleBatchUpdateField('fitMode', 'cover')}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer",
                                firstSelectedFit === 'cover'
                                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md hover:bg-indigo-500"
                                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800"
                              )}
                              title="Zoom to fill entire screen (no bars)"
                            >
                              Cover (Full)
                            </button>
                          </div>
                        );
                      })()}

                      <div className="h-5 w-px bg-neutral-800" />

                      {/* Batch Change Properties */}
                      <div className="flex items-center gap-3">
                        {/* Batch Duration */}
                        <div className="flex items-center gap-1.5 bg-[#121215] px-2 py-1 rounded-lg border border-neutral-800">
                          <span className="text-[10px] text-neutral-500 font-bold uppercase">Duration:</span>
                          <select
                            onChange={(e) => handleBatchUpdateField('duration', parseFloat(e.target.value) * 1000)}
                            defaultValue=""
                            className="bg-transparent text-neutral-300 outline-none text-[11px] font-bold cursor-pointer"
                          >
                            <option value="" disabled className="bg-[#0C0C0E]">Change...</option>
                            <option value="0.5" className="bg-[#0C0C0E]">0.5s</option>
                            <option value="1" className="bg-[#0C0C0E]">1.0s</option>
                            <option value="2" className="bg-[#0C0C0E]">2.0s</option>
                            <option value="3" className="bg-[#0C0C0E]">3.0s</option>
                            <option value="4" className="bg-[#0C0C0E]">4.0s</option>
                            <option value="5" className="bg-[#0C0C0E]">5.0s</option>
                            <option value="8" className="bg-[#0C0C0E]">8.0s</option>
                          </select>
                        </div>

                        {/* Batch Shot Type */}
                        <div className="flex items-center gap-1.5 bg-[#121215] px-2 py-1 rounded-lg border border-neutral-800">
                          <span className="text-[10px] text-neutral-500 font-bold uppercase">Shot:</span>
                          <select
                            onChange={(e) => handleBatchUpdateField('shotType', e.target.value)}
                            defaultValue=""
                            className="bg-transparent text-neutral-300 outline-none text-[11px] font-bold cursor-pointer"
                          >
                            <option value="" disabled className="bg-[#0C0C0E]">Change...</option>
                            {SHOT_TYPES.map(st => (
                              <option key={st.id} value={st.id} className="bg-[#0C0C0E]">{st.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Batch Color Labels */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-neutral-500 font-bold uppercase mr-1">Label:</span>
                          {COLOR_LABELS.map(cl => (
                            <button
                              key={cl.id}
                              onClick={() => handleBatchUpdateField('colorLabel', cl.id)}
                              className="w-3.5 h-3.5 rounded-full border border-black/40 hover:scale-110 transition-transform relative cursor-pointer"
                              style={{ backgroundColor: cl.color === 'transparent' ? '#374151' : cl.color }}
                              title={`Label all selected as ${cl.label}`}
                            />
                          ))}
                        </div>

                        <div className="h-5 w-px bg-neutral-800" />

                        {/* Batch Rename Feature */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowBatchRenameUI(!showBatchRenameUI)}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1.5 bg-[#121215] border hover:text-white rounded-lg transition-all text-xs font-bold cursor-pointer",
                              showBatchRenameUI 
                                ? "border-indigo-500 text-indigo-200 bg-indigo-900/30" 
                                : "border-neutral-800 hover:border-neutral-700 text-neutral-300"
                            )}
                            title="Batch rename scenes or shots sequentially starting from a base number"
                          >
                            <Hash className="w-3 h-3 text-indigo-400" /> Batch Rename
                          </button>

                          {showBatchRenameUI && (
                            <div className="flex items-center gap-1.5 bg-[#121215] border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs shadow-inner animate-in fade-in slide-in-from-right-1 duration-150">
                              <select
                                value={batchRenameTarget}
                                onChange={(e) => setBatchRenameTarget(e.target.value as 'sceneNo' | 'shotNo')}
                                className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 text-[11px] font-bold cursor-pointer focus:border-indigo-500 outline-none"
                              >
                                <option value="sceneNo">Scenes</option>
                                <option value="shotNo">Shots</option>
                              </select>
                              <span className="text-[10px] text-neutral-500 font-bold uppercase">From:</span>
                              <input
                                type="number"
                                min="1"
                                value={batchRenameBase}
                                onChange={(e) => setBatchRenameBase(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-neutral-200 text-[11px] text-center font-bold focus:border-indigo-500 outline-none"
                              />
                              <button
                                onClick={() => {
                                  handleBatchSequentialRename(batchRenameTarget, batchRenameBase);
                                  setShowBatchRenameUI(false);
                                }}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Apply
                              </button>
                              <button
                                onClick={() => setShowBatchRenameUI(false)}
                                className="px-1.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 rounded text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border border-neutral-800 border-theme rounded-xl overflow-hidden bg-[#0C0C0E] bg-theme-panel">
                  <table className="w-full border-collapse text-left text-xs text-theme-primary">
                    <thead>
                      <tr className="bg-neutral-900 bg-theme-badge border-b border-neutral-800 border-theme text-neutral-400 text-theme-muted font-extrabold select-none">
                        <th className="px-2 py-3 w-8 text-center">Grip</th>
                        <th className="px-3 py-3 w-10">
                          <input 
                            type="checkbox" 
                            checked={filteredSlides.length > 0 && filteredSlides.every(s => selectedSlideIds.includes(s.id))} 
                            onChange={handleToggleSelectAll}
                            className="rounded border-neutral-700 bg-neutral-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                          />
                        </th>
                        <th className="px-4 py-3 w-14">No</th>
                        <th className="px-4 py-3 w-28">Preview</th>
                        <th className="px-4 py-3 w-32">Scene & Shot</th>
                        {viewDensity !== 'strip' && viewDensity !== 'icon' && (
                          <>
                            <th className="px-4 py-3 w-32">Shot Type</th>
                            <th className="px-4 py-3 w-28">Duration</th>
                            <th className="px-4 py-3 w-28">Fit Mode</th>
                            <th className="px-4 py-3 w-36">Color Label</th>
                          </>
                        )}
                        {viewDensity !== 'icon' && (
                          <th className="px-4 py-3">Visual Action & Cues</th>
                        )}
                        <th className="px-4 py-3 w-20 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {filteredSlides.map((slide, index) => {
                        const globalIndex = slides.findIndex(s => s.id === slide.id);
                        const isSelected = selectedSlideIds.includes(slide.id);
                        const isDragged = draggedIndex === globalIndex;
                        const isDragTarget = dragOverIndex === globalIndex;

                        const rowPadding = cn(
                          viewDensity === 'compact' && "px-3 py-1.5",
                          viewDensity === 'strip' && "px-3 py-2",
                          viewDensity === 'icon' && "px-2 py-1",
                          viewDensity === 'full' && "px-4 py-3"
                        );

                        return (
                          <tr 
                            key={slide.id} 
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, globalIndex)}
                            onDragOver={(e) => handleDragOver(e, globalIndex)}
                            onDrop={(e) => handleDrop(e, globalIndex)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "transition-all border-b border-neutral-900/60 border-theme cursor-pointer",
                              isSelected ? "bg-indigo-600/10 hover:bg-indigo-600/15 text-theme-primary" : "hover:bg-neutral-900/40 bg-[#0C0C0E] bg-theme-panel text-theme-primary",
                              activeSlideId === slide.id ? "ring-2 ring-indigo-500/85 bg-indigo-950/10" : "",
                              isDragged ? "opacity-35 border-2 border-dashed border-indigo-500" : "",
                              isDragTarget ? "border-t-4 border-t-indigo-500 bg-indigo-500/5" : ""
                            )}
                            onClick={() => handleSelectSlide(slide.id)}
                            onDoubleClick={() => handleEditFrame(slide.imageUrl, globalIndex)}
                          >
                            {/* Drag Grip Handle */}
                            <td className={cn(rowPadding, "text-center cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 transition-colors")} onClick={(e) => e.stopPropagation()}>
                              <GripVertical className="w-4 h-4 mx-auto" />
                            </td>

                            {/* Select Checkbox */}
                            <td className={rowPadding} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleToggleSelectSlide(slide.id, e.nativeEvent)}
                                className="rounded border-neutral-700 bg-neutral-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                              />
                            </td>

                            <td className={cn(rowPadding, "font-mono text-neutral-500 font-bold")}>{globalIndex + 1}</td>
                                                  <td className={rowPadding}>
                              <div 
                                className={cn(
                                  "aspect-video rounded bg-black overflow-hidden relative border border-neutral-800 hover:scale-105 transition-transform cursor-pointer group/thumb",
                                  (viewDensity === 'compact' || viewDensity === 'strip' || viewDensity === 'icon') ? "w-14" : "w-20"
                                )}
                              >
                                <img 
                                  src={slide.imageUrl} 
                                  alt="" 
                                  className={cn("w-full h-full", slide.fitMode === 'cover' ? "object-cover" : "object-contain")} 
                                />
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/thumb:opacity-100 flex flex-col gap-1 items-center justify-center transition-opacity z-10">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEditFrame(slide.imageUrl, globalIndex); }}
                                    className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[8px] font-bold rounded cursor-pointer leading-tight"
                                  >
                                    Vector
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEditGridFrame(slide.imageUrl, globalIndex); }}
                                    className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[8px] font-bold rounded cursor-pointer leading-tight"
                                  >
                                    Grid
                                  </button>
                                </div>
                              </div>
                            </td>
                            
                            <td className={rowPadding} onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  value={slide.sceneNo}
                                  onChange={(e) => handleUpdateSlideField(globalIndex, 'sceneNo', parseInt(e.target.value) || 1)}
                                  className="w-11 bg-neutral-900 border border-neutral-800 rounded text-center py-0.5 font-mono text-neutral-200 focus:border-indigo-500 outline-none text-xs"
                                  title="Scene"
                                />
                                <input
                                  type="number"
                                  value={slide.shotNo}
                                  onChange={(e) => handleUpdateSlideField(globalIndex, 'shotNo', parseInt(e.target.value) || 1)}
                                  className="w-11 bg-neutral-900 border border-neutral-800 rounded text-center py-0.5 font-mono text-neutral-200 focus:border-indigo-500 outline-none text-xs"
                                  title="Shot"
                                />
                              </div>
                            </td>
                            
                            {viewDensity !== 'strip' && viewDensity !== 'icon' && (
                              <>
                                <td className={rowPadding} onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={slide.shotType || 'MS'}
                                    onChange={(e) => handleUpdateSlideField(globalIndex, 'shotType', e.target.value)}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-xs text-neutral-300 font-bold focus:border-indigo-500 outline-none cursor-pointer"
                                  >
                                    {SHOT_TYPES.map(st => (
                                      <option key={st.id} value={st.id}>{st.id}</option>
                                    ))}
                                  </select>
                                </td>
                                
                                <td className={rowPadding} onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 w-20 focus-within:border-indigo-500">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0.5"
                                      value={((slide.duration || 3000) / 1000).toFixed(1)}
                                      onChange={(e) => handleUpdateSlideField(globalIndex, 'duration', Math.max(500, parseFloat(e.target.value) * 1000))}
                                      className="w-full bg-transparent text-center text-xs font-mono font-bold outline-none text-neutral-300"
                                    />
                                    <span className="text-neutral-500 font-mono text-[10px]">s</span>
                                  </div>
                                </td>
                                
                                <td className={rowPadding} onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={slide.fitMode || 'contain'}
                                    onChange={(e) => handleUpdateSlideField(globalIndex, 'fitMode', e.target.value)}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-xs text-neutral-300 font-bold focus:border-indigo-500 outline-none cursor-pointer"
                                  >
                                    <option value="contain">Contain</option>
                                    <option value="cover">Cover</option>
                                  </select>
                                </td>
                                
                                <td className={rowPadding} onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 focus-within:border-indigo-500">
                                    <select
                                      value={slide.colorLabel || 'none'}
                                      onChange={(e) => handleUpdateSlideField(globalIndex, 'colorLabel', e.target.value)}
                                      className="bg-transparent text-neutral-300 text-xs font-bold outline-none cursor-pointer w-full"
                                    >
                                      {COLOR_LABELS.map(cl => (
                                        <option key={cl.id} value={cl.id} className="bg-[#0C0C0E]">{cl.label}</option>
                                      ))}
                                    </select>
                                    <div 
                                      className="w-3 h-3 rounded-full border border-black/30 shrink-0"
                                      style={{ backgroundColor: COLOR_LABELS.find(cl => cl.id === (slide.colorLabel || 'none'))?.color || 'transparent' }}
                                    />
                                  </div>
                                </td>
                              </>
                            )}

                            {viewDensity !== 'icon' && (
                              <td className={cn(rowPadding, "space-y-1")} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={slide.action}
                                  onChange={(e) => handleUpdateSlideField(globalIndex, 'action', e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent hover:border-neutral-800 focus:border-indigo-500 outline-none pb-0.5 text-neutral-200 font-semibold text-xs"
                                  placeholder="Visual Action..."
                                />
                                {viewDensity !== 'strip' && (
                                  <input
                                    type="text"
                                    value={slide.dialogue}
                                    onChange={(e) => handleUpdateSlideField(globalIndex, 'dialogue', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-neutral-800 focus:border-indigo-500 outline-none pb-0.5 text-indigo-300 font-medium italic text-xs"
                                    placeholder="Dialogue cue..."
                                  />
                                )}
                              </td>
                            )}

                            <td className={rowPadding} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleDuplicateSlide(globalIndex)}
                                  className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                                  title="Duplicate"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setZoomVariationsSource(slide);
                                    setZoomRatios([1.2, 1.8, 2.5]);
                                    setZoomPanOffsets([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
                                  }}
                                  className="p-1 text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                                  title="Create 3 Zoom Variations"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const newSlides = slides.filter((_, i) => i !== globalIndex);
                                    setSlides(newSlides);
                                    saveToFirebase(newSlides, folderName);
                                  }}
                                  className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeLayout === 'player' && (
              <div className="flex flex-col xl:flex-row h-full">
                {/* Large Playing Screen area */}
                <div className="flex-1 bg-black flex flex-col items-center justify-center p-6 relative">
                  {/* Aspect Ratio Box Wrapper */}
                  <div 
                    className="relative bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center max-w-full max-h-[70vh] shadow-2xl transition-all"
                    style={{ 
                      aspectRatio: selectedAspectRatio === '16:9' ? '16/9' : 
                                   selectedAspectRatio === '4:3' ? '4/3' : 
                                   selectedAspectRatio === '1:1' ? '1/1' : 
                                   selectedAspectRatio === '9:16' ? '9/16' : '2.39/1',
                      width: selectedAspectRatio === '9:16' ? '380px' : '800px'
                    }}
                  >
                    {/* Frame image transition layer */}
                    <div className="w-full h-full relative flex items-center justify-center bg-[#09090b] overflow-hidden">
                      {/* Outgoing Image (only visible during active transition style when it changes) */}
                      {isTransitioning && prevSlideImageUrl && transitionStyle !== 'none' && (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-10">
                          <img
                            src={prevSlideImageUrl}
                            alt=""
                            style={{ animationDuration: `${transitionDuration}s` }}
                            className={cn(
                              "w-full h-full",
                              prevSlideFitMode === 'cover' ? 'object-cover' : 'object-contain',
                              transitionStyle === 'fade' ? 'animate-fade-out' : '',
                              transitionStyle === 'wipe' ? 'animate-slide-out-left' : '',
                              transitionStyle === 'zoom' ? 'animate-zoom-out' : '',
                              transitionStyle === 'slideUp' ? 'animate-slide-out-top' : '',
                              transitionStyle === 'blur' ? 'animate-blur-out' : ''
                            )}
                          />
                        </div>
                      )}

                      {/* Incoming Image */}
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                        <img
                          key={currentSlideIndex}
                          src={slides[currentSlideIndex]?.imageUrl}
                          alt=""
                          style={{ animationDuration: `${transitionDuration}s` }}
                          className={cn(
                            "w-full h-full",
                            slides[currentSlideIndex]?.fitMode === 'cover' ? 'object-cover' : 'object-contain',
                            isTransitioning && transitionStyle === 'fade' ? 'animate-fade-in-fast' : '',
                            isTransitioning && transitionStyle === 'wipe' ? 'animate-slide-in-right' : '',
                            isTransitioning && transitionStyle === 'zoom' ? 'animate-zoom-in' : '',
                            isTransitioning && transitionStyle === 'slideUp' ? 'animate-slide-in-bottom' : '',
                            isTransitioning && transitionStyle === 'blur' ? 'animate-blur-in' : ''
                          )}
                        />
                      </div>
                    </div>

                    {/* Left/Right manual arrows overlay */}
                    <button
                      onClick={() => {
                        if (currentSlideIndex > 0) {
                          setCurrentSlideIndex(prev => prev - 1);
                          if (enableBeeps) triggerAudioBeep(500, 'sine', 0.05);
                        }
                      }}
                      disabled={currentSlideIndex === 0}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md hover:bg-black/90 text-neutral-300 hover:text-white rounded-full transition-colors disabled:opacity-10 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (currentSlideIndex < slides.length - 1) {
                          setCurrentSlideIndex(prev => prev + 1);
                          if (enableBeeps) triggerAudioBeep(500, 'sine', 0.05);
                        }
                      }}
                      disabled={currentSlideIndex === slides.length - 1}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md hover:bg-black/90 text-neutral-300 hover:text-white rounded-full transition-colors disabled:opacity-10 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Pre-production Caption Overlay */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-6 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-mono font-bold">
                          Scene {slides[currentSlideIndex]?.sceneNo || 1}
                        </span>
                        <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded text-[10px] font-mono font-bold">
                          Shot {slides[currentSlideIndex]?.shotNo || 1} • {slides[currentSlideIndex]?.shotType || 'MS'}
                        </span>
                        <span className="px-2 py-0.5 bg-neutral-900 text-neutral-500 rounded text-[10px] font-mono">
                          {((slides[currentSlideIndex]?.duration || 3000) / 1000).toFixed(1)}s
                        </span>
                      </div>

                      {/* Screen Script Directives */}
                      {slides[currentSlideIndex]?.action && (
                        <p className="text-white font-extrabold text-sm max-w-xl mx-auto drop-shadow-md">
                          {slides[currentSlideIndex]?.action}
                        </p>
                      )}
                      {slides[currentSlideIndex]?.dialogue && (
                        <p className="text-indigo-300 font-bold text-xs italic mt-1.5 drop-shadow-md">
                          "{slides[currentSlideIndex]?.dialogue}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vertical Timeline Filmstrip Sidebar */}
                {showFilmstrip && (
                  <div className="w-full xl:w-80 bg-[#0C0C0E] bg-theme-panel border-t xl:border-t-0 xl:border-l border-neutral-800 border-theme flex flex-col overflow-hidden shrink-0">
                    {/* Sidebar Tabs Header */}
                    <div className="p-2 border-b border-neutral-800/80 border-theme bg-neutral-900/40 bg-theme-badge flex items-center justify-between">
                      <div className="flex gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
                        <button
                          onClick={() => {
                            setSidebarTab('filmstrip');
                            if (enableBeeps) triggerAudioBeep(480, 'sine', 0.05);
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[9px] uppercase font-extrabold rounded-md transition-all cursor-pointer",
                            sidebarTab === 'filmstrip'
                              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                              : "text-neutral-500 hover:text-neutral-300 border border-transparent"
                          )}
                        >
                          Filmstrip
                        </button>
                        <button
                          onClick={() => {
                            setSidebarTab('tracks');
                            if (enableBeeps) triggerAudioBeep(480, 'sine', 0.05);
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[9px] uppercase font-extrabold rounded-md transition-all cursor-pointer flex items-center gap-1",
                            sidebarTab === 'tracks'
                              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                              : "text-neutral-500 hover:text-neutral-300 border border-transparent"
                          )}
                        >
                          Saved Cuts
                          {playbackTracks.length > 0 && (
                            <span className="bg-indigo-500 text-white text-[8px] font-mono font-bold px-1 rounded-full shrink-0">
                              {playbackTracks.length}
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="text-[9px] font-mono font-bold text-neutral-400 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                        Total: {playbackTimingMode === 'fps' ? (slides.length / playbackFps).toFixed(1) : (slides.reduce((acc, s) => acc + (s.duration || 3000), 0) / 1000).toFixed(1)}s
                      </div>
                    </div>

                    {/* Tab Body */}
                    {sidebarTab === 'tracks' ? (
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between space-y-4">
                        <div className="space-y-4">
                          {/* Live Recording and Save cut buttons */}
                          <div className="flex flex-col gap-2">
                            {isRecordingPlayback ? (
                              <button
                                onClick={handleStopRecordingPlayback}
                                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-md hover:shadow-red-900/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
                              >
                                <span className="w-2 h-2 rounded-full bg-white"></span>
                                Stop & Save Cut
                              </button>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={handleStartRecordingPlayback}
                                  className="py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg border border-indigo-500/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                                  title="Play storyboard sequence and record custom durations spent per frame"
                                >
                                  <Plus className="w-3 h-3" />
                                  Record Cut
                                </button>
                                <button
                                  onClick={handleSaveCurrentTimingsAsTrack}
                                  className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg border border-emerald-500/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                                  title="Save the current frame durations as a timing profile"
                                >
                                  <Save className="w-3 h-3" />
                                  Save Cut
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Tracks list */}
                          <div className="space-y-2">
                            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider text-left">Timing Profiles ({playbackTracks.length})</p>
                            {playbackTracks.length === 0 ? (
                              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/10">
                                <Film className="w-6 h-6 text-neutral-600 mx-auto mb-2 opacity-30" />
                                <p className="text-[10px] text-neutral-500 font-bold">No saved timing cuts.</p>
                                <p className="text-[9px] text-neutral-600 mt-1">Record a live sequence or save current spacings!</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
                                {playbackTracks.map((track) => {
                                  const totalDurationMs = (Object.values(track.timings) as number[]).reduce((sum, val) => sum + val, 0);
                                  const trackTotalSecs = (totalDurationMs / 1000).toFixed(1);
                                  
                                  // Determine if the current active frame timings match this track
                                  const isMatchingCurrent = slides.every(s => {
                                    const saved = track.timings[s.id];
                                    return saved === undefined || Math.abs(s.duration - saved) < 10;
                                  });

                                  return (
                                    <div
                                      key={track.id}
                                      onClick={() => handleLoadPlaybackTrack(track)}
                                      className={cn(
                                        "group p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between",
                                        isMatchingCurrent
                                          ? "bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_6px_rgba(16,185,129,0.05)]"
                                          : "bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/80"
                                      )}
                                    >
                                      <div className="flex-1 min-w-0 pr-1.5">
                                        <div className="flex items-center gap-1 mb-0.5">
                                          <span className={cn(
                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                            isMatchingCurrent ? "bg-emerald-400" : "bg-neutral-600 group-hover:bg-neutral-400"
                                          )}></span>
                                          <p className="text-[10px] font-bold text-neutral-200 truncate">{track.name}</p>
                                        </div>
                                        <p className="text-[8px] font-mono text-neutral-500">
                                          {new Date(track.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {Object.keys(track.timings).length} frames
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-mono font-bold text-neutral-400 bg-neutral-950 px-1 py-0.5 rounded border border-neutral-800">
                                          {trackTotalSecs}s
                                        </span>
                                        <button
                                          onClick={(e) => handleDeletePlaybackTrack(track.id, e)}
                                          className="p-0.5 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                          title="Delete cut"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-neutral-800/50 text-[8px] text-neutral-500 text-left leading-relaxed">
                          <span className="font-bold text-neutral-400">💡 Tip:</span> Click 'Record Cut' to play through and live-capture time spent per frame. Load any cut to apply its timings instantly!
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {slides.map((slide, index) => (
                          <div
                            key={slide.id}
                            onClick={() => {
                              setCurrentSlideIndex(index);
                              if (enableBeeps) triggerAudioBeep(520, 'sine', 0.05);
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-xl cursor-pointer border transition-all",
                              index === currentSlideIndex 
                                ? "bg-indigo-600/10 border-indigo-500 shadow-md ring-1 ring-indigo-500/10 scale-[1.02]" 
                                : "bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80"
                            )}
                          >
                            <div className="w-16 aspect-video rounded bg-black overflow-hidden shrink-0 border border-neutral-800/60 flex items-center justify-center">
                              <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-mono text-neutral-400 font-bold">Scene {slide.sceneNo}</span>
                                <span className="text-neutral-700">•</span>
                                <span className="text-[10px] font-mono text-neutral-500">{slide.shotType || 'MS'}</span>
                              </div>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {slide.action || <span className="text-neutral-600 italic">No instructions</span>}
                              </p>
                            </div>
                            <span className="text-[10px] font-mono text-neutral-500 font-bold shrink-0">
                              {((slide.duration || 3000) / 1000).toFixed(1)}s
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
              </div>
            </div>

            {/* Right Workspace: Screenplay Editor */}
            {showScriptEditor && (
              <div 
                className={cn(
                  "h-full border-neutral-800 border-theme bg-[#0C0C0F] bg-theme-panel flex flex-col shrink-0 transition-all duration-300",
                  scriptWriterFullScreen 
                    ? "fixed inset-0 z-[100] w-screen h-screen border-none" 
                    : viewDensity === 'full'
                      ? "flex-1 w-full border-none"
                      : viewDensity === 'compact'
                        ? "w-1/2 border-l"
                        : viewDensity === 'strip'
                          ? "w-1/2 border-r"
                          : "w-[380px] md:w-[420px] xl:w-[480px] border-l"
                )}
              >
                <ScreenplayWriter
                  slides={slides}
                  onUpdateSlides={(newSlides) => {
                    setSlides(newSlides);
                    saveToFirebase(newSlides, folderName);
                  }}
                  folderName={folderName}
                  activeSlideId={activeSlideId}
                  onSelectSlideId={(id) => {
                    setActiveSlideId(id);
                    if (id) {
                      const idx = slides.findIndex(s => s.id === id);
                      if (idx !== -1) {
                        setCurrentSlideIndex(idx);
                      }
                    }
                  }}
                  isFullScreen={scriptWriterFullScreen}
                  onToggleFullScreen={() => setScriptWriterFullScreen(!scriptWriterFullScreen)}
                  onOpenFrameEditorWithTextLayers={(index, layers) => {
                    const slide = slides[index];
                    if (slide) {
                      setEditingFrame({
                        imageUrl: slide.imageUrl,
                        index,
                        initialTextLayers: layers
                      });
                    }
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onImport={handleImport} />}
      
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wide mb-2">Clear Storyboard?</h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              Are you sure you want to clear your entire session? This will permanently delete all frames, audio recordings, and timing profiles. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-2.5 bg-[#121215] border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-bold rounded-xl cursor-pointer transition-all text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSlides([]);
                  setFolderName('My-Storyboard');
                  setPlaybackTracks([]);
                  setCurrentSlideIndex(0);
                  setActiveSlideId(null);
                  setSelectedSlideIds([]);
                  saveToFirebase([], 'My-Storyboard', []);
                  setShowClearConfirmModal(false);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer shadow-md shadow-rose-600/10 transition-all text-xs"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {editingFrame && (
        <FrameEdit 
          imageUrl={editingFrame.imageUrl} 
          width={1280} 
          height={720} 
          onClose={() => setEditingFrame(null)} 
          onSave={handleSaveEditedFrame} 
          onSaveAsNew={handleSaveAsNewFrame}
          index={editingFrame.index}
          totalFrames={slides.length}
          initialTextLayers={editingFrame.initialTextLayers}
          onNavigate={(direction, currentFrameDataUrl) => {
            const updatedSlides = slides.map((s, i) => i === editingFrame.index ? { ...s, imageUrl: currentFrameDataUrl } : s);
            setSlides(updatedSlides);
            saveToFirebase(updatedSlides, folderName);

            const targetIndex = direction === 'prev' ? editingFrame.index - 1 : editingFrame.index + 1;
            if (targetIndex >= 0 && targetIndex < updatedSlides.length) {
              const targetSlide = updatedSlides[targetIndex];
              setEditingFrame({ imageUrl: targetSlide.imageUrl, index: targetIndex });
            }
          }}
        />
      )}
      {editingGridFrame && (
        <GridEdit 
          imageUrl={editingGridFrame.imageUrl} 
          width={1280} 
          height={720} 
          onClose={() => setEditingGridFrame(null)} 
          onSave={handleSaveEditedGridFrame} 
          onSaveAsNew={handleSaveAsNewGridFrame}
          onSaveSlicesToSlides={handleSaveSlicesToSlides}
        />
      )}

      {showVideoDialog && (
        <div className="fixed inset-0 bg-neutral-950/90 z-[300] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-[#0C0C0E] bg-theme-panel border border-neutral-800 border-theme rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5 text-theme-primary">
            <div className="flex items-center justify-between border-b border-neutral-800/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white text-theme-heading">Export Storyboard to Video</h3>
                  <p className="text-[10px] text-neutral-500 text-theme-muted">Render your full storyboard sequence as a downloadable MP4 video.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  videoCancelRef.current = true;
                  setShowVideoDialog(false);
                }}
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 flex-1">
              {/* File name setting */}
              {!isExportingVideo && !videoDownloadUrl && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1.5">Video File Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={videoFileName}
                        onChange={(e) => setVideoFileName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                        placeholder="storyboard_playback"
                        className="w-full bg-neutral-900 bg-theme-panel border border-neutral-800 border-theme text-white text-theme-heading rounded-lg px-3.5 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-mono font-bold">.mp4</span>
                    </div>
                  </div>

                  {/* Subtitles Overlay Toggle */}
                  <div className="flex items-center justify-between p-3.5 bg-neutral-900/40 border border-neutral-800/80 rounded-xl">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-white">Burn-in Subtitles</span>
                      <span className="text-[10px] text-neutral-500">Overlay dialogue text track on the video output</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVideoSubtitlesEnabled(!videoSubtitlesEnabled)}
                      className={cn(
                        "w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none",
                        videoSubtitlesEnabled ? "bg-indigo-600" : "bg-neutral-800"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
                        videoSubtitlesEnabled ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>
              )}

              {/* Live Preview canvas container */}
              <div className={cn(
                "flex flex-col items-center justify-center p-3 bg-[#08080a] border border-neutral-850 rounded-xl",
                isExportingVideo ? "block" : "hidden"
              )}>
                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Live Recording Canvas Output</p>
                <div className="w-full max-w-[320px] aspect-video border border-neutral-800 rounded bg-black overflow-hidden flex items-center justify-center">
                  <canvas 
                    ref={videoCanvasRef} 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Status and progress bar */}
              {isExportingVideo && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-neutral-400 font-medium">{videoExportStatus}</span>
                    <span className="text-indigo-400 font-mono font-extrabold">{videoExportProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-100 rounded-full"
                      style={{ width: `${videoExportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Video Complete Player and Link */}
              {videoDownloadUrl && (
                <div className="space-y-3 p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl text-center">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                    <CheckSquare className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">Video Render Complete!</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">Your storyboard sequence has been successfully encoded with transitions and screenplay text overlays.</p>
                  </div>
                  
                  {/* Download Action */}
                  <a 
                    href={videoDownloadUrl}
                    download={`${videoFileName || 'storyboard_playback'}.${videoDownloadUrlExtension}`}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition-all shadow-lg shadow-emerald-600/10 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-white" />
                    <span>Download {videoDownloadUrlExtension.toUpperCase()} Video</span>
                  </a>
                </div>
              )}

              {/* Configuration metadata display */}
              {!isExportingVideo && !videoDownloadUrl && (
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3.5 text-[10px] leading-relaxed space-y-1 text-neutral-400">
                  <p className="font-bold text-neutral-300">Video Properties & Settings:</p>
                  <ul className="list-disc list-inside mt-1.5 space-y-1 font-sans font-medium text-theme-muted">
                    <li>Aspect Ratio: <strong className="text-neutral-300 font-bold">{selectedAspectRatio}</strong></li>
                    <li>Resolution: <strong className="text-neutral-300 font-bold">{selectedAspectRatio === '4:3' ? '960 x 720' : selectedAspectRatio === '1:1' ? '720 x 720' : selectedAspectRatio === '9:16' ? '720 x 1280' : '1280 x 720'}</strong></li>
                    <li>Transitions: <strong className="text-neutral-300 font-bold">{transitionStyle === 'none' ? 'Cut (None)' : transitionStyle.toUpperCase()}</strong></li>
                    <li>Sequence Duration: <strong className="text-indigo-400 font-black">{totalDurationSeconds.toFixed(1)}s</strong> ({slides.length} scenes)</li>
                    <li>Subtitles: <strong className={cn("font-bold", videoSubtitlesEnabled ? "text-indigo-400" : "text-neutral-500")}>{videoSubtitlesEnabled ? "Enabled (Burned-In)" : "Disabled"}</strong></li>
                    <li>Encoding Engine: <strong className="text-neutral-300 font-bold">MediaRecorder API</strong> (Native browser container export)</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-800/60 pt-3 shrink-0">
              {isExportingVideo ? (
                <button
                  onClick={() => {
                    videoCancelRef.current = true;
                    setIsExportingVideo(false);
                    setVideoExportStatus("Recording cancelled.");
                  }}
                  className="px-4 py-2 bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 rounded-lg text-xs font-bold transition-all cursor-pointer border border-rose-500/20"
                >
                  Cancel Export
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowVideoDialog(false);
                      setVideoDownloadUrl(null);
                    }}
                    className="px-4 py-2 bg-neutral-900 bg-theme-badge hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer border border-neutral-800"
                  >
                    {videoDownloadUrl ? "Close" : "Cancel"}
                  </button>
                  {!videoDownloadUrl && (
                    <button
                      onClick={exportVideo}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                    >
                      <Video className="w-4 h-4 text-white" />
                      <span>Start Render</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showZipDialog && (
        <div className="fixed inset-0 bg-neutral-950/90 z-[300] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-[#0C0C0E] bg-theme-panel border border-neutral-800 border-theme rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5 text-theme-primary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
                <FolderPlus className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white text-theme-heading">Export Storyboard ZIP</h3>
                <p className="text-[10px] text-neutral-500 text-theme-muted">Configure your package archive export settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-neutral-500 text-theme-muted uppercase tracking-wider block mb-1.5">Zip File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={zipFileName}
                    onChange={(e) => setZipFileName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="storyboard"
                    className="w-full bg-neutral-900 bg-theme-panel border border-neutral-800 border-theme text-white text-theme-heading rounded-lg px-3.5 py-2 text-xs font-bold outline-none focus:border-amber-500 transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-mono font-bold">.zip</span>
                </div>
              </div>

              <div className="bg-amber-600/10 border border-amber-500/20 rounded-lg p-3 text-[10px] text-neutral-400 leading-relaxed">
                <p className="font-bold text-amber-400">Included in ZIP Archive:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 font-sans font-medium text-theme-muted">
                  <li><strong className="text-neutral-300 font-bold">{slides.length}</strong> PNG storyboards numbered sequentially</li>
                  <li>Metadata <strong className="text-neutral-300 font-bold">storyboard.json</strong> index definitions</li>
                  <li>Production <strong className="text-neutral-300 font-bold">package.json</strong> dependency tree</li>
                  <li>Build <strong className="text-neutral-300 font-bold">README.md</strong> instructions</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowZipDialog(false)}
                className="px-4 py-2 bg-neutral-900 bg-theme-badge hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer border border-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={exportZip}
                disabled={isExportingZip}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-600/10"
              >
                {isExportingZip ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Zipping frames...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-white" />
                    <span>Download ZIP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomVariationsSource && (
        <div className="fixed inset-0 bg-[#0A0A0B]/95 z-[200] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md">
          <div className="bg-[#0C0C0E] border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black text-white">Create 3 Zoom Variations</h3>
                  <p className="text-[10px] text-neutral-500">Generate 3 custom cropped frame sequences with customized focal zoom depths.</p>
                </div>
              </div>
              <button 
                onClick={() => setZoomVariationsSource(null)}
                className="text-xs text-neutral-500 hover:text-white px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Content area: 3 previews side-by-side */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[0, 1, 2].map((idx) => {
                  const currentZoom = zoomRatios[idx];
                  const pan = zoomPanOffsets[idx] || { x: 0, y: 0 };
                  
                  return (
                    <div key={idx} className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                        <span className="text-[10px] font-mono text-indigo-400 font-extrabold">VARIATION {idx + 1}</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[9px] font-bold">
                          {currentZoom.toFixed(1)}x Zoom
                        </span>
                      </div>

                      {/* Realtime Zoom Visual Container */}
                      <div 
                        onPointerDown={(e) => handlePanStart(e, idx)}
                        className="aspect-video bg-black rounded-lg overflow-hidden relative border border-neutral-800 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                        title="Click and drag to pan the cropped shot"
                      >
                        <img 
                          src={zoomVariationsSource.imageUrl} 
                          alt="Zoom preview" 
                          className="absolute w-full h-full object-cover pointer-events-none transition-all duration-100 ease-out"
                          style={{
                            transform: `scale(${currentZoom})`,
                            left: `${pan.x * 100}%`,
                            top: `${pan.y * 100}%`
                          }}
                        />
                        
                        {/* Overlay helpers */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/75 px-1.5 py-0.5 rounded-full border border-neutral-800/60 text-[8px] text-neutral-400 font-bold">
                          <Move className="w-2 h-2 text-indigo-400" />
                          <span>Drag to Pan</span>
                        </div>

                        <div className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-neutral-300 border border-neutral-800/50">
                          {idx === 0 ? 'Medium Close-Up (MCU)' : idx === 1 ? 'Close-Up (CU)' : 'Extreme Close-Up (ECU)'}
                        </div>
                      </div>

                      {/* Slider Control */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-neutral-500">
                          <span>Zoom Depth</span>
                          <span className="text-white font-mono font-bold">{currentZoom.toFixed(2)}x</span>
                        </div>
                        <input 
                          type="range"
                          min="1.0"
                          max="4.0"
                          step="0.05"
                          value={currentZoom}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setZoomRatios(prev => {
                              const next = [...prev] as [number, number, number];
                              next[idx] = val;
                              return next;
                            });
                            setZoomPanOffsets(prev => {
                              const next = [...prev];
                              const maxPan = Math.max(0, (val - 1) / 2);
                              next[idx] = {
                                x: Math.max(-maxPan, Math.min(maxPan, prev[idx].x)),
                                y: Math.max(-maxPan, Math.min(maxPan, prev[idx].y))
                              };
                              return next;
                            });
                          }}
                          className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="flex justify-between text-[8px] text-neutral-600 font-mono">
                          <span>1.0x</span>
                          <span>2.5x</span>
                          <span>4.0x</span>
                        </div>

                        {/* Pan Status and Reset */}
                        {(pan.x !== 0 || pan.y !== 0) && (
                          <div className="flex items-center justify-between bg-neutral-900/60 px-2 py-1 rounded-md border border-neutral-800/50 mt-1 animate-fade-in">
                            <span className="text-[8px] text-neutral-500 font-medium font-mono">
                              X: {(pan.x * 100).toFixed(0)}% Y: {(pan.y * 100).toFixed(0)}%
                            </span>
                            <button
                              onClick={() => {
                                setZoomPanOffsets(prev => {
                                  const next = [...prev];
                                  next[idx] = { x: 0, y: 0 };
                                  return next;
                                });
                              }}
                              className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                            >
                              Reset Pan
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Guide Note */}
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 text-xs text-neutral-400 flex items-start gap-2.5">
                <span className="text-indigo-400 mt-0.5 font-bold">💡 Note:</span>
                <div>
                  <p className="font-bold text-neutral-300">Intelligent Sequence Insertion</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Creating variations will automatically generate and insert 3 high-resolution cropped frames sequentially directly after the active frame, assigning customized lens shot titles (MCU, CU, ECU) based on zoom depth.</p>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 bg-neutral-900/40 border-t border-neutral-800 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setZoomVariationsSource(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-bold border border-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleGenerateVariations(zoomVariationsSource, zoomRatios)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-white" /> Create 3 Variations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Live Print Preview Modal (On-Screen Layout Configurator) */}
    {showPrintPreview && (
      <div className="fixed inset-0 bg-[#0A0A0B]/98 bg-theme-app/98 z-[250] flex flex-col animate-fade-in print:hidden text-theme-primary">
        {/* Top Navbar */}
        <div className="px-6 py-4 border-b border-neutral-800 border-theme bg-[#0C0C0E] bg-theme-header flex items-center justify-between shrink-0 text-theme-primary">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 bg-theme-badge rounded-lg border border-indigo-500/20 border-theme text-indigo-400 text-theme-primary">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white text-theme-heading">Export & Print Storyboard</h3>
              <p className="text-[10px] text-neutral-500 text-theme-muted">Configure layout parameters for professional PDF compilation or physical print.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF (Direct)</span>
                </>
              )}
            </button>
            <button 
              onClick={() => {
                window.print();
              }}
              className="px-4 py-2 bg-neutral-900 bg-theme-badge border border-neutral-800 border-theme hover:bg-[#121215] text-neutral-300 text-theme-primary rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-indigo-400" /> Print
            </button>
            <button 
              onClick={() => setShowPrintPreview(false)}
              className="px-4 py-2 bg-neutral-950 bg-theme-badge border border-neutral-800/80 border-theme hover:bg-neutral-800 text-neutral-400 text-theme-primary hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Exit Preview
            </button>
          </div>
        </div>

        {/* Split Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Controls Bar */}
          <div className="w-80 border-r border-neutral-800 border-theme bg-[#0C0C0E] bg-theme-panel p-6 overflow-y-auto space-y-6 flex flex-col justify-between shrink-0 text-theme-primary">
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Storyboard Metadata</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Production Title</label>
                    <input 
                      type="text" 
                      value={printTitle || folderName}
                      onChange={(e) => setPrintTitle(e.target.value)}
                      placeholder="Enter storyboard title"
                      className="w-full bg-[#121215] border border-neutral-800 text-white rounded px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Director / Creator</label>
                    <input 
                      type="text" 
                      value={printAuthor}
                      onChange={(e) => setPrintAuthor(e.target.value)}
                      placeholder="Director name"
                      className="w-full bg-[#121215] border border-neutral-800 text-white rounded px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-neutral-800" />

              <div>
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Layout Style</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setPrintLayout('grid'); if (printCols === 1) setPrintCols(2); }}
                    className={cn(
                      "p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer",
                      printLayout === 'grid' 
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-400" 
                        : "bg-[#121215] border-neutral-800 text-neutral-400 hover:text-white"
                    )}
                  >
                    <Layout className="w-4 h-4" />
                    <span>Grid Layout</span>
                  </button>
                  <button 
                    onClick={() => { setPrintLayout('list'); setPrintCols(1); }}
                    className={cn(
                      "p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer",
                      printLayout === 'list' 
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-400" 
                        : "bg-[#121215] border-neutral-800 text-neutral-400 hover:text-white"
                    )}
                  >
                    <List className="w-4 h-4" />
                    <span>List Layout</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Page Orientation</label>
                <div className="grid grid-cols-2 gap-1.5 bg-[#121215] p-1 rounded-lg border border-neutral-800">
                  {(['portrait', 'landscape'] as const).map((orient) => (
                    <button
                      key={orient}
                      onClick={() => setPrintOrientation(orient)}
                      className={cn(
                        "py-1 rounded text-xs font-bold cursor-pointer transition-all capitalize",
                        printOrientation === orient ? "bg-indigo-600 text-white shadow" : "text-neutral-500 hover:text-neutral-300"
                      )}
                    >
                      {orient}
                    </button>
                  ))}
                </div>
              </div>

              {printLayout === 'grid' && (
                <div>
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Columns Per Row</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-[#121215] p-1 rounded-lg border border-neutral-800">
                    {[1, 2, 3].map((col) => (
                      <button
                        key={col}
                        onClick={() => setPrintCols(col)}
                        className={cn(
                          "py-1 rounded text-xs font-bold cursor-pointer transition-all",
                          printCols === col ? "bg-indigo-600 text-white shadow" : "text-neutral-500 hover:text-neutral-300"
                        )}
                      >
                        {col} {col === 1 ? 'Col' : 'Cols'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px bg-neutral-800" />

              <div>
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Include Content</h4>
                <div className="space-y-3.5">
                  <button 
                    onClick={() => setPrintMeta(!printMeta)}
                    className="flex items-center gap-2.5 text-xs text-neutral-300 hover:text-white font-bold w-full text-left cursor-pointer"
                  >
                    {printMeta ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-neutral-600" />}
                    <span>Scene / Shot / Type Badge</span>
                  </button>
                  <button 
                    onClick={() => setPrintNotes(!printNotes)}
                    className="flex items-center gap-2.5 text-xs text-neutral-300 hover:text-white font-bold w-full text-left cursor-pointer"
                  >
                    {printNotes ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-neutral-600" />}
                    <span>Action Notes & Director's Notes</span>
                  </button>
                  <button 
                    onClick={() => setPrintDialogue(!printDialogue)}
                    className="flex items-center gap-2.5 text-xs text-neutral-300 hover:text-white font-bold w-full text-left cursor-pointer"
                  >
                    {printDialogue ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-neutral-600" />}
                    <span>Dialogue & Script Audio Cues</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Instructions Callout */}
            <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3.5 text-[10px] text-neutral-400 space-y-1">
              <span className="font-bold text-indigo-400 block uppercase tracking-wider">⚡ Direct PDF Download (Recommended):</span>
              <p className="text-neutral-300">Click <span className="text-white font-semibold">"Download PDF (Direct)"</span> at the top to instantly download a perfectly formatted, high-definition PDF. It works directly inside the browser and guarantees correct layouts!</p>
              <div className="h-px bg-neutral-800 my-1.5" />
              <span className="font-bold text-neutral-400 block uppercase tracking-wider">💡 Manual Browser Printing:</span>
              <p>1. Set destination to <span className="text-white font-semibold">"Save as PDF"</span> in the print popup.</p>
              <p>2. Select <span className="text-white font-semibold">"Landscape"</span> or <span className="text-white font-semibold">"Portrait"</span> in page orientation.</p>
              <p>3. Enable <span className="text-white font-semibold">"Background Graphics"</span> to render dialogue styling perfectly.</p>
            </div>
          </div>

          {/* Live Preview Pane */}
          <div className="flex-1 bg-neutral-950 p-8 overflow-y-auto flex justify-center custom-scrollbar">
            <div className={cn(
              "w-full bg-white text-black p-12 shadow-2xl rounded-xl flex flex-col gap-8 self-start transition-all duration-300",
              printOrientation === 'portrait' ? "max-w-[210mm] min-h-[297mm]" : "max-w-[297mm] min-h-[210mm]"
            )}>
              {/* Header Section */}
              <div className="border-b-4 border-black pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-900">{printTitle || folderName}</h1>
                  <p className="text-[10px] font-mono text-neutral-400 mt-0.5 uppercase tracking-wider">Cinematic Storyboard Sequence</p>
                </div>
                <div className="text-right">
                  {printAuthor && (
                    <p className="text-xs font-bold text-neutral-800">Director: <span className="font-normal text-neutral-600">{printAuthor}</span></p>
                  )}
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    Frames: {slides.length} | Duration: {totalDurationSeconds.toFixed(1)}s
                  </p>
                </div>
              </div>

              {/* Grid / List Layout Inside Preview */}
              <div className={cn(
                "grid gap-6",
                printLayout === 'grid' && printCols === 1 && "grid-cols-1",
                printLayout === 'grid' && printCols === 2 && "grid-cols-2",
                printLayout === 'grid' && printCols === 3 && "grid-cols-3",
                printLayout === 'list' && "grid-cols-1"
              )}>
                {slides.map((slide, idx) => (
                  <div 
                    key={slide.id} 
                    className={cn(
                      "border border-neutral-200 rounded-lg overflow-hidden flex flex-col bg-white shadow-sm",
                      printLayout === 'list' && "flex-row gap-5 p-3"
                    )}
                  >
                    {/* Image Frame container */}
                    <div className={cn(
                      "bg-black flex items-center justify-center overflow-hidden shrink-0",
                      printLayout === 'grid' ? "w-full aspect-video border-b border-neutral-100" : "w-44 aspect-video rounded border border-neutral-200"
                    )}>
                      <img 
                        src={slide.imageUrl} 
                        alt={`Scene ${slide.sceneNo}`} 
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Content Panel */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {printMeta && (
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                            <span className="text-[10px] font-black tracking-tight font-mono uppercase text-indigo-600">
                              Scene {slide.sceneNo} · Shot {slide.shotNo}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {slide.shotType && (
                                <span className="px-1 py-0.2 rounded bg-neutral-100 border border-neutral-200 text-[8px] font-mono font-bold uppercase text-neutral-600">
                                  {slide.shotType}
                                </span>
                              )}
                              {slide.duration && (
                                <span className="text-[9px] font-mono text-neutral-400">
                                  {((slide.duration) / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {printNotes && slide.action && (
                          <div className="text-[10px] text-neutral-700">
                            <span className="font-extrabold text-[8px] text-neutral-400 uppercase tracking-wider block mb-0.5">Action / Direction</span>
                            <p className="leading-snug">{slide.action}</p>
                          </div>
                        )}

                        {printDialogue && slide.dialogue && (
                          <div className="text-[10px] text-neutral-800 bg-neutral-50/80 p-2 rounded border border-neutral-200 border-l-2 border-l-neutral-400">
                            <span className="font-extrabold text-[8px] text-neutral-400 uppercase tracking-wider block mb-0.5">Dialogue / Cue</span>
                            <p className="italic">"{slide.dialogue}"</p>
                          </div>
                        )}

                        {printNotes && slide.notes && (
                          <div className="text-[9px] text-neutral-500">
                            <span className="font-extrabold text-[8px] text-neutral-400 uppercase tracking-wider block mb-0.5">Notes</span>
                            <p className="italic">{slide.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="text-right text-[8px] text-neutral-300 font-mono mt-3">
                        Panel #{idx + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Absolute raw print-only layout: hidden on screen, displayed on print */}
    <div className="hidden print:block bg-white text-black min-h-screen p-12 font-sans w-full">
      {/* Header Section */}
      <div className="border-b-4 border-black pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">{printTitle || folderName}</h1>
          <p className="text-sm font-mono text-neutral-500 mt-1 uppercase tracking-wider">Cinematic Storyboard Sequence</p>
        </div>
        <div className="text-right">
          {printAuthor && (
            <p className="text-sm font-bold">Director: <span className="font-normal">{printAuthor}</span></p>
          )}
          <p className="text-xs text-neutral-500 font-mono mt-1">
            Date: {new Date().toLocaleDateString()} | Frames: {slides.length} | Dur: {totalDurationSeconds.toFixed(1)}s
          </p>
        </div>
      </div>

      {/* Frames Container */}
      <div className={cn(
        "grid gap-8",
        printLayout === 'grid' && printCols === 1 && "grid-cols-1",
        printLayout === 'grid' && printCols === 2 && "grid-cols-2",
        printLayout === 'grid' && printCols === 3 && "grid-cols-3",
        printLayout === 'list' && "grid-cols-1"
      )}>
        {slides.map((slide, idx) => (
          <div 
            key={slide.id} 
            className={cn(
              "border border-neutral-300 rounded-lg overflow-hidden flex",
              printLayout === 'grid' ? "flex-col" : "flex-row gap-6 p-4 bg-neutral-50/50",
              "break-inside-avoid"
            )}
            style={{ breakInside: 'avoid' }}
          >
            {/* Frame Image */}
            <div className={cn(
              "bg-black flex items-center justify-center overflow-hidden shrink-0",
              printLayout === 'grid' ? "w-full aspect-video" : "w-1/3 aspect-video border border-neutral-200"
            )}>
              <img 
                src={slide.imageUrl} 
                alt={`Frame ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Content Details */}
            <div className={cn(
              "p-4 flex-1 flex flex-col justify-between",
              printLayout === 'list' ? "p-0" : ""
            )}>
              <div className="space-y-2">
                {/* Metadata badges */}
                {printMeta && (
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5 mb-2">
                    <span className="text-xs font-black tracking-tight font-mono uppercase text-indigo-600">
                      Scene {slide.sceneNo} · Shot {slide.shotNo}
                    </span>
                    <div className="flex items-center gap-2">
                      {slide.shotType && (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[9px] font-mono font-bold uppercase text-neutral-700">
                          {slide.shotType}
                        </span>
                      )}
                      {slide.duration && (
                        <span className="text-[10px] font-mono text-neutral-500">
                          {((slide.duration) / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action text */}
                {printNotes && slide.action && (
                  <div className="text-xs text-neutral-800">
                    <span className="font-extrabold text-[10px] text-neutral-400 uppercase tracking-wider block mb-0.5">Action / Direction</span>
                    <p className="leading-relaxed font-sans">{slide.action}</p>
                  </div>
                )}

                {/* Dialogue text */}
                {printDialogue && slide.dialogue && (
                  <div className="text-xs text-neutral-800 bg-neutral-50 p-2 rounded border border-neutral-200/60 border-l-4 border-l-neutral-400">
                    <span className="font-extrabold text-[10px] text-neutral-400 uppercase tracking-wider block mb-0.5">Dialogue / Cue</span>
                    <p className="italic font-sans">"{slide.dialogue}"</p>
                  </div>
                )}

                {/* Notes */}
                {printNotes && slide.notes && (
                  <div className="text-[11px] text-neutral-500">
                    <span className="font-extrabold text-[9px] text-neutral-400 uppercase tracking-wider block mb-0.5">Director's Notes</span>
                    <p className="italic">{slide.notes}</p>
                  </div>
                )}
              </div>
              
              <div className="text-right text-[9px] text-neutral-400 font-mono mt-3">
                Page Panel #{idx + 1}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Save Playback Cut Modal Dialog */}
    {showSaveTrackDialog && (
      <div className="fixed inset-0 bg-[#0A0A0B]/90 bg-theme-app/90 z-[300] flex items-center justify-center p-4 animate-fade-in font-sans text-neutral-200">
        <div className="bg-[#121217] bg-theme-panel border border-neutral-800 border-theme rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white text-theme-heading">Save Playback Cut</h3>
              <p className="text-[10px] text-neutral-500 text-theme-muted">Name this specific storyboard timing sequence profile.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Cut/Sequence Name</label>
            <input 
              type="text" 
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              placeholder="e.g. Director's Cut, 15s Commercial"
              className="w-full bg-neutral-900/60 border border-neutral-800 focus:border-indigo-500 text-white rounded-lg px-3.5 py-2.5 text-xs font-bold outline-none transition-colors"
            />
          </div>

          <div className="bg-neutral-950/40 border border-neutral-800/60 rounded-xl p-3 text-[10px] text-neutral-400 font-mono space-y-1 text-left">
            <p className="text-neutral-500 font-bold uppercase text-[9px] mb-1">Timing Profile Details:</p>
            <p><span className="text-indigo-400/80">Total Duration:</span> {((Object.values(recordedTimings) as number[]).reduce((sum, val) => sum + val, 0) / 1000).toFixed(1)}s</p>
            <p><span className="text-indigo-400/80">Total Frames:</span> {Object.keys(recordedTimings).length || slides.length}</p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button 
              onClick={handleCancelSaveTrack}
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Discard
            </button>
            <button 
              onClick={handleConfirmSaveTrack}
              disabled={!newTrackName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-lg text-xs font-black transition-all cursor-pointer shadow-lg"
            >
              Save & Apply Cut
            </button>
          </div>
        </div>
      </div>
    )}

    {showImageStudio && (
      <div className="fixed inset-0 bg-neutral-950/95 z-[300] flex items-center justify-center p-4 md:p-6 animate-fade-in backdrop-blur-sm overflow-hidden font-sans">
        <div className="bg-[#0C0C0E] border border-neutral-800 border-theme rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl text-theme-primary">
          {/* Header of Studio */}
          <div className="px-6 py-4 border-b border-neutral-800/80 border-theme bg-[#09090B] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white text-theme-heading tracking-wide uppercase">Image Studio AI</h3>
                <p className="text-[10px] text-neutral-500 text-theme-muted">The ultimate generative cinematic canvas builder and scaler</p>
              </div>
            </div>

            {/* Close Button */}
            <button 
              onClick={() => setShowImageStudio(false)}
              className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 bg-neutral-900 bg-theme-badge border border-neutral-800 hover:border-neutral-700 rounded-lg cursor-pointer transition-all"
            >
              Close Studio
            </button>
          </div>

          {/* Inner Tabs Navigation */}
          <div className="flex bg-[#0A0A0B] border-b border-neutral-800/60 border-theme px-6 py-1 items-center justify-between shrink-0">
            <div className="flex gap-4">
              {[
                { id: 'enhance', label: 'AI Image Enhancer / Scaler', desc: 'Upscale and styling' },
                { id: 'textToImage', label: 'Text To Image', desc: 'Generate from text' },
                { id: 'sequence', label: 'Image To Sequence', desc: '1 Image to cinematic cuts' }
              ].map((t) => {
                const isActive = imageStudioTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setImageStudioTab(t.id as any);
                    }}
                    className={cn(
                      "py-3 px-1 border-b-2 text-[11px] uppercase tracking-wider font-extrabold transition-all cursor-pointer text-left",
                      isActive 
                        ? "border-emerald-400 text-emerald-400" 
                        : "border-transparent text-neutral-500 hover:text-neutral-300"
                    )}
                  >
                    <span>{t.label}</span>
                    <span className="block text-[8px] font-medium text-neutral-600 font-sans tracking-tight lowercase mt-0.5">{t.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Status or dynamic helper if any */}
            {slides.length > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-neutral-400 bg-neutral-900 bg-theme-badge px-2.5 py-1 rounded-md border border-neutral-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Storyboard Sync Active</span>
              </div>
            )}
          </div>

          {/* Workshop Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#09090A] min-h-0">
            {/* Tab 1: Image Enhancer */}
            {imageStudioTab === 'enhance' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* Left Controls (5 cols) */}
                <div className="lg:col-span-5 space-y-6 flex flex-col justify-between h-full">
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2.5">1. Select Input Image</h4>
                      
                      {/* Drag and Drop Box or Use Current Slide */}
                      <div className="flex flex-col gap-2.5">
                        {slides.length > 0 && (
                          <button
                            onClick={() => {
                              const currentSlide = slides[currentSlideIndex];
                              if (currentSlide?.imageUrl) {
                                const ext = extractBase64FromDataUrl(currentSlide.imageUrl);
                                if (ext) {
                                  setEnhanceImgBase64(ext.base64);
                                  setEnhanceImgMimeType(ext.mimeType);
                                } else {
                                  alert("Could not load current slide's image base64 data.");
                                }
                              }
                            }}
                            className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span className="text-[10px]">Use Current Frame Visual (Frame #{currentSlideIndex + 1})</span>
                          </button>
                        )}

                        <label className={cn(
                          "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[120px] text-center",
                          enhanceImgBase64 
                            ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10" 
                            : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/20"
                        )}>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleReadFileAsBase64(file, (b64, mime) => {
                                  setEnhanceImgBase64(b64);
                                  setEnhanceImgMimeType(mime);
                                });
                              }
                            }} 
                          />
                          {enhanceImgBase64 ? (
                            <div className="flex items-center gap-3">
                              <CheckSquare className="w-6 h-6 text-emerald-400" />
                              <div className="text-left">
                                <p className="text-xs font-bold text-white">Image Uploaded Successfully</p>
                                <p className="text-[10px] text-neutral-500 font-mono font-bold mt-0.5 uppercase">{enhanceImgMimeType.split('/')[1]} loaded</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-neutral-500 mb-2" />
                              <p className="text-xs font-bold text-neutral-400 text-theme-heading">Upload Source Image</p>
                              <p className="text-[9px] text-neutral-500 text-theme-muted mt-1 leading-snug">Drag & drop or tap to browse your local drive</p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Style Presets */}
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2.5">2. Choose Styling Preset</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'cinematic', label: 'Cinematic Film', desc: 'Dramatic gold composition' },
                          { id: 'photorealistic', label: 'Photorealistic', desc: 'Sharp natural details' },
                          { id: 'details_booster', label: 'Micro-Detail Booster', desc: 'Maximum edge sharpness' },
                          { id: 'anime', label: 'Anime Illustration', desc: 'Vibrant clean comic' },
                          { id: 'oil_painting', label: 'Classical Oil Paint', desc: 'Painterly canvas strokes' },
                          { id: 'vintage_comic', label: 'Retro Comic Book', desc: 'Ink outlines & dots' }
                        ].map((st) => {
                          const isSel = enhanceStyle === st.id;
                          return (
                            <button
                              key={st.id}
                              onClick={() => setEnhanceStyle(st.id)}
                              className={cn(
                                "p-3 rounded-xl border text-left cursor-pointer transition-all",
                                isSel 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:text-white"
                              )}
                            >
                              <p className="text-xs font-extrabold uppercase tracking-wide">{st.label}</p>
                              <p className="text-[9px] text-neutral-500 text-theme-muted mt-0.5 leading-tight">{st.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Upscale Target Size */}
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2">3. Upscale Scale Depth</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: '1K', label: '1K Standard', px: '1024 x 1024' },
                          { id: '2K', label: '2K High Def', px: '2048 x 2048' },
                          { id: '4K', label: '4K Ultra Def', px: '4096 x 4096' }
                        ].map((sz) => {
                          const isSel = enhanceScaleSize === sz.id;
                          return (
                            <button
                              key={sz.id}
                              onClick={() => setEnhanceScaleSize(sz.id)}
                              className={cn(
                                "py-2 px-1 rounded-xl border text-center cursor-pointer transition-all",
                                isSel 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:text-white"
                              )}
                            >
                              <p className="text-xs font-black tracking-wider">{sz.label}</p>
                              <p className="text-[9px] text-neutral-500 font-mono mt-0.5">{sz.px}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={handleEnhanceImage}
                    disabled={isEnhancing || !enhanceImgBase64}
                    className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>AI Enhancing & Scaling Image...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Enhance & Upscale Frame Visual</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right Workshop Preview (7 cols) */}
                <div className="lg:col-span-7 bg-[#0A0A0C] border border-neutral-800/80 border-theme rounded-2xl p-6 flex flex-col justify-between h-full min-h-[380px]">
                  <div className="flex-1 flex flex-col items-center justify-center">
                    {enhancedResultUrl ? (
                      <div className="w-full space-y-4">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest text-center">✨ AI Enhancer Output Complete</p>
                        <div className="relative aspect-video max-w-lg mx-auto bg-black rounded-xl overflow-hidden border border-neutral-800 border-theme shadow-2xl group">
                          <img 
                            src={enhancedResultUrl} 
                            alt="Enhanced result" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          {/* Comparison Tool Hint */}
                          <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-3 py-1.5 bg-black/80 rounded-lg text-[9px] font-mono font-bold text-neutral-300">Click Download or Apply Below</span>
                          </div>
                        </div>
                      </div>
                    ) : enhanceImgBase64 ? (
                      <div className="space-y-4 text-center">
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Source Image Selected</p>
                        <div className="aspect-video max-w-sm mx-auto bg-black rounded-xl overflow-hidden border border-neutral-800">
                          <img 
                            src={`data:${enhanceImgMimeType};base64,${enhanceImgBase64}`} 
                            alt="Source" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">Ready to apply styling. Choose your parameters and click "Enhance & Upscale" on the left panel.</p>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mx-auto border border-neutral-800"><Wrench className="w-5 h-5 text-neutral-600" /></div>
                        <h5 className="text-xs font-extrabold text-white">Workshop Preview Slate</h5>
                        <p className="text-[11px] text-neutral-500 max-w-xs">Upload a local image or sync a visual from your current slide to begin AI processing.</p>
                      </div>
                    )}
                  </div>

                  {/* Result Actions */}
                  {enhancedResultUrl && (
                    <div className="flex items-center gap-3 border-t border-neutral-800 border-theme pt-4 mt-4">
                      <button
                        onClick={() => {
                          // Replace current slide visual or add new
                          if (slides.length > 0) {
                            const updated = [...slides];
                            updated[currentSlideIndex].imageUrl = enhancedResultUrl;
                            setSlides(updated);
                            saveToFirebase(updated, folderName);
                            alert("Frame visual updated successfully with enhanced image!");
                          } else {
                            handleAddBlankFrame(enhancedResultUrl);
                          }
                        }}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                      >
                        {slides.length > 0 ? `Replace Frame #${currentSlideIndex + 1} Visual` : "Add as New Frame"}
                      </button>
                      <a
                        href={enhancedResultUrl}
                        download="enhanced-storyboard.png"
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 border-theme rounded-xl text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Save Local</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Text to Image */}
            {imageStudioTab === 'textToImage' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* Left Controls (5 cols) */}
                <div className="lg:col-span-5 space-y-6 flex flex-col justify-between h-full">
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2.5">1. Text Visual Prompter</h4>
                      <textarea
                        value={t2iPrompt}
                        onChange={(e) => setT2iPrompt(e.target.value)}
                        placeholder="Describe the scene in rich detail (e.g. 'A wide angle cinematic shot, neon lit dark alley in Tokyo, rain reflecting off the asphalt, a lone detective walking away in a beige trenchcoat, masterpiece, 8k resolution')..."
                        className="w-full bg-[#121215] border border-neutral-800 rounded-xl px-4 py-3 text-xs font-medium text-white outline-none focus:border-emerald-500 h-28 resize-none placeholder-neutral-600 leading-relaxed"
                      />
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2.5">2. Camera Aspect Ratio</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: '16:9', label: '16:9 Cinematic', desc: 'Standard Film' },
                          { id: '4:3', label: '4:3 Classic', desc: 'Television' },
                          { id: '1:1', label: '1:1 Square', desc: 'Social Post' },
                          { id: '9:16', label: '9:16 Vertical', desc: 'Tiktok/Story' },
                          { id: '3:4', label: '3:4 Portrait', desc: 'Standard Tall' }
                        ].map((ar) => {
                          const isSel = t2iAspectRatio === ar.id;
                          return (
                            <button
                              key={ar.id}
                              onClick={() => setT2iAspectRatio(ar.id)}
                              className={cn(
                                "py-2.5 px-1 rounded-xl border text-center cursor-pointer transition-all",
                                isSel 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:text-white"
                              )}
                            >
                              <p className="text-[11px] font-extrabold uppercase tracking-wider">{ar.id}</p>
                              <p className="text-[8px] text-neutral-500 text-theme-muted font-medium mt-0.5">{ar.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Image Quality Size */}
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2">3. Drafting Quality</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: '512px', label: 'Draft Mode', desc: 'Fast, compact' },
                          { id: '1K', label: '1K Standard', desc: 'Perfect storyboard' },
                          { id: '2K', label: '2K Fine Details', desc: 'Ultra-crisp visual' }
                        ].map((sz) => {
                          const isSel = t2iImageSize === sz.id;
                          return (
                            <button
                              key={sz.id}
                              onClick={() => setT2iImageSize(sz.id)}
                              className={cn(
                                "py-2 px-1 rounded-xl border text-center cursor-pointer transition-all",
                                isSel 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:text-white"
                              )}
                            >
                              <p className="text-xs font-black tracking-wider">{sz.label}</p>
                              <p className="text-[9px] text-neutral-500 font-medium mt-0.5">{sz.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={handleGenerateT2i}
                    disabled={isGeneratingT2i || !t2iPrompt.trim()}
                    className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
                  >
                    {isGeneratingT2i ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>AI Casting & Painting Scene...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-300" />
                        <span>Render Generative Shot</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right Workshop Preview (7 cols) */}
                <div className="lg:col-span-7 bg-[#0A0A0C] border border-neutral-800/80 border-theme rounded-2xl p-6 flex flex-col justify-between h-full min-h-[380px]">
                  <div className="flex-1 flex flex-col items-center justify-center">
                    {t2iResultUrl ? (
                      <div className="w-full space-y-4">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest text-center">✨ AI Render Completed</p>
                        <div className="relative aspect-video max-w-lg mx-auto bg-black rounded-xl overflow-hidden border border-neutral-800 border-theme shadow-2xl">
                          <img 
                            src={t2iResultUrl} 
                            alt="Generated Visual" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mx-auto border border-neutral-800"><Palette className="w-5 h-5 text-neutral-600" /></div>
                        <h5 className="text-xs font-extrabold text-white">Generative Preview Slate</h5>
                        <p className="text-[11px] text-neutral-500 max-w-xs">Enter your screenplay directions prompt on the left panel, configure aspect ratios, and click "Render Generative Shot".</p>
                      </div>
                    )}
                  </div>

                  {/* Result Actions */}
                  {t2iResultUrl && (
                    <div className="flex items-center gap-3 border-t border-neutral-800 border-theme pt-4 mt-4">
                      <button
                        onClick={() => {
                          const newSlide: Slide = {
                            id: 'slide_' + Date.now(),
                            sceneNo: slides.length > 0 ? slides[slides.length - 1].sceneNo : 1,
                            shotNo: slides.length + 1,
                            action: t2iPrompt,
                            dialogue: '',
                            duration: 2.0,
                            imageUrl: t2iResultUrl,
                            notes: 'AI Generated Frame',
                            colorLabel: 'none'
                          };
                          const updated = [...slides, newSlide];
                          setSlides(updated);
                          saveToFirebase(updated, folderName);
                          alert("Successfully appended new generated frame to storyboard sequence!");
                        }}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                      >
                        Append Frame to Storyboard
                      </button>
                      <a
                        href={t2iResultUrl}
                        download="storyboard-art.png"
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 border-theme rounded-xl text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Save Local</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Image To Sequence */}
            {imageStudioTab === 'sequence' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* Left Controls (4 cols) */}
                <div className="lg:col-span-4 space-y-6 flex flex-col justify-between h-full border-r border-neutral-800/40 pr-2">
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2.5">1. Select Anchor Frame</h4>
                      
                      {/* Drag and Drop Box or Use Current Slide */}
                      <div className="flex flex-col gap-2.5">
                        {slides.length > 0 && (
                          <button
                            onClick={() => {
                              const currentSlide = slides[currentSlideIndex];
                              if (currentSlide?.imageUrl) {
                                const ext = extractBase64FromDataUrl(currentSlide.imageUrl);
                                if (ext) {
                                  setSeqImgBase64(ext.base64);
                                  setSeqImgMimeType(ext.mimeType);
                                } else {
                                  alert("Could not load current slide's image data.");
                                }
                              }
                            }}
                            className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span className="text-[10px]">Use Current Frame #{currentSlideIndex + 1}</span>
                          </button>
                        )}

                        <label className={cn(
                          "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[110px] text-center",
                          seqImgBase64 
                            ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10" 
                            : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/20"
                        )}>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleReadFileAsBase64(file, (b64, mime) => {
                                  setSeqImgBase64(b64);
                                  setSeqImgMimeType(mime);
                                });
                              }
                            }} 
                          />
                          {seqImgBase64 ? (
                            <div className="flex items-center gap-3">
                              <CheckSquare className="w-6 h-6 text-emerald-400" />
                              <div className="text-left">
                                <p className="text-xs font-bold text-white">Anchor Frame Loaded</p>
                                <p className="text-[10px] text-neutral-500 font-mono font-bold uppercase mt-0.5">{seqImgMimeType.split('/')[1]}</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-neutral-500 mb-2" />
                              <p className="text-xs font-bold text-neutral-400">Upload Anchor Visual</p>
                              <p className="text-[9px] text-neutral-500 mt-1 leading-snug">This will serve as Frame #1</p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Camera Motion Selection */}
                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-400 text-theme-muted uppercase tracking-widest mb-2.5">2. Choose Camera Move</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'dolly_in', label: 'Dolly In', desc: 'Camera pushes in closer' },
                          { id: 'zoom_out', label: 'Zoom Out', desc: 'Revealing zoom out' },
                          { id: 'pan_right', label: 'Pan Right', desc: 'Slow cinematic right shift' },
                          { id: 'pan_left', label: 'Pan Left', desc: 'Slow cinematic left shift' },
                          { id: 'tilt_up', label: 'Tilt Up', desc: 'Camera tilts upwards' },
                          { id: 'tilt_down', label: 'Tilt Down', desc: 'Camera tilts downwards' },
                          { id: 'orbit', label: 'Orbit Shot', desc: '360 degree circular move' },
                          { id: 'whip_pan', label: 'Whip Pan', desc: 'Fast dynamic whip cut' }
                        ].map((mov) => {
                          const isSel = seqMovementType === mov.id;
                          return (
                            <button
                              key={mov.id}
                              onClick={() => setSeqMovementType(mov.id)}
                              className={cn(
                                "p-2.5 rounded-xl border text-left cursor-pointer transition-all",
                                isSel 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:text-white"
                              )}
                            >
                              <p className="text-xs font-extrabold uppercase tracking-wide">{mov.label}</p>
                              <p className="text-[9px] text-neutral-500 text-theme-muted mt-0.5 leading-tight">{mov.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={handleGenerateSequence}
                    disabled={isGeneratingSequence || !seqImgBase64}
                    className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
                  >
                    {isGeneratingSequence ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Directing Cinematic Sequence...</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 text-white" />
                        <span>Generate Cinematic Cuts</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right Workshop Sequence Layout (8 cols) */}
                <div className="lg:col-span-8 bg-[#0A0A0C] border border-neutral-800/80 border-theme rounded-2xl p-6 flex flex-col justify-between h-full min-h-[380px] overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                    {suggestedSequenceFrames.length > 0 ? (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-neutral-800 border-theme pb-2 shrink-0">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">🎬 AI Generated Sequence Storyboard</span>
                          <span className="text-[9px] text-neutral-500 font-mono font-bold">4 Continuous Frames</span>
                        </div>

                        {/* Render the 4 horizontal sequence frame editors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                          {suggestedSequenceFrames.map((frame, index) => {
                            const shotNo = frame.shotNo;
                            const currentVisual = sequenceFrameVisuals[shotNo];
                            const isGeneratingVisual = isGeneratingFrameVisual[shotNo];

                            return (
                              <div key={index} className="bg-[#121215] border border-neutral-800 border-theme rounded-xl p-3 flex flex-col gap-2 shadow-md hover:border-neutral-700 transition-colors">
                                {/* Top badge line */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center justify-center">
                                      {shotNo}
                                    </span>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-white font-mono bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-850">
                                      {frame.shotType || 'WS'} • {(frame.duration / 1000).toFixed(1)}s
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-emerald-400/80 font-mono font-extrabold italic">
                                    {frame.movementSuggestion || "Dolly action"}
                                  </span>
                                </div>

                                {/* Frame image or generation state */}
                                <div className="aspect-video bg-black rounded-lg overflow-hidden border border-neutral-900 relative group">
                                  {currentVisual ? (
                                    <img 
                                      src={currentVisual} 
                                      alt={`Frame ${shotNo}`} 
                                      className="w-full h-full object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center space-y-2">
                                      <p className="text-[9px] text-neutral-500 italic max-w-[180px]">No visual rendered for Frame #{shotNo} yet.</p>
                                      <button
                                        onClick={() => handleGenerateFrameVisual(shotNo, frame.action)}
                                        disabled={isGeneratingVisual}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold rounded-md transition-colors cursor-pointer"
                                      >
                                        {isGeneratingVisual ? "Casting Visual..." : "Casting Visual"}
                                      </button>
                                    </div>
                                  )}

                                  {/* Action overlay hover to re-render */}
                                  {currentVisual && shotNo > 1 && (
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <button
                                        onClick={() => handleGenerateFrameVisual(shotNo, frame.action)}
                                        disabled={isGeneratingVisual}
                                        className="px-2.5 py-1.5 bg-neutral-950/95 text-emerald-400 text-[9px] font-extrabold border border-emerald-500/20 rounded-md transition-colors cursor-pointer"
                                      >
                                        {isGeneratingVisual ? "Re-generating..." : "Re-generate Visual"}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Text Description */}
                                <div className="space-y-1.5 text-left">
                                  <p className="text-[10px] text-neutral-300 font-sans font-medium leading-snug line-clamp-2" title={frame.action}>
                                    <strong className="text-neutral-500 font-bold">Action:</strong> {frame.action}
                                  </p>
                                  {frame.dialogue && (
                                    <p className="text-[10px] text-amber-400 font-sans italic line-clamp-1">
                                      <strong className="text-neutral-500 font-bold not-italic">Dialogue:</strong> "{frame.dialogue}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : seqImgBase64 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Anchor Frame Visual Loaded</p>
                        <div className="aspect-video max-w-sm bg-black rounded-xl overflow-hidden border border-neutral-800">
                          <img 
                            src={`data:${seqImgMimeType};base64,${seqImgBase64}`} 
                            alt="Anchor visual" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">Ready to orchestrate cinematic continuous sequence. Click "Generate Cinematic Cuts" to begin AI director coaching.</p>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
                        <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center border border-neutral-800"><Video className="w-5 h-5 text-neutral-600" /></div>
                        <h5 className="text-xs font-extrabold text-white">Sequence Director Slate</h5>
                        <p className="text-[11px] text-neutral-500 max-w-xs">Upload your starting frame or sync from your current storyboard slide to begin creating multi-frame motion suggestions.</p>
                      </div>
                    )}
                  </div>

                  {/* Result actions */}
                  {suggestedSequenceFrames.length > 0 && (
                    <div className="flex items-center gap-3 border-t border-neutral-800 border-theme pt-4 mt-4 shrink-0">
                      <button
                        onClick={handleAddSequenceToStoryboard}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                      >
                        Append Sequence to Storyboard Layout
                      </button>
                      <button
                        onClick={() => {
                          setSuggestedSequenceFrames([]);
                          setSequenceFrameVisuals({});
                        }}
                        className="px-4 py-2.5 bg-neutral-900 hover:bg-[#121215] text-neutral-400 border border-neutral-800 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Reset Sequence
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>
);
}


