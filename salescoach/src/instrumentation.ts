export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionConfig } = await import("./lib/env");
    assertProductionConfig();
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
) {
  const { captureError } = await import("./lib/monitoring");
  await captureError(error, {
    operation: "unhandled_request",
    path: request.path,
    method: request.method,
  });
}
