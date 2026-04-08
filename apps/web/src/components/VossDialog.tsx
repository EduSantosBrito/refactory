import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useAudioSettings } from "../audio-settings";
import { preloadVossPortrait } from "../preload";

const VossPortrait = lazy(() =>
  import("./VossPortrait").then((module) => ({
    default: module.VossPortrait,
  })),
);

export type VossLine = {
  readonly text: string;
  readonly sound?: "chime" | "error" | "printer" | "dialup" | "shutdown";
};

type VossDialogProps = {
  /** Sequence of lines Voss will speak */
  readonly lines: readonly VossLine[];
  /** Called when the full conversation is dismissed */
  readonly onComplete: () => void;
};

const CHAR_DELAY_MS = 28;
const FAST_CHAR_DELAY_MS = 8;
const VOSS_VOICE_PATH = "/kits/sounds/voss_voice.ogg";
const VOSS_VOICE_BASE_VOLUME = 0.18;
const VOSS_VOICE_PLAYBACK_RATE = 0.96;
const VOSS_VOICE_FAST_PLAYBACK_RATE = 1.22;
const VOSS_VOICE_MIN_LOOP_TAIL_SECONDS = 0.75;

function pickRandomLoopStart(duration: number): number {
  const maxStart = Math.max(0, duration - VOSS_VOICE_MIN_LOOP_TAIL_SECONDS);
  if (maxStart <= 0) {
    return 0;
  }

  return Math.random() * maxStart;
}

function stopVoiceSource(source: AudioBufferSourceNode | null) {
  if (!source) {
    return;
  }

  try {
    source.stop();
  } catch {
    // AudioBufferSourceNode.stop() throws if the node was already stopped.
  }
  source.disconnect();
}

function VossPortraitFallback() {
  return (
    <div className="voss-portrait" aria-hidden="true">
      <div className="voss-portrait-canvas voss-portrait-placeholder" />
      <div className="voss-portrait-scanlines" />
    </div>
  );
}

export function VossDialog({ lines, onComplete }: VossDialogProps) {
  const { getChannelVolume } = useAudioSettings();
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(true);
  const [isFast, setIsFast] = useState(false);
  const [isVoiceReady, setIsVoiceReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const voiceContextRef = useRef<AudioContext | null>(null);
  const voiceGainRef = useRef<GainNode | null>(null);
  const voiceBufferRef = useRef<AudioBuffer | null>(null);
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentLine = lines[lineIndex];
  const fullText = currentLine?.text ?? "";
  const visibleText = fullText.slice(0, charIndex);
  const isDone = charIndex >= fullText.length;
  const isLastLine = lineIndex >= lines.length - 1;
  const voiceVolume = VOSS_VOICE_BASE_VOLUME * getChannelVolume("soundEffects");
  const shouldPlayVoice =
    isVoiceReady && isRevealing && !isDone && fullText.length > 0;

  // Typewriter tick
  useEffect(() => {
    if (!isRevealing || isDone) return;

    const delay = isFast ? FAST_CHAR_DELAY_MS : CHAR_DELAY_MS;
    timerRef.current = setTimeout(() => {
      setCharIndex((c) => c + 1);
    }, delay);

    return () => clearTimeout(timerRef.current);
  }, [charIndex, isRevealing, isDone, isFast]);

  // Mark revealing done
  useEffect(() => {
    if (isDone) setIsRevealing(false);
  }, [isDone]);

  useEffect(() => {
    void preloadVossPortrait();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.connect(context.destination);
    voiceContextRef.current = context;
    voiceGainRef.current = gain;

    const loadVoice = async () => {
      try {
        const response = await fetch(VOSS_VOICE_PATH);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(arrayBuffer);

        if (isCancelled) {
          return;
        }

        voiceBufferRef.current = buffer;
        setIsVoiceReady(true);
      } catch {
        if (!isCancelled) {
          setIsVoiceReady(false);
        }
      }
    };

    void loadVoice();

    return () => {
      isCancelled = true;
      stopVoiceSource(voiceSourceRef.current);
      voiceSourceRef.current = null;
      voiceBufferRef.current = null;
      voiceGainRef.current?.disconnect();
      voiceGainRef.current = null;
      voiceContextRef.current = null;
      void context.close();
    };
  }, []);

  useEffect(() => {
    const gain = voiceGainRef.current;
    if (!gain) {
      return;
    }

    gain.gain.value = voiceVolume;
  }, [voiceVolume]);

  useEffect(() => {
    const source = voiceSourceRef.current;
    if (!source) {
      return;
    }

    stopVoiceSource(source);
    voiceSourceRef.current = null;
  }, [lineIndex]);

  useEffect(() => {
    const source = voiceSourceRef.current;
    if (!source) {
      return;
    }

    source.playbackRate.value = isFast
      ? VOSS_VOICE_FAST_PLAYBACK_RATE
      : VOSS_VOICE_PLAYBACK_RATE;
  }, [isFast]);

  useEffect(() => {
    const context = voiceContextRef.current;
    const gain = voiceGainRef.current;
    const buffer = voiceBufferRef.current;

    if (!context || !gain || !buffer) {
      return;
    }

    if (!shouldPlayVoice) {
      stopVoiceSource(voiceSourceRef.current);
      voiceSourceRef.current = null;
      return;
    }

    if (voiceSourceRef.current) {
      return;
    }

    const source = context.createBufferSource();
    const loopStart = pickRandomLoopStart(buffer.duration);
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = loopStart;
    source.loopEnd = buffer.duration;
    source.playbackRate.value = isFast
      ? VOSS_VOICE_FAST_PLAYBACK_RATE
      : VOSS_VOICE_PLAYBACK_RATE;
    source.connect(gain);
    source.start(0, loopStart);
    source.onended = () => {
      if (voiceSourceRef.current === source) {
        voiceSourceRef.current = null;
      }
      source.disconnect();
    };
    voiceSourceRef.current = source;

    void context.resume().catch(() => undefined);
    return () => {
      if (voiceSourceRef.current !== source) {
        return;
      }

      stopVoiceSource(source);
      voiceSourceRef.current = null;
    };
  }, [isFast, lineIndex, shouldPlayVoice]);

  const advance = useCallback(() => {
    if (!isDone) {
      // Still revealing — rush to end
      setCharIndex(fullText.length);
      setIsRevealing(false);
      setIsFast(false);
      return;
    }

    if (isLastLine) {
      onComplete();
      return;
    }

    // Next line
    setLineIndex((i) => i + 1);
    setCharIndex(0);
    setIsRevealing(true);
    setIsFast(false);
  }, [isDone, isLastLine, fullText.length, onComplete]);

  const handleDialogMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
    },
    [],
  );

  const handleDialogClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      advance();
    },
    [advance],
  );

  // Keyboard: Space/Enter to advance, hold to speed up
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isDone && isRevealing) {
          setIsFast(true);
        } else {
          advance();
        }
      }
    };

    const handleUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        setIsFast(false);
      }
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [advance, isDone, isRevealing]);

  if (!currentLine) return null;

  return (
    <div className="voss-dialog-shell">
      <div
        className="voss-dialog-container"
        onMouseDown={handleDialogMouseDown}
        onClick={handleDialogClick}
      >
        <Suspense fallback={<VossPortraitFallback />}>
          <VossPortrait />
        </Suspense>
        <div className="voss-dialog-content">
          <div className="voss-dialog-name">
            <span>Director Voss</span>
          </div>
          <div className="voss-dialog-bubble">
            <p className="voss-dialog-text">{visibleText}</p>
            {isDone && (
              <span className="voss-dialog-advance" aria-hidden="true">
                {isLastLine ? "●" : "▼"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
