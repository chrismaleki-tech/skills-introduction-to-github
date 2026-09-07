import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Durable audio storage.
 * - With S3/R2 env: stores as `s3:<key>` and reads via GetObject
 * - Without: local `uploads/` as `local:<relativePath>` (dev / demo only)
 */

function s3Configured() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

function s3(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export function storageBackend(): "s3" | "local" {
  return s3Configured() ? "s3" : "local";
}

export async function storeAudio(opts: {
  orgId: string;
  ext: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const key = `orgs/${opts.orgId}/calls/${randomUUID()}.${opts.ext.replace(/^\./, "")}`;

  if (s3Configured()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.contentType,
      }),
    );
    return `s3:${key}`;
  }

  const relative = path.join("uploads", path.basename(key));
  await mkdir(path.join(process.cwd(), "uploads"), { recursive: true });
  await writeFile(path.join(process.cwd(), relative), opts.buffer);
  return `local:${relative}`;
}

export async function readAudio(audioPath: string): Promise<{ buffer: Buffer; ext: string }> {
  // Back-compat: bare relative paths from pre-Phase-0 uploads
  if (!audioPath.includes(":")) {
    const full = path.isAbsolute(audioPath)
      ? audioPath
      : path.join(/* turbopackIgnore: true */ process.cwd(), audioPath);
    return { buffer: await readFile(full), ext: path.extname(full) };
  }

  const [scheme, ...rest] = audioPath.split(":");
  const ref = rest.join(":");

  if (scheme === "s3") {
    const out = await s3().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: ref }),
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty object body");
    return { buffer: Buffer.from(bytes), ext: path.extname(ref) };
  }

  if (scheme === "local") {
    const full = path.join(/* turbopackIgnore: true */ process.cwd(), ref);
    return { buffer: await readFile(full), ext: path.extname(ref) };
  }

  throw new Error(`Unknown audio storage scheme: ${scheme}`);
}
