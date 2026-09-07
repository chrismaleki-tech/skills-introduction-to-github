/** Auth mode: Clerk when keys are present; otherwise local demo cookie auth. */
export function isClerkEnabled() {
  return Boolean(
    process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
}

export function isDemoAuth() {
  return !isClerkEnabled();
}
