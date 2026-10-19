export async function captureError(
  error: unknown,
  context: Record<string, string | number | boolean | null | undefined>,
) {
  const message = error instanceof Error ? error.message : String(error);
  const event = {
    level: "error",
    message,
    context,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(event));

  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `Erota Sales Intelligence error: ${message}`,
        event,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (alertError) {
    console.error("Failed to deliver monitoring alert", alertError);
  }
}
