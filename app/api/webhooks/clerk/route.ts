import { headers } from "next/headers";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabase";

// Clerk sends a signed POST request to this endpoint whenever a user
// is created, updated, or deleted. We use the signing secret to verify
// the request is genuinely from Clerk, then sync the user into our
// profiles table in Supabase.

type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email_addresses: { email_address: string }[];
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Grab the Svix signature headers Clerk sends with every webhook
  const headerPayload = await headers();
  const svixId        = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Verify the payload signature — rejects anything not signed by Clerk
  const payload = await req.text();
  const wh = new Webhook(secret);
  let event: ClerkUserEvent;

  try {
    event = wh.verify(payload, {
      "svix-id":        svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  // Handle user.created — create a profile row in Supabase
  if (event.type === "user.created") {
    const { id, username, first_name, last_name, image_url } = event.data;

    // Build a username: prefer Clerk username, fall back to first+last name,
    // fall back to the Clerk user ID so the column is never null.
    const resolvedUsername =
      username ||
      [first_name, last_name].filter(Boolean).join("").toLowerCase() ||
      `user_${id.slice(-8)}`;

    const displayName =
      [first_name, last_name].filter(Boolean).join(" ") || resolvedUsername;

    const { error } = await supabaseAdmin.from("profiles").insert({
      clerk_user_id: id,
      username:      resolvedUsername,
      display_name:  displayName,
      avatar_url:    image_url,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response("Failed to create profile", { status: 500 });
    }
  }

  // Handle user.updated — keep display name and avatar in sync
  if (event.type === "user.updated") {
    const { id, first_name, last_name, image_url } = event.data;

    const displayName =
      [first_name, last_name].filter(Boolean).join(" ") || null;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: displayName, avatar_url: image_url })
      .eq("clerk_user_id", id);

    if (error) {
      console.error("Supabase update error:", error);
      return new Response("Failed to update profile", { status: 500 });
    }
  }

  // Handle user.deleted — remove the profile (cascades to reviews, etc.)
  if (event.type === "user.deleted") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("clerk_user_id", event.data.id);

    if (error) {
      console.error("Supabase delete error:", error);
      return new Response("Failed to delete profile", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
