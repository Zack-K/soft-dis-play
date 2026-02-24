# Soft Dis-Play MVP 実装計画書（SDD方式）

SDDの原則に従い、「型定義・インターフェース→ロジック→UIの順」で実装を進めます。

---

## MVPスコープ（最初のリリースに含めるもの）

| 含める | 含めない（V2以降） |
|---|---|
| ルーム作成・参加（コードで入室） | アカウント登録・ログイン |
| 手札管理・カード交換（最大2枚） | 特殊効果カード |
| カード選択・全員同時公開 | カード強度レーティング |
| 投票フェーズ | BGM・SE |
| ラウンド進行・スコア集計 | スマートフォン最適化 |
| Vercelへの公開デプロイ | |

---

## 1. プロジェクト基盤

### フォルダ構成（予定）

```
soft-dis-play/
├── src/
│   ├── app/           # Next.js App Router（各ページ）
│   │   ├── page.tsx             # トップ（ルーム作成/参加）
│   │   ├── room/[roomId]/       # ゲーム本体
│   │   │   └── page.tsx
│   ├── components/    # UIコンポーネント
│   │   ├── Card.tsx
│   │   ├── Hand.tsx
│   │   ├── VotePanel.tsx
│   │   └── ScoreBoard.tsx
│   ├── lib/           # ロジック・ユーティリティ
│   │   ├── deck.ts              # シャッフル・配布ロジック
│   │   ├── gamePhase.ts         # フェーズ遷移ロジック
│   │   └── supabase.ts          # Supabaseクライアント初期化
│   ├── types/         # TypeScript型定義（SDDの核心）
│   │   └── index.ts
│   └── data/
│       └── cards.json           # 作成済みカードデータ
├── .env.local                   # Supabase接続情報
└── ...
```

---

## 2. TypeScript型定義（仕様の核心）

SDD方式では、この型定義が「設計図」の役割を果たします。

```typescript
// src/types/index.ts

/** カード1枚の定義 */
type Card = {
  id: string;
  category: string;
  text: string;
};

/** プレイヤー */
type Player = {
  id: string;
  name: string;
  score: number;
  hand: {
    insults: Card[];    // 悪口カード（手札）
    cushions: Card[];   // クッション言葉カード（手札）
  };
};

/** 1ターンのプレイ内容 */
type Play = {
  playerId: string;
  insultCard: Card;
  cushionCard: Card;
};

/** ゲームのフェーズ */
type GamePhase =
  | 'waiting'    // 参加者を待っている
  | 'exchange'   // カード交換フェーズ
  | 'select'     // カード選択フェーズ
  | 'reveal'     // 全員の組み合わせを発表
  | 'vote'       // 投票フェーズ
  | 'result'     // ラウンド結果
  | 'gameover';  // ゲーム終了

/** ゲーム状態（Supabase game_state テーブルと対応） */
type GameState = {
  roomId: string;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  plays: Play[];       // 今ラウンドの全員の提出内容
  votes: Record<string, string>; // { 投票者ID: 投票先プレイヤーID }
};
```

---

## 3. Supabase データモデル

### テーブル設計

**`rooms` テーブル**
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | ルームID |
| code | varchar(6) | 入室コード（例: `ABX439`） |
| host_id | text | ルーム作成者のプレイヤーID |
| status | text | `waiting` / `playing` / `finished` |
| total_rounds | int | 全ラウンド数 |
| created_at | timestamp | |

**`players` テーブル**
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | プレイヤーID |
| room_id | uuid (FK → rooms) | 所属ルーム |
| name | text | 表示名 |
| score | int | 得点 |
| hand | jsonb | 現在の手札（Card[]のJSON） |

**`game_states` テーブル**
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| room_id | uuid (FK → rooms) | |
| phase | text | `GamePhase`型の値 |
| round | int | 現在ラウンド数 |
| plays | jsonb | `Play[]`のJSON |
| votes | jsonb | 投票結果のJSON |
| updated_at | timestamp | Realtimeの変更検知に使用 |

---

## 4. ゲームフェーズ遷移（仕様）

```
waiting → exchange → select → reveal → vote → result
                                                 ↓
            ←←←（次のラウンドへ）←←←←←←←←←←
                                                 ↓ 最終ラウンド後
                                             gameover
```

各フェーズのタイムリミット:
| フェーズ | タイムリミット |
|---|---|
| exchange（カード交換） | 30秒 |
| select（カード選択） | 60秒 |
| vote（投票） | 30秒 |

---

## 5. 各画面の仕様

### トップページ (`/`)
- ニックネーム入力
- 「ルームを作る」ボタン → 6桁コードを発行して `room/[roomId]` へ遷移
- 「ルームに参加」ボタン + コード入力 → `room/[roomId]` へ遷移

### ゲーム画面 (`/room/[roomId]`)
ゲームフェーズに応じてUIを切り替える1ページ構成。

| フェーズ | 表示内容 |
|---|---|
| waiting | 参加者リスト・スタートボタン（ホストのみ） |
| exchange | 手札（悪口3枚＋クッション3枚）・交換ボタン・タイマー |
| select | 手札から悪口1枚＋クッション1枚を選択・タイマー |
| reveal | 全員の組み合わせを「クッション言葉 ＋ 悪口」形式で表示 |
| vote | 自分以外の表現に1票を投票 |
| result | 得票数・ポイント獲得結果 |
| gameover | 最終スコアボード |

---

## 6. UIおよびアクセシビリティ標準

本プロジェクトのUIコンポーネントは、以下の標準に従って実装します。

1. **アクセス可能なフォームとセマンティクス**
   - すべてのフォーム要素（`<input>`、`<select>`）には対応する `<label>` を設け、`htmlFor` と `id` を使用して明確に紐付けます。
   - 視覚的なラベルがないコントロールには、スクリーンリーダー専用のラベル（例: `<label className="sr-only">`）や `aria-label` を追加します。
   - 意味を持たない装飾的な要素には `aria-hidden="true"` を設定します。

2. **コントラストと視認性**
   - テキスト色は背景に対して十分なコントラスト（WCAG 2.1 AA基準目安）を維持します。
     - 例: 薄い背景には `text-gray-900` などの濃い色を使用。
     - プレースホルダーのテキストも明確に視認可能な色（例: `placeholder:text-gray-500`）を設定します。

3. **フォーカスとキーボード操作**
   - ユーザーがTabキー等でナビゲーションした際、フォーカスが現在どこにあるかを明示するフォーカスリング（例: `focus:ring-2 focus:ring-indigo-500`）を維持・設定します。
   - `outline-none` 等でデフォルトのフォーカススタイルを消す場合は、必ずカスタムの `:focus-visible` スタイルを提供します。

4. **動的な状態の通知**
   - エラーメッセージや重要な状態の変更（ローディング完了など）には `role="alert"` などを設定し、スクリーンリーダーユーザーにも即座に伝わるよう配慮します。

5. **全体設定（メタデータ）**
   - **タイトル表示**: アプリ全体のタイトルはデフォルトから変更し、「Soft Dis-Play」となるよう設定します。
   - **ファビコン**: プロジェクト固有のテーマ（インディゴブルー背景と吹き出し、イニシャル「SD」）を用いたカスタムSVGアイコン（`icon.svg`）を採用します。

---

## 検証計画

### ローカル動作確認
```bash
# プロジェクトルートにて
npm run dev
# → http://localhost:3000 を複数タブで開いてゲームを手動操作
```

### 確認パターン（手動）
1. タブA: ルームを作る → 6桁コードをメモ
2. タブB・C: コードを入力してルームに参加
3. タブAのホストが「スタート」を押し、全タブで `exchange` フェーズに切り替わることを確認
4. カード交換 → 選択 → 発表 → 投票 → 結果 の一連のフロー完走
5. ラウンドが `totalRounds` に達したら `gameover` に遷移することを確認

### デプロイ確認
```bash
vercel deploy
# 発行されたURLを2台の実機（PC・スマートフォン）で開き、オンライン同期を確認
```
