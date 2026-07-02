// The Press Box — Courtside's disclosed house-critic accounts.
// Seeded by scripts/pressbox/seed.ts; their profiles carry a clerk_user_id
// starting with "bot_" (they have no real Clerk account). Any surface showing
// their content should render <PressBoxTag /> so readers know it's the house,
// not the community.

export function isPressBox(clerkUserId: string | null | undefined): boolean {
  return !!clerkUserId?.startsWith("bot_");
}
