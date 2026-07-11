import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "../../../api/client";
import type { Block, BlocksList, Preset } from "../../../api/types";

interface Props {
  blocks: BlocksList;
  composition: string[];
  onChange: (composition: string[]) => void;
  useCase: string;
}

const CATEGORY_LABEL: Record<Block["category"], string> = {
  pflicht: "Pflicht",
  standard: "Standard",
  optional: "Optional",
};

export function StepBlocks({ blocks, composition, onChange, useCase }: Props) {
  const queryClient = useQueryClient();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetScope, setPresetScope] = useState<"private" | "team">("private");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const blockById = useMemo(() => {
    const m = new Map<string, Block>();
    for (const b of blocks.blocks) m.set(b.id, b);
    return m;
  }, [blocks.blocks]);

  const selected = new Set(composition);
  const inactive = blocks.blocks.filter((b) => !selected.has(b.id));

  const presets = useQuery<Preset[]>({
    queryKey: ["composition-presets", useCase],
    queryFn: () => api.get<Preset[]>(`/api/composition-presets?use_case=${useCase}`),
  });

  const saveDefault = useMutation<void, ApiError, void>({
    mutationFn: async () => {
      setError(null);
      setInfo(null);
      await api.put("/api/me/default-compositions", {
        use_case: useCase,
        composition,
      });
    },
    onSuccess: () => {
      setInfo("Als dein Standard für diesen Use Case gespeichert.");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => setError(err.message),
  });

  const savePreset = useMutation<Preset, ApiError, void>({
    mutationFn: async () => {
      setError(null);
      setInfo(null);
      if (presetName.trim().length === 0) {
        throw new ApiError(400, "Bitte einen Namen vergeben.");
      }
      return api.post<Preset>("/api/composition-presets", {
        name: presetName.trim(),
        use_case: useCase,
        composition,
        share_scope: presetScope,
      });
    },
    onSuccess: (p) => {
      setInfo(`Preset „${p.name}" gespeichert.`);
      setPresetName("");
      queryClient.invalidateQueries({ queryKey: ["composition-presets", useCase] });
    },
    onError: (err) => setError(err.message),
  });

  const applyPreset = (preset: Preset) => {
    onChange(preset.composition);
    setInfo(`Preset „${preset.name}" übernommen.`);
    setError(null);
  };

  const reset = () => {
    onChange(blocks.default_composition);
    setInfo(null);
    setError(null);
  };

  const toggle = (block: Block, isOn: boolean) => {
    if (block.category === "pflicht") return;
    if (isOn) {
      if (!selected.has(block.id)) onChange([...composition, block.id]);
    } else {
      onChange(composition.filter((id) => id !== block.id));
    }
  };

  const moveByDrag = (from: number, to: number) => {
    if (from === to) return;
    const next = [...composition];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="wizard-step">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h3>4. Angebot zusammenstellen</h3>
          <p className="muted">
            Reihenfolge per Drag &amp; Drop. Pflicht-Blöcke sind fixiert und
            lassen sich nicht abwählen.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button className="link-btn" onClick={reset}>
            Auf Standard zurücksetzen
          </button>
          <button
            className="link-btn"
            onClick={() => saveDefault.mutate()}
            disabled={saveDefault.isPending}
          >
            Als meinen Standard speichern
          </button>
        </div>
      </div>

      {info && (
        <div
          className="precheck-box"
          style={{ background: "var(--color-primary-soft)" }}
        >
          {info}
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}

      <h4>Preset laden</h4>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {presets.isLoading && <span className="muted">Lade …</span>}
        {presets.data && presets.data.length === 0 && (
          <span className="muted">Noch keine Presets angelegt.</span>
        )}
        {presets.data?.map((p) => (
          <button
            key={p.id}
            className="link-btn"
            title={`${p.composition.length} Blöcke — ${p.share_scope === "team" ? "Team" : "privat"}`}
            onClick={() => applyPreset(p)}
            style={{
              padding: "0.35rem 0.75rem",
              border: "1px solid var(--color-border)",
              borderRadius: 999,
              minHeight: 0,
            }}
          >
            {p.name}
            {p.share_scope === "team" && (
              <span className="badge badge--info" style={{ marginLeft: "0.4rem" }}>
                Team
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: "0.75rem",
          display: "flex",
          gap: "0.4rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Name des Presets"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          style={{
            padding: "0.4rem 0.7rem",
            border: "1px solid var(--color-border)",
            borderRadius: 9,
            flex: "1 1 200px",
          }}
        />
        <select
          value={presetScope}
          onChange={(e) => setPresetScope(e.target.value as "private" | "team")}
          style={{
            padding: "0.4rem 0.7rem",
            border: "1px solid var(--color-border)",
            borderRadius: 9,
          }}
        >
          <option value="private">Privat</option>
          <option value="team">Team-weit</option>
        </select>
        <button
          className="link-btn"
          onClick={() => savePreset.mutate()}
          disabled={savePreset.isPending || presetName.trim().length === 0}
        >
          Als Preset speichern
        </button>
      </div>

      <h4 style={{ marginTop: "1.25rem" }}>Reihenfolge ({composition.length} Blöcke)</h4>
      <ol className="block-list" style={{ paddingLeft: 0, counterReset: "block-order" }}>
        {composition.map((blockId, idx) => {
          const block = blockById.get(blockId);
          if (!block) return null;
          const isDragged = dragIndex === idx;
          return (
            <li
              key={blockId}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) moveByDrag(dragIndex, idx);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`block-item checked`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.7rem",
                marginBottom: "0.35rem",
                opacity: isDragged ? 0.4 : 1,
                cursor: "grab",
              }}
            >
              <span
                style={{
                  width: "1.8rem",
                  textAlign: "right",
                  color: "var(--color-muted)",
                  fontSize: "0.85rem",
                }}
              >
                {idx + 1}
              </span>
              <span style={{ color: "var(--color-muted)", cursor: "grab" }} aria-hidden>
                ⋮⋮
              </span>
              <div style={{ flex: 1 }}>
                <strong>{block.label}</strong>{" "}
                <span
                  className={`badge ${
                    block.category === "pflicht" ? "badge--info" : "badge--muted"
                  }`}
                >
                  {CATEGORY_LABEL[block.category]}
                </span>
                {block.personalized && (
                  <span className="badge badge--info" title="Personalisierter Block">
                    personalisiert
                  </span>
                )}
                {block.may_be_missing && (
                  <span className="badge badge--muted" title="Folie noch nicht im Master">
                    Folie folgt
                  </span>
                )}
                {block.description && <p className="muted">{block.description}</p>}
              </div>
              {block.category !== "pflicht" && (
                <button
                  className="link-btn"
                  onClick={() => toggle(block, false)}
                  title="Entfernen"
                  style={{ color: "var(--color-muted)" }}
                >
                  Entfernen
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {inactive.length > 0 && (
        <>
          <h4 style={{ marginTop: "1.25rem" }}>Nicht aktive Blöcke</h4>
          <ul className="block-list">
            {inactive.map((block) => (
              <li
                key={block.id}
                className="block-item"
                style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{block.label}</strong>{" "}
                  <span className="badge badge--muted">{CATEGORY_LABEL[block.category]}</span>
                  {block.description && <p className="muted">{block.description}</p>}
                </div>
                <button className="link-btn" onClick={() => toggle(block, true)}>
                  Aufnehmen
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
