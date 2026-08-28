import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stderr }));
  });
}

// Browser-recorded webm files from MediaRecorder often carry an imprecise
// duration in their container header, so `-i <file>` with no output (which
// still makes ffmpeg probe and print it before erroring on the missing
// output) is more reliable here than trusting `-shortest` to reconcile two
// streams copied/encoded at different rates — see dubVideo for why.
async function probeDuration(filePath) {
  const { stderr } = await runFfmpeg(['-i', filePath]);
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not determine duration of ${filePath}`);
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// Combines the original recording's video track with a new audio track (the
// cloned-voice narration of a style variant's rewritten text). The video
// stream is copied as-is (no re-encode, fast); only the new audio is
// encoded. The rewritten narration is essentially never the same length as
// the original, so both streams are explicitly trimmed to whichever is
// shorter via "-t" — relying on ffmpeg's own "-shortest" to reconcile a
// copied video stream against a freshly-encoded audio stream proved
// unreliable in testing (it cut the video far shorter than either stream's
// actual length), leaving the video frozen on its last frame while the
// audio kept playing.
export async function dubVideo({ videoPath, audioPath, outputPath }) {
  const [videoDuration, audioDuration] = await Promise.all([probeDuration(videoPath), probeDuration(audioPath)]);
  const targetDuration = Math.min(videoDuration, audioDuration).toFixed(2);

  const { code, stderr } = await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'libopus',
    '-t', targetDuration,
    outputPath,
  ]);
  if (code !== 0) throw new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`);
}
