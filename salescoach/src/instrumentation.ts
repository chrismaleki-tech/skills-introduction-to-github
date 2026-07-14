export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionConfig } = await import("./lib/config");
    try {
      assertProductionConfig();
    } catch (err) {
      console.error("[salescoach] production config check failed:", err);
      if (process.env.NODE_ENV === "production") throw err;
    }
  }
}
