import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const API_BASE = "https://api.vachana.ai";

function convertToWav(inputBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
      "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"
    ]);
    const output = [];
    let errorOutput = "";
    ffmpeg.stdout.on("data", chunk => output.push(chunk));
    ffmpeg.stderr.on("data", chunk => { errorOutput += chunk.toString(); });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", code => {
      if (code === 0) resolve(Buffer.concat(output));
      else reject(new Error(`Audio conversion failed: ${errorOutput || code}`));
    });
    ffmpeg.stdin.end(inputBuffer);
  });
}

export async function transcribeWithPrisma(file) {
  if (!process.env.GNANI_API_KEY) throw new Error("GNANI_API_KEY is missing in server/.env");

  const wavBuffer = await convertToWav(file.buffer);
  const form = new FormData();
  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  form.append("audio_file", blob, "voice-recording.wav");
  // Prisma v2.5 is the default when model is omitted.
  form.append("language_code", "hi-IN");

  const response = await fetch(`${API_BASE}/stt/v3`, {
    method: "POST",
    headers: { "X-API-Key-ID": process.env.GNANI_API_KEY },
    body: form
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gnani Prisma error (${response.status}): ${detail}`);
  }
  const data = await response.json();
  if (!data.transcript) throw new Error("Prisma returned no transcript");
  return data;
}

export async function speakWithTimbre(text) {
  if (!process.env.GNANI_API_KEY) throw new Error("GNANI_API_KEY is missing in server/.env");

  const response = await fetch(`${API_BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: {
      "X-API-Key-ID": process.env.GNANI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      model: "timbre-v2.5",
      language: "hi-IN",
      voice: "Nalini",
      audio_config: {
        encoding: "linear_pcm",
        container: "wav",
        num_channels: 1,
        sample_rate: 24000,
        sample_width: 2
      }
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gnani Timbre error (${response.status}): ${detail}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
