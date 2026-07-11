import type { Block, BlocksList } from "../../../api/types";

interface Props {
  blocks: BlocksList;
  composition: string[];
  onChange: (composition: string[]) => void;
}

const CATEGORY_LABEL: Record<Block["category"], string> = {
  pflicht: "Pflicht",
  standard: "Standard",
  optional: "Optional",
};

export function StepBlocks({ blocks, composition, onChange }: Props) {
  const groups: Record<Block["category"], Block[]> = { pflicht: [], standard: [], optional: [] };
  for (const b of blocks.blocks) groups[b.category].push(b);
  const selected = new Set(composition);

  const toggle = (block: Block) => {
    if (block.category === "pflicht") return; // nicht abwählbar
    if (selected.has(block.id)) {
      onChange(composition.filter((id) => id !== block.id));
    } else {
      // In Registry-Reihenfolge einfügen
      const order = blocks.blocks.map((b) => b.id);
      const nextSelected = new Set([...composition, block.id]);
      onChange(order.filter((id) => nextSelected.has(id)));
    }
  };

  const reset = () => onChange(blocks.default_composition);

  return (
    <div className="wizard-step">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h3>4. Angebot zusammenstellen</h3>
          <p className="muted">
            Pflicht-Blöcke sind fixiert. Standard-Blöcke sind vorbelegt. Optional-Blöcke lassen sich zusätzlich aufnehmen.
          </p>
        </div>
        <button className="link-btn" onClick={reset}>
          Auf Standard zurücksetzen
        </button>
      </div>

      {(["pflicht", "standard", "optional"] as const).map((cat) => (
        <div key={cat} className="block-group">
          <h4>{CATEGORY_LABEL[cat]}</h4>
          <ul className="block-list">
            {groups[cat].map((block) => {
              const isChecked = selected.has(block.id);
              const isDisabled = cat === "pflicht";
              return (
                <li key={block.id}>
                  <label className={`block-item ${isChecked ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => toggle(block)}
                    />
                    <div>
                      <strong>{block.label}</strong>
                      {block.personalized && (
                        <span className="badge badge--info" title="Ansprechpartner aus Profil">
                          personalisiert
                        </span>
                      )}
                      {block.may_be_missing && (
                        <span
                          className="badge badge--muted"
                          title="Folie im Master noch nicht vorhanden — wird beim Export übersprungen."
                        >
                          Folie folgt
                        </span>
                      )}
                      {block.requires_pricing_result && (
                        <span className="badge badge--muted" title="Benötigt gespeichertes Pricing-Ergebnis">
                          Pricing: {block.requires_pricing_result}
                        </span>
                      )}
                      {block.description && <p className="muted">{block.description}</p>}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
