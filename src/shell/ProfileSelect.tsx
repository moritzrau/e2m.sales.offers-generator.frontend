import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../api/client";
import type { Profile } from "../api/types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

interface Props {
  onSelected: () => void;
}

export function ProfileSelect({ onSelected }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);

  const profilesQuery = useQuery<Profile[]>({
    queryKey: ["profiles"],
    queryFn: () => api.get<Profile[]>("/api/profiles"),
  });

  const selectMutation = useMutation({
    mutationFn: (profileId: number) => api.post<Profile>("/api/profiles/select", { profile_id: profileId }),
    onSuccess: onSelected,
    onError: (err) => setError(String(err)),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Profile>("/api/profiles", {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role: role.trim() || null,
      }),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      selectMutation.mutate(profile.id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const profiles = profilesQuery.data ?? [];

  return (
    <div className="profile-screen">
      <div className="profile-shell">
        <h1>e2m Sales Tool</h1>
        <p className="muted">Wer arbeitet gerade?</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="profile-grid">
          {profilesQuery.isLoading && <p className="muted">Lade Profile …</p>}
          {profiles.map((profile) => (
            <button
              key={profile.id}
              className="profile-card"
              onClick={() => selectMutation.mutate(profile.id)}
              disabled={selectMutation.isPending}
            >
              <span className="profile-avatar">{initials(profile.name)}</span>
              <span className="profile-name">{profile.name}</span>
              {profile.role && <span className="profile-role">{profile.role}</span>}
            </button>
          ))}

          <button className="profile-card profile-card--new" onClick={() => setShowForm((v) => !v)}>
            <span className="profile-avatar profile-avatar--new">+</span>
            <span className="profile-name">Neues Profil</span>
          </button>
        </div>

        {showForm && (
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              if (!name.trim()) {
                setError("Bitte einen Namen angeben.");
                return;
              }
              createMutation.mutate();
            }}
          >
            <label>
              Name*
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />
            </label>
            <label>
              E-Mail
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vorname.nachname@e2m.de" />
            </label>
            <label>
              Telefon
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" />
            </label>
            <label>
              Rolle
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="z. B. Business Development" />
            </label>
            <p className="muted profile-form-hint">
              Name, Rolle und Kontaktdaten erscheinen später auf den personalisierten Angebotsfolien.
            </p>
            <button type="submit" className="primary-btn" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Lege an …" : "Profil anlegen"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
