/**
 * Soft Dis-Play — TypeScript型定義（SDD設計書に基づく）
 */

/** カード1枚の定義 */
export type Card = {
  id: string;
  type: 'insult' | 'cushion' | 'noun' | 'particle';
  category: string;
  text: string;
};

/** プレイヤーの手札 */
export type Hand = {
  insults: Card[];   // 悪口カード
  cushions: Card[];  // クッション言葉カード
  nouns: Card[];     // 名詞カード
  particles: Card[]; // 助詞カード
};

/** プレイヤー */
export type Player = {
  id: string;
  room_id: string;
  name: string;
  score: number;
  hand: Hand;
};

/** 1ラウンドでプレイヤーが提出した文章（カードの順序付き配列） */
export type Play = {
  playerId: string;
  playerName: string;
  sentence: Card[]; // 語順通りに並べたカードの配列
};

/** ゲームのフェーズ */
export type GamePhase =
  | 'waiting'    // 参加者を待っている
  | 'exchange'   // カード交換フェーズ
  | 'select'     // カード選択フェーズ
  | 'reveal'     // 発表フェーズ
  | 'vote'       // 投票フェーズ
  | 'result'     // ラウンド結果フェーズ
  | 'gameover';  // ゲーム終了

/** ゲーム状態（Supabase game_states テーブルと対応） */
export type GameState = {
  id: string;
  room_id: string;
  phase: GamePhase;
  round: number;
  total_rounds: number;
  plays: Play[];
  votes: Record<string, string>; // { 投票者プレイヤーID: 投票先プレイヤーID }
  updated_at?: string;
};

/** ルーム */
export type Room = {
  id: string;
  code: string;       // 6桁の入室コード
  host_id: string;
  status: 'waiting' | 'playing' | 'finished';
  total_rounds: number;
  created_at?: string;
};

/** フェーズごとのタイムリミット（秒） */
export const PHASE_TIME_LIMITS: Partial<Record<GamePhase, number>> = {
  exchange: 30,
  select: 60,
  vote: 30,
};

/** 手札枚数 */
export const HAND_SIZE = {
  insults: 3,
  cushions: 3,
  nouns: 2,
  particles: 2,
} as const;

/** 1ラウンドの交換可能枚数上限 */
export const MAX_EXCHANGE_PER_ROUND = 2;
