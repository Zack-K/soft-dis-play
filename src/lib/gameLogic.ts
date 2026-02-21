import cardsData from '../data/cards.json';
import { Card, Play } from '../types';

/**
 * Fishr-Yatesアルゴリズムによる配列のシャッフル
 */
export function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * 悪口カードデッキを取得しシャッフルして返す
 */
export function getShuffledInsultDeck(): Card[] {
    return shuffle((cardsData.insultCards as Card[]).map(c => ({ ...c, type: 'insult' as const })));
}

/**
 * クッション言葉カードデッキを取得しシャッフルして返す
 */
export function getShuffledCushionDeck(): Card[] {
    return shuffle((cardsData.cushionCards as Card[]).map(c => ({ ...c, type: 'cushion' as const })));
}

/**
 * 名詞カードデッキを取得しシャッフルして返す
 */
export function getShuffledNounDeck(): Card[] {
    return shuffle((cardsData.nounCards as Card[]).map(c => ({ ...c, type: 'noun' as const })));
}

/**
 * 助詞カードデッキを取得しシャッフルして返す
 */
export function getShuffledParticleDeck(): Card[] {
    return shuffle((cardsData.particleCards as Card[]).map(c => ({ ...c, type: 'particle' as const })));
}

/**
 * デッキから指定枚数のカードを引く
 */
export function drawCards(deck: Card[], count: number): { drawn: Card[], remaining: Card[] } {
    const drawn = deck.slice(0, count);
    const remaining = deck.slice(count);
    return { drawn, remaining };
}

/**
 * 投票結果を集計し、各プレイヤーの獲得ポイントを計算する
 * @param votes { 投票者ID: 投票先ID } のマップ
 * @returns { 獲得者ID: 獲得ポイント } のマップ
 */
export function calculateScores(votes: Record<string, string>): Record<string, number> {
    const scores: Record<string, number> = {};

    // 得票数をカウント
    for (const [voterId, targetId] of Object.entries(votes)) {
        if (!scores[targetId]) {
            scores[targetId] = 0;
        }
        // 自分自身への投票は無効（フロントでも防ぐが念のため）
        if (voterId !== targetId) {
            scores[targetId]++;
        }
    }

    // 最多得票のプレイヤーを探す
    let maxVotes = 0;
    for (const count of Object.values(scores)) {
        if (count > maxVotes) {
            maxVotes = count;
        }
    }

    // 最多得票のプレイヤー（同票含む）に1ポイント付与
    const points: Record<string, number> = {};
    if (maxVotes > 0) {
        for (const [playerId, count] of Object.entries(scores)) {
            if (count === maxVotes) {
                points[playerId] = 1;
            }
        }
    }

    return points;
}
