import * as React from "react";
import { Mic, Square, Upload, Trash2, Play, Pause, Scissors } from "lucide-react";
import { Button } from "@shaxmatchi/ui";

type AudioRecorderProps = {
  onRecorded: (file: File) => void;
  disabled?: boolean;
  /** When provided, shows a trim-and-prepend section for this audio URL */
  prependAudioUrl?: string;
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

/** Encode an AudioBuffer to a WAV Blob (16-bit PCM) */
function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const dataSize = numSamples * numChannels * 2; // 16-bit = 2 bytes
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  str(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

/** Slice an AudioBuffer from startSec to endSec */
function sliceAudioBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const sr = buffer.sampleRate;
  const start = Math.max(0, Math.floor(startSec * sr));
  const end = Math.min(buffer.length, Math.ceil(endSec * sr));
  const length = Math.max(0, end - start);
  const result = ctx.createBuffer(buffer.numberOfChannels, length, sr);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    result.getChannelData(ch).set(buffer.getChannelData(ch).subarray(start, end));
  }
  return result;
}

/** Concatenate two AudioBuffers (b appended after a) */
function concatenateAudioBuffers(
  ctx: AudioContext,
  a: AudioBuffer,
  b: AudioBuffer,
): AudioBuffer {
  const numChannels = Math.max(a.numberOfChannels, b.numberOfChannels);
  const totalLength = a.length + b.length;
  const result = ctx.createBuffer(numChannels, totalLength, a.sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const out = result.getChannelData(ch);
    if (ch < a.numberOfChannels) out.set(a.getChannelData(ch), 0);
    if (ch < b.numberOfChannels) out.set(b.getChannelData(ch), a.length);
  }
  return result;
}

function fmtSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

export function AudioRecorder({ onRecorded, disabled, prependAudioUrl }: AudioRecorderProps) {
  const [state, setState] = React.useState<
    "idle" | "recording" | "recorded" | "playing"
  >("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);

  // Trim/prepend state
  const [trimStart, setTrimStart] = React.useState(0);
  const [trimEnd, setTrimEnd] = React.useState("");
  const [sourceDuration, setSourceDuration] = React.useState<number | null>(null);
  const [sourceCurrentTime, setSourceCurrentTime] = React.useState(0);
  const sourceAudioRef = React.useRef<HTMLAudioElement>(null);

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

  // Reset trim state when source changes
  React.useEffect(() => {
    if (!prependAudioUrl) {
      setSourceDuration(null);
      setSourceCurrentTime(0);
      setTrimStart(0);
      setTrimEnd("");
    }
  }, [prependAudioUrl]);

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

  const uploadRecording = React.useCallback(async () => {
    if (!blob) return;

    // If no prepend source, upload as-is
    if (!prependAudioUrl) {
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: "audio/webm",
      });
      onRecorded(file);
      discardRecording();
      return;
    }

    // Trim + concatenate flow
    setProcessing(true);
    try {
      const end = trimEnd !== "" ? parseFloat(trimEnd) : (sourceDuration ?? null);
      if (end === null || end <= trimStart) {
        alert("Tugash vaqtini to'g'ri kiriting");
        return;
      }

      const [sourceResp, newArrayBuffer] = await Promise.all([
        fetch(prependAudioUrl).then((r) => r.arrayBuffer()),
        blob.arrayBuffer(),
      ]);

      const audioCtx = new AudioContext();
      const [sourceBuffer, newBuffer] = await Promise.all([
        audioCtx.decodeAudioData(sourceResp),
        audioCtx.decodeAudioData(newArrayBuffer),
      ]);

      const sliced = sliceAudioBuffer(audioCtx, sourceBuffer, trimStart, end);
      const combined = concatenateAudioBuffers(audioCtx, sliced, newBuffer);
      await audioCtx.close();

      const wavBlob = encodeWav(combined);
      const file = new File([wavBlob], `recording-${Date.now()}.wav`, {
        type: "audio/wav",
      });
      onRecorded(file);
      discardRecording();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Audio birlashtirish xatoligi");
    } finally {
      setProcessing(false);
    }
  }, [blob, prependAudioUrl, trimStart, trimEnd, sourceDuration, onRecorded, discardRecording]);

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
  const isUploading = processing;

  return (
    <div className="space-y-2">
      {/* Trim/prepend section */}
      {prependAudioUrl ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700">
            <Scissors className="h-3.5 w-3.5" />
            Manbadan kesib olish
          </div>

          {/* Source audio player — shows native timer and seekbar */}
          <audio
            ref={sourceAudioRef}
            src={prependAudioUrl}
            controls
            preload="metadata"
            onLoadedMetadata={(e) => {
              const d = (e.currentTarget as HTMLAudioElement).duration;
              setSourceDuration(isFinite(d) ? d : null);
            }}
            onTimeUpdate={(e) => {
              setSourceCurrentTime((e.currentTarget as HTMLAudioElement).currentTime);
            }}
            className="w-full h-8"
          />

          {/* Current time badge + stamp buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="tabular-nums text-xs font-mono bg-indigo-100 text-indigo-700 rounded px-2 py-0.5 select-all">
              {fmtSec(sourceCurrentTime)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setTrimStart(parseFloat(sourceCurrentTime.toFixed(2)))}
              title="Joriy vaqtni boshlanish sifatida belgilash"
              className="gap-1 text-[11px]"
            >
              ← Boshlanish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setTrimEnd(sourceCurrentTime.toFixed(2))}
              title="Joriy vaqtni tugash sifatida belgilash"
              className="gap-1 text-[11px]"
            >
              Tugash →
            </Button>
            {sourceDuration !== null ? (
              <span className="ml-auto text-[10px] text-indigo-400 tabular-nums">
                / {fmtSec(sourceDuration)}
              </span>
            ) : null}
          </div>

          {/* Start / end number inputs */}
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-slate-500">Boshlanish (s)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                max={sourceDuration ?? undefined}
                value={trimStart}
                onChange={(e) => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-slate-500">
                Tugash (s)
              </label>
              <input
                type="number"
                min={trimStart}
                step={0.01}
                max={sourceDuration ?? undefined}
                placeholder={sourceDuration !== null ? sourceDuration.toFixed(2) : "oxiri"}
                value={trimEnd}
                onChange={(e) => setTrimEnd(e.target.value)}
                className="w-24 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs tabular-nums"
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-400">
            Audioni ijro eting, kerakli vaqtda "Boshlanish" yoki "Tugash" tugmasini bosing.
            Yangi yozuv shu qismdan keyin qo'shiladi.
          </p>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        width={320}
        height={CANVAS_HEIGHT}
        className="w-full rounded-lg bg-slate-100"
        style={{ height: CANVAS_HEIGHT }}
      />

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
              disabled={disabled || isUploading}
              onClick={() => void uploadRecording()}
              title={prependAudioUrl ? "Kesib qo'shib yuklash" : "Yuklash"}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {isUploading ? "Birlashtirmoqda…" : prependAudioUrl ? "Birlashtir va yuklash" : "Yuklash"}
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
