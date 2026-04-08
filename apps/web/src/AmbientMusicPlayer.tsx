import { Array as EffectArray, Option, pipe } from "effect";
import { useCallback, useEffect, useRef } from "react";
import { useAudioSettings } from "./audio-settings";

const AMBIENT_TRACKS = EffectArray.make(
  "/kits/music/refactory-ambient-1.ogg",
  "/kits/music/refactory-ambient-2.ogg",
  "/kits/music/refactory-ambient-3.ogg",
  "/kits/music/refactory-ambient-4.ogg",
  "/kits/music/refactory-ambient-5.ogg",
  "/kits/music/refactory-ambient-6.ogg",
);

const AMBIENT_BASE_VOLUME = 0.14;

function trackAt(index: number): string {
  return pipe(
    AMBIENT_TRACKS,
    EffectArray.get(index),
    Option.getOrElse(() => AMBIENT_TRACKS[0]),
  );
}

function nextTrackIndex(index: number): number {
  return (index + 1) % AMBIENT_TRACKS.length;
}

function stopAudio(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
}

export function AmbientMusicPlayer() {
  const { getChannelVolume } = useAudioSettings();
  const musicVolume = getChannelVolume("music") * AMBIENT_BASE_VOLUME;
  const musicVolumeRef = useRef(musicVolume);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackIndexRef = useRef(0);
  const hasUnlockedRef = useRef(false);

  musicVolumeRef.current = musicVolume;

  const syncVolume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = musicVolumeRef.current;
  }, []);

  const playTrack = useCallback(async (index: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    currentTrackIndexRef.current = index;
    audio.src = trackAt(index);
    audio.load();
    audio.volume = musicVolumeRef.current;

    try {
      await audio.play();
    } catch {
      return;
    }
  }, []);

  const advancePlaylist = useCallback(() => {
    void playTrack(nextTrackIndex(currentTrackIndexRef.current));
  }, [playTrack]);

  useEffect(() => {
    syncVolume();
  }, [musicVolume, syncVolume]);

  useEffect(() => {
    // Reuse one element so browsers keep playback unlocked between tracks.
    const audio = new Audio(trackAt(currentTrackIndexRef.current));
    audio.loop = false;
    audio.preload = "auto";
    audio.volume = musicVolumeRef.current;
    audioRef.current = audio;

    const handleEnded = () => {
      advancePlaylist();
    };

    audio.addEventListener("ended", handleEnded);

    const unlockPlayback = () => {
      if (hasUnlockedRef.current) {
        return;
      }

      hasUnlockedRef.current = true;
      void playTrack(currentTrackIndexRef.current);
    };

    window.addEventListener("pointerdown", unlockPlayback, { once: true });
    window.addEventListener("keydown", unlockPlayback, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockPlayback);
      window.removeEventListener("keydown", unlockPlayback);
      audio.removeEventListener("ended", handleEnded);
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      stopAudio(audio);
    };
  }, [advancePlaylist, playTrack]);

  return null;
}
