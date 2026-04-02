import * as React from "react";
import { Mic, Square, Upload, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@shaxmatchi/ui";

type AudioRecorderProps = {
  onRecorded: (file: File) => void;
  disabled?: boolean;
};

const BAR_COUNT = 48;
const CANVAS_HEIGHT = 48;

function drawBars(
  canvas: HTMLCanvasElement,
  bars: number[],
  progress: number | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const barW = w / BAR_COUNT;
  const gap = 1;
  const progressIdx = progress !== null ? Math.floor(progress * BAR_COUNT) : BAR_COUNT;

  for (let i = 0; i < BAR_COUNT; i++) {
    const val = bars[i] ?? 0.05;
    const barH = Math.max(2, val * h * 0.92);
    const x = i * barW + gap / 2;
    const y = (h - barH) / 2;
    const played = i <= progressIdx;
    ctx.fillStyle =
      progress === null
        ? `rgba(79, 70, 229, ${0.5 + val * 0.5})`
        : played
          ? `rgba(79, 70, 229, ${0.55 + val * 0.45})`
          : `rgba(148, 163, 184, ${0.3 + val * 0.3})`;
    ctx.beginPath();
    ctx.roundRect(x, y, barW - gap, barH, 1.5);
    ctx.fill();
  }
}

function summarizeFrames(frames: number[][]): number[] {
  if (frames.length === 0) return new Array(BAR_COUNT).fill(0.05);
  if (frames.length <= BAR_COUNT) {
    const mid = frames[Math.floor(frames.length / 2)] ?? [];
    const out: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) out.push(mid[i] ?? 0.05);
    return out;
  }
  const step = frames.length / BAR_COUNT;
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const fi = Math.min(Math.floor(i * step), frames.length - 1);
    let max = 0;
    for (let b = 0; b < BAR_COUNT; b++) max = Math.max(max, frames[fi][b] ?? 0);
    out.push(max);
  }
  return out;
}

export function AudioRecorder({ onRecorded, disabled }: AudioRecorderProps) {
  const [state, setState] = React.useState<
    "idle" | "recording" | "recorded" | "playing"
  >("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animFrameRef = React.useRef<number>(0);
  const timerRef = React.useRef<number>(0);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recordedBarsRef = React.useRef<number[][]>([]);
  const summaryBarsRef = React.useRef<number[]>([]);

  const revokeBlobUrl = React.useCallback(() => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const cleanupRecording = React.useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  React.useEffect(
    () => () => {
      cleanupRecording();
      revokeBlobUrl();
    },
    [cleanupRecording, revokeBlobUrl],
  );

  const drawLive = React.useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const step = Math.floor(dataArray.length / BAR_COUNT);
    const bars: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
      bars.push(sum / step / 255);
    }
    recordedBarsRef.current.push(bars);
    drawBars(canvas, bars, null);
    animFrameRef.current = requestAnimationFrame(drawLive);
  }, []);

  const drawStatic = React.useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawBars(canvas, summaryBarsRef.current, progress);
  }, []);

  const startRecording = React.useCallback(async () => {
    cleanupRecording();
    revokeBlobUrl();
    recordedBarsRef.current = [];
    summaryBarsRef.current = [];
    setBlob(null);
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        const url = URL.createObjectURL(b);
        setBlobUrl(url);
        summaryBarsRef.current = summarizeFrames(recordedBarsRef.current);
        setState("recorded");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (audioContextRef.current?.state !== "closed") {
          audioContextRef.current?.close().catch(() => {});
        }
      };

      recorder.start(100);
      setState("recording");

      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 250);

      animFrameRef.current = requestAnimationFrame(drawLive);
    } catch {
      setState("idle");
    }
  }, [cleanupRecording, revokeBlobUrl, drawLive]);

  const stopRecording = React.useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const playRecorded = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !blobUrl) return;
    audio.play().catch(() => {});
    setState("playing");
  }, [blobUrl]);

  const pausePlayback = React.useCallback(() => {
    audioRef.current?.pause();
    setState("recorded");
  }, []);

  const discardRecording = React.useCallback(() => {
    cleanupRecording();
    audioRef.current?.pause();
    revokeBlobUrl();
    setBlob(null);
    setState("idle");
    setElapsed(0);
    recordedBarsRef.current = [];
    summaryBarsRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [cleanupRecording, revokeBlobUrl]);

  const uploadRecording = React.useCallback(() => {
    if (!blob) return;
    const file = new File([blob], `recording-${Date.now()}.webm`, {
      type: "audio/webm",
    });
    onRecorded(file);
    discardRecording();
  }, [blob, onRecorded, discardRecording]);

  const handleTimeUpdate = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const p = audio.currentTime / audio.duration;
    drawStatic(p);
  }, [drawStatic]);

  const handleEnded = React.useCallback(() => {
    setState("recorded");
    drawStatic(1);
  }, [drawStatic]);

  React.useEffect(() => {
    if (state === "recorded" && blobUrl) {
      drawStatic(0);
    }
  }, [state, blobUrl, drawStatic]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={320}
        height={CANVAS_HEIGHT}
        className="w-full rounded-lg bg-slate-100"
        style={{ height: CANVAS_HEIGHT }}
      />

      {/* Hidden audio element for reliable playback */}
      {blobUrl ? (
        <audio
          ref={audioRef}
          src={blobUrl}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="hidden"
        />
      ) : null}

      <div className="flex items-center gap-2">
        {state === "idle" ? (
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={startRecording}
            title="Yozishni boshlash"
            className="gap-1.5"
          >
            <Mic className="h-3.5 w-3.5" />
            Yozish
          </Button>
        ) : state === "recording" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={stopRecording}
              title="To'xtatish"
              className="gap-1.5"
            >
              <Square className="h-3 w-3" />
              To'xtatish
            </Button>
            <span className="flex items-center gap-1.5 text-xs tabular-nums text-red-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {mm}:{ss}
            </span>
          </>
        ) : (
          <>
            {state === "playing" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={pausePlayback}
                title="Pauza"
                className="gap-1.5"
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={playRecorded}
                title="Tinglash"
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={uploadRecording}
              title="Yuklash"
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Yuklash
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={discardRecording}
              title="Bekor qilish"
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs tabular-nums text-slate-500">
              {mm}:{ss}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
