"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/profile/[username]/edit/actions";
import AvatarPicker from "@/components/AvatarPicker";
import {
  type AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
} from "@/lib/avatarTemplates";

interface Props {
  username:          string;
  initialDisplayName: string;
  initialBio:        string;
  initialAvatar:     AvatarConfig | null;
}

export default function ProfileEditForm({
  username,
  initialDisplayName,
  initialBio,
  initialAvatar,
}: Props) {
  const [displayName,  setDisplayName]  = useState(initialDisplayName);
  const [bio,          setBio]          = useState(initialBio);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(
    initialAvatar ?? DEFAULT_AVATAR_CONFIG
  );
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();
  const router = useRouter();

  // Derive initials for preview
  const initials = (displayName || username).replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2) || (username[0] ?? "?");

  function handleAvatarChange(next: AvatarConfig) {
    setAvatarConfig(next);
    setSaved(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveProfile(username, { displayName, bio, avatarConfig });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-8">

      {/* Display name */}
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-text-dim mb-2">
          Display Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setSaved(false); setError(null); }}
          maxLength={60}
          placeholder={username}
          className="w-full font-mono text-sm text-text-primary rounded-lg px-4 py-2.5 outline-none transition-all duration-150 placeholder:text-text-dim"
          style={{
            background: "rgba(255,255,255,0.04)",
            border:     "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,214,138,0.4)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
        />
        <p className="font-sans text-[10px] text-text-dim mt-1.5">
          This is your public name — shown on your profile, reviews, and in the activity feed. Use your real name, a nickname, or an alias. {displayName.length}/60
        </p>
      </div>

      {/* Bio */}
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-text-dim mb-2">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => { setBio(e.target.value); setSaved(false); setError(null); }}
          maxLength={280}
          rows={3}
          placeholder="Tell the community about your tennis fandom…"
          className="w-full font-sans text-sm text-text-primary rounded-lg px-4 py-2.5 outline-none resize-none transition-all duration-150 placeholder:text-text-dim leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.04)",
            border:     "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,214,138,0.4)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
        />
        <p className="font-sans text-[10px] text-text-dim mt-1.5">
          {bio.length}/280 characters
        </p>
      </div>

      {/* Avatar */}
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-text-dim mb-4">
          Avatar
        </label>
        <div
          className="rounded-xl p-5"
          style={{
            background: "rgba(255,255,255,0.02)",
            border:     "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <AvatarPicker
            value={avatarConfig}
            initials={initials}
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="font-sans text-sm text-red-400">{error}</p>
      )}

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className={`font-mono text-sm px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${saved ? "btn-confirmed" : "btn-solid"}`}
          style={{
            opacity:    isPending ? 0.6 : 1,
            cursor:     isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
        {saved && (
          <span className="font-sans text-sm text-text-dim">
            Your profile has been updated.
          </span>
        )}
      </div>
    </div>
  );
}
