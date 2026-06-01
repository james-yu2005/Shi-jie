// Types shared between the API routes and React components.
export type DictEntry = {
  traditional: string;
  simplified: string;
  pinyin_numbered: string;
  pinyin: string;
  definitions: string[];
};

export type CharStroke = {
  char: string;
  stroke_animated_svg: string | null;
  stroke_still_svg: string | null;
  stroke_data_json: string | null;
};

export type DictLookup = {
  word: string;
  entries: DictEntry[];
  characters: CharStroke[];
  audio_url: string;
};

export type Flashcard = {
  id: string;
  hanzi: string;
  pinyin: string;
  definition: string;
  notes?: string | null;
  dueAt?: string | null;
  interval: number;
  ease: number;
  reviewCount: number;
  createdAt: string;
};

export type GameAttempt = {
  prompt: string;
  score: number;
  solved: boolean;
  missing_elements: string[];
  grammar_errors: { wrong: string; correct: string; explanation: string }[];
  hint: string;
  reveal: string | null;
};

export type DailyDifficulty = "easy" | "medium" | "hard";

export type DailyGame = {
  id: string;
  dayKey: string;
  imageUrl: string;
  targetDesc: string | null;
  attempts: GameAttempt[];
  attemptsUsed: number;
  solved: boolean;
  difficulty: DailyDifficulty | null;
};

export type DailyHistoryEntry = {
  dayKey: string;   // YYYY-MM-DD
  solved: boolean;
  attemptsUsed: number;
};

export type DailyStats = {
  streak: number;
  history: DailyHistoryEntry[]; // last 30 days
};

// ----- Knowledge graph -----
export type KgEdgeType = "meaning" | "character";

export type KgNode = {
  id: string;
  hanzi: string;
  pinyin: string;
  definition: string;
  radicals: string[];
  components: string[];
  semanticTags: string[];
  notes?: string | null;
  createdAt: string;
};

export type KgEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  type: KgEdgeType;
  reason: string;
  weight: number;
};

export type KgGraph = {
  nodes: KgNode[];
  edges: KgEdge[];
};

export type KgSuggestion = {
  hanzi: string;
  pinyin: string;
  definition: string;
  reason: string;
};
