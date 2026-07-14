import { createHash, createHmac, randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { objectStorageConfigured } from "./config";

/**
 * Audio / blob storage.
 * - Default: local `uploads/` (dev / single-node).
 * - Production: set S3_BUCKET + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY (+ optional
 *   S3_REGION, S3_ENDPOINT for MinIO/R2) to store objects in S3-compatible storage.
 *
 * Paths stored on Call.audioPath are either relative (`uploads/...`) or `s3://bucket/key`.
 */

const LOCAL_DIR = "uploads";

export async function putObject(
  bytes: Buffer,
  opts: { ext: string; contentType?: string; keyPrefix?: string },
): Promise<{ path: string; contentType: string }> {
  const ext = opts.ext.replace(/^\./, "").toLowerCase();
  const contentType = opts.contentType || guessContentType(ext);
  const key = `${opts.keyPrefix ?? "calls"}/${randomUUID()}.${ext}`;

  if (objectStorageConfigured()) {
    const bucket = process.env.S3_BUCKET!;
    await s3Put(bucket, key, bytes, contentType);
    return { path: `s3://${bucket}/${key}`, contentType };
  }

  const relativePath = path.join(LOCAL_DIR, path.basename(key));
  await mkdir(path.join(/*turbopackIgnore: true*/ process.cwd(), LOCAL_DIR), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ process.cwd(), relativePath), bytes);
  return { path: relativePath, contentType };
}

export async function getObject(storedPath: string): Promise<Buffer> {
  if (storedPath.startsWith("s3://")) {
    const { bucket, key } = parseS3Uri(storedPath);
    return s3Get(bucket, key);
  }
  const filePath = path.isAbsolute(storedPath)
    ? storedPath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
  return readFile(filePath);
}

export async function deleteObject(storedPath: string | null | undefined): Promise<boolean> {
  if (!storedPath) return false;
  try {
    if (storedPath.startsWith("s3://")) {
      const { bucket, key } = parseS3Uri(storedPath);
      await s3Delete(bucket, key);
      return true;
    }
    const filePath = path.isAbsolute(storedPath)
      ? storedPath
      : path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

function guessContentType(ext: string) {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    webm: "audio/webm",
    ogg: "audio/ogg",
  };
  return map[ext] ?? "application/octet-stream";
}

function parseS3Uri(uri: string) {
  const without = uri.replace(/^s3:\/\//, "");
  const slash = without.indexOf("/");
  if (slash < 0) throw new Error(`Invalid S3 URI: ${uri}`);
  return { bucket: without.slice(0, slash), key: without.slice(slash + 1) };
}

// --- Minimal SigV4 S3 client (no AWS SDK dependency) ---

function s3Endpoint(bucket: string) {
  const custom = process.env.S3_ENDPOINT?.replace(/\/$/, "");
  if (custom) return { host: new URL(custom).host, url: `${custom}/${bucket}`, pathStyle: true };
  const region = process.env.S3_REGION || "us-east-1";
  return {
    host: `${bucket}.s3.${region}.amazonaws.com`,
    url: `https://${bucket}.s3.${region}.amazonaws.com`,
    pathStyle: false,
  };
}

async function s3Put(bucket: string, key: string, body: Buffer, contentType: string) {
  await s3Request("PUT", bucket, key, body, { "content-type": contentType });
}

async function s3Get(bucket: string, key: string): Promise<Buffer> {
  const res = await s3Request("GET", bucket, key);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function s3Delete(bucket: string, key: string) {
  await s3Request("DELETE", bucket, key);
}

async function s3Request(
  method: string,
  bucket: string,
  key: string,
  body?: Buffer,
  extraHeaders: Record<string, string> = {},
) {
  const accessKey = process.env.S3_ACCESS_KEY_ID!;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY!;
  const region = process.env.S3_REGION || "us-east-1";
  const { host, url: base, pathStyle } = s3Endpoint(bucket);
  const canonicalUri = pathStyle ? `/${bucket}/${key}` : `/${key}`;
  const url = pathStyle ? `${base}/${key}` : `${base}/${key}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(body ?? "").digest("hex");

  const headers: Record<string, string> = {
    host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...extraHeaders,
  };
  if (body) headers["content-length"] = String(body.length);

  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k].trim()}\n`).join("");
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const signingKey = getSignatureKey(secretKey, dateStamp, region, "s3");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, { method, headers, body: body ? new Uint8Array(body) : undefined });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 ${method} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res;
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = createHmac("sha256", `AWS4${key}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}
