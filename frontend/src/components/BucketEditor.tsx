"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/types";
import { WordHead } from "./WordHead";

type Props = {
  cards: Flashcard[];
  onAdd: (hanzi: string, pinyin: string, jyutping: string, definition: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Flashcard>) => Promise<void>;
};

export function BucketEditor({ cards, onAdd, onRemove, onUpdate }: Props) {
  const [hanzi, setHanzi] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [jyutping, setJyutping] = useState("");
  const [definition, setDefinition] = useState("");
  const [adding, setAdding] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hanzi.trim()) return;
    setAdding(true);
    await onAdd(hanzi.trim(), pinyin.trim(), jyutping.trim(), definition.trim());
    setHanzi("");
    setPinyin("");
    setJyutping("");
    setDefinition("");
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      <form className="card grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_2fr_auto]" onSubmit={submit}>
        <input
          className="input hanzi text-base"
          placeholder="汉字 (Chinese)"
          value={hanzi}
          onChange={(e) => setHanzi(e.target.value)}
        />
        <input
          className="input"
          placeholder="jyutping (optional)"
          value={jyutping}
          onChange={(e) => setJyutping(e.target.value)}
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
          , click any unfamiliar word, and press <b>Add to flashcards</b>.
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
  const [jyutping, setJyutping] = useState(card.jyutping ?? "");
  const [definition, setDefinition] = useState(card.definition);

  async function save() {
    await onUpdate({ pinyin, jyutping, definition });
    setEditing(false);
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 p-3 md:grid-cols-[minmax(140px,180px)_1fr_auto]">
      <WordHead
        hanzi={card.hanzi}
        pinyin={card.pinyin}
        jyutping={card.jyutping}
        size="sm"
        showAltScript={false}
      />
      {editing ? (
        <div className="space-y-2">
          <input
            className="input text-sm"
            placeholder="jyutping"
            value={jyutping}
            onChange={(e) => setJyutping(e.target.value)}
          />
          <input
            className="input text-sm"
            placeholder="pinyin"
            value={pinyin}
            onChange={(e) => setPinyin(e.target.value)}
          />
          <input
            className="input text-sm"
            placeholder="definition"
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
          />
        </div>
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
