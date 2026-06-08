"use client";
import { useState } from "react";
import type { Flashcard } from "@/lib/types";

type Props = {
  cards: Flashcard[];
  onAdd: (hanzi: string, pinyin: string, definition: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Flashcard>) => Promise<void>;
};

export function BucketEditor({ cards, onAdd, onRemove, onUpdate }: Props) {
  const [hanzi, setHanzi] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [definition, setDefinition] = useState("");
  const [adding, setAdding] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hanzi.trim()) return;
    setAdding(true);
    await onAdd(hanzi.trim(), pinyin.trim(), definition.trim());
    setHanzi("");
    setPinyin("");
    setDefinition("");
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      <form className="card grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_2fr_auto]" onSubmit={submit}>
        <input
          className="input hanzi text-base"
          placeholder="汉字 (Chinese)"
          value={hanzi}
          onChange={(e) => setHanzi(e.target.value)}
        />
        <input
          className="input"
          placeholder="pinyin (optional)"
          value={pinyin}
          onChange={(e) => setPinyin(e.target.value)}
        />
        <input
          className="input"
          placeholder="english definition (optional)"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
        />
        <button className="btn-primary" disabled={adding || !hanzi.trim()}>
          {adding ? "Adding…" : "+ Add"}
        </button>
      </form>

      {cards.length === 0 ? (
        <div className="subtle-card text-sm text-ink/70">
          Your bucket is empty. Add a word above, or jump to the{" "}
          <a href="/" className="font-medium text-accent hover:underline">
            Smart Reader
          </a>
          , click any unfamiliar word, and press <b>Add to bucket</b>.
        </div>
      ) : (
        <div className="card divide-y divide-ink/10 p-0">
          {cards.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              onRemove={() => onRemove(c.id)}
              onUpdate={(patch) => onUpdate(c.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardRow({
  card,
  onRemove,
  onUpdate,
}: {
  card: Flashcard;
  onRemove: () => Promise<void>;
  onUpdate: (patch: Partial<Flashcard>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [pinyin, setPinyin] = useState(card.pinyin);
  const [definition, setDefinition] = useState(card.definition);

  async function save() {
    await onUpdate({ pinyin, definition });
    setEditing(false);
  }

  return (
    <div className="grid grid-cols-[100px_140px_1fr_auto] items-center gap-3 p-3">
      <div className="hanzi text-xl">{card.hanzi}</div>
      {editing ? (
        <input
          className="input text-sm"
          value={pinyin}
          onChange={(e) => setPinyin(e.target.value)}
        />
      ) : (
        <div className="text-sm text-ink/70">{card.pinyin}</div>
      )}
      {editing ? (
        <input
          className="input text-sm"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
        />
      ) : (
        <div className="text-sm">{card.definition}</div>
      )}
      <div className="flex gap-2">
        {editing ? (
          <>
            <button className="btn-outline" onClick={save}>
              Save
            </button>
            <button className="btn-outline" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn-outline" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="btn-outline text-red-600"
              onClick={onRemove}
              title="Remove from bucket"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}
