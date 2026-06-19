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
        <button className="btn-primary w-full md:w-auto" disabled={adding || !hanzi.trim()}>
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
    <div
      className={
        editing
          ? "flex flex-col gap-2 p-2 sm:p-3 md:grid md:grid-cols-[minmax(140px,180px)_1fr_auto] md:items-start md:gap-3"
          : "flex items-center gap-2 p-2 sm:p-3 md:grid md:grid-cols-[minmax(140px,180px)_1fr_auto] md:items-start md:gap-3"
      }
    >
      <WordHead
        hanzi={card.hanzi}
        hanziTraditional={card.hanziTraditional}
        pinyin={card.pinyin}
        jyutping={card.jyutping}
        size="xs"
        showAltScript={false}
        inlineRomanization
        className="w-[4.25rem] shrink-0 md:w-auto"
      />
      {editing ? (
        <div className="space-y-2 md:col-span-1">
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
        <div className="min-w-0 flex-1 text-xs leading-snug text-ink/80 line-clamp-2 md:text-sm md:leading-normal md:line-clamp-none">
          {card.definition || <span className="text-ink/40">No definition</span>}
        </div>
      )}
      <div className="flex shrink-0 flex-row gap-1 md:flex-col md:gap-2">
        {editing ? (
          <>
            <button className="btn-outline !min-h-8 !min-w-0 px-2.5 py-1 text-xs md:min-h-[44px] md:px-3 md:py-2 md:text-sm" onClick={save}>
              Save
            </button>
            <button className="btn-outline !min-h-8 !min-w-0 px-2.5 py-1 text-xs md:min-h-[44px] md:px-3 md:py-2 md:text-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn-outline !min-h-8 !min-w-0 px-2.5 py-1 text-xs md:min-h-[44px] md:px-3 md:py-2 md:text-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="btn-outline !min-h-8 !min-w-0 px-2.5 py-1 text-xs text-red-600 md:min-h-[44px] md:px-3 md:py-2 md:text-sm"
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
