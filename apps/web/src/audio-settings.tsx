import { createContext, useContext, useEffect, useState } from "react";

type AudioChannel = "music" | "soundEffects";

type AudioSettings = {
  readonly overall: number;
  readonly music: number;
  readonly soundEffects: number;
};

type AudioSettingsContextValue = {
  readonly settings: AudioSettings;
  readonly setVolume: (key: keyof AudioSettings, value: number) => void;
  readonly getChannelVolume: (channel: AudioChannel) => number;
};

const AUDIO_SETTINGS_STORAGE_KEY = "refactory.audio-settings";

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  overall: 1,
  music: 1,
  soundEffects: 1,
};

const AudioSettingsContext = createContext<AudioSettingsContextValue | null>(
  null,
);

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStoredVolume(
  value: Record<string, unknown>,
  key: keyof AudioSettings,
  fallback: number,
): number {
  const candidate = value[key];
  return typeof candidate === "number" ? clampVolume(candidate) : fallback;
}

function readStoredAudioSettings(): AudioSettings {
  if (typeof window === "undefined") {
    return DEFAULT_AUDIO_SETTINGS;
  }

  const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_AUDIO_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return DEFAULT_AUDIO_SETTINGS;
    }

    return {
      overall: readStoredVolume(
        parsed,
        "overall",
        DEFAULT_AUDIO_SETTINGS.overall,
      ),
      music: readStoredVolume(parsed, "music", DEFAULT_AUDIO_SETTINGS.music),
      soundEffects: readStoredVolume(
        parsed,
        "soundEffects",
        DEFAULT_AUDIO_SETTINGS.soundEffects,
      ),
    };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

function getChannelVolume(
  settings: AudioSettings,
  channel: AudioChannel,
): number {
  return channel === "music"
    ? settings.overall * settings.music
    : settings.overall * settings.soundEffects;
}

export function AudioSettingsProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<AudioSettings>(() =>
    readStoredAudioSettings(),
  );

  useEffect(() => {
    window.localStorage.setItem(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  }, [settings]);

  return (
    <AudioSettingsContext.Provider
      value={{
        settings,
        setVolume: (key, value) => {
          setSettings((current) => ({
            ...current,
            [key]: clampVolume(value),
          }));
        },
        getChannelVolume: (channel) => getChannelVolume(settings, channel),
      }}
    >
      {children}
    </AudioSettingsContext.Provider>
  );
}

export function useAudioSettings(): AudioSettingsContextValue {
  const context = useContext(AudioSettingsContext);
  if (!context) {
    throw new Error("Audio settings provider missing");
  }
  return context;
}
