#!/usr/bin/env node
/**
 * One-shot copy of explanation audio from the container volume into the S3-compatible
 * bucket.
 *
 * MUST run where the volume is mounted — i.e. on Railway (`railway run` / the service
 * shell), not on a laptop, where /mnt/audio does not exist.
 *
 * Idempotent: a file already in the bucket at the same size is skipped, so re-running
 * after a partial run is safe and cheap.
 *
 * Nothing is deleted. The volume keeps every file, so afterwards you have two copies —
 * which is the entire point.
 *
 *   node scripts/migrate-audio-to-bucket.mjs            # copy
 *   node scripts/migrate-audio-to-bucket.mjs --dry-run  # report only
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DRY_RUN = process.argv.includes("--dry-run");

const AUDIO_DIR = process.env.AUDIO_DIR
  ? resolve(process.env.AUDIO_DIR)
  : resolve("/mnt", "audio");

const CONTENT_TYPES = {
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

const endpoint = process.env.AWS_ENDPOINT_URL;
const bucket = process.env.AWS_S3_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_DEFAULT_REGION || "us-east-1";

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "Missing bucket config. Need AWS_ENDPOINT_URL, AWS_S3_BUCKET_NAME, " +
      "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.",
  );
  process.exit(1);
}

const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

async function alreadyThere(key, size) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength === size;
  } catch {
    return false;
  }
}

const files = (await readdir(AUDIO_DIR)).filter(
  (f) => extname(f).toLowerCase() in CONTENT_TYPES,
);
console.log(`${AUDIO_DIR}: ${files.length} audio file(s)`);
console.log(`bucket: ${bucket} @ ${endpoint}${DRY_RUN ? "  [DRY RUN]" : ""}\n`);

let copied = 0;
let skipped = 0;
let failed = 0;
let bytes = 0;

for (const name of files) {
  const path = resolve(AUDIO_DIR, name);
  let size;
  try {
    size = (await stat(path)).size;
  } catch (err) {
    console.error(`  FAIL  ${name} — cannot stat: ${err.message}`);
    failed++;
    continue;
  }

  if (await alreadyThere(name, size)) {
    skipped++;
    continue;
  }
  if (DRY_RUN) {
    console.log(`  copy  ${name} (${size} bytes)`);
    copied++;
    bytes += size;
    continue;
  }
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: name,
        Body: await readFile(path),
        ContentType: CONTENT_TYPES[extname(name).toLowerCase()],
      }),
    );
    copied++;
    bytes += size;
    if (copied % 25 === 0) console.log(`  … ${copied} copied`);
  } catch (err) {
    console.error(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

console.log(
  `\ncopied ${copied}, already present ${skipped}, failed ${failed} ` +
    `(${(bytes / 1024 / 1024).toFixed(1)} MB${DRY_RUN ? " would be" : ""} transferred)`,
);
console.log("The volume was not modified — every file is still there.");
process.exit(failed > 0 ? 1 : 0);
