'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Room, Player, GameState, Card, Hand as HandType, Play, GamePhase } from '@/types';
import { Hand } from '@/components/Hand';
import { VotePanel } from '@/components/VotePanel';
import { ScoreBoard } from '@/components/ScoreBoard';
import { SentenceBuilder } from '@/components/SentenceBuilder';
import {
    calculateScores,
    getShuffledInsultDeck,
    getShuffledCushionDeck,
    getShuffledNounDeck,
    getShuffledParticleDeck,
    drawCards,
} from '@/lib/gameLogic';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const roomId = resolvedParams.roomId;

    const [room, setRoom] = useState<Room | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

    // 文章ビルダーの状態: 選択済みカードの順序付き配列
    const [sentence, setSentence] = useState<Card[]>([]);
    const [hasCompletedExchange, setHasCompletedExchange] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            const playerId = localStorage.getItem(`sdp_playerId_${roomId}`);
            if (!playerId) {
                alert('参加情報が見つかりません。トップページに戻ります。');
                router.push('/');
                return;
            }

            const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single();
            if (!roomData) return router.push('/');
            setRoom(roomData as Room);

            const { data: playersData } = await supabase.from('players').select('*').eq('room_id', roomId);
            if (playersData) {
                setPlayers(playersData as Player[]);
                const me = playersData.find(p => p.id === playerId);
                if (me) setCurrentPlayer(me as Player);
            }

            const { data: stateData } = await supabase.from('game_states').select('*').eq('room_id', roomId).single();
            if (stateData) setGameState(stateData as GameState);
        };

        fetchInitialData();

        const roomSub = supabase.channel(`room:${roomId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
                setRoom(payload.new as Room);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, payload => {
                setPlayers(current => {
                    const newData = payload.new as Player;
                    const exists = current.find(p => p.id === newData.id);
                    const updated = exists ? current.map(p => p.id === newData.id ? newData : p) : [...current, newData];
                    if (newData.id === currentPlayer?.id) setCurrentPlayer(newData);
                    return updated;
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}` }, payload => {
                setGameState(current => {
                    const newState = payload.new as GameState;
                    if (current && current.phase !== newState.phase) {
                        setSentence([]);
                        setHasCompletedExchange(false);
                    }
                    return newState;
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(roomSub); };
    }, [roomId, router, currentPlayer?.id]);

    // ゲーム開始: 全プレイヤーに4種類の手札を配る
    const startGame = async () => {
        if (!room || room.host_id !== currentPlayer?.id) return;

        const insultDeck = getShuffledInsultDeck();
        const cushionDeck = getShuffledCushionDeck();
        const nounDeck = getShuffledNounDeck();
        const particleDeck = getShuffledParticleDeck();

        let iDeck = [...insultDeck];
        let cDeck = [...cushionDeck];
        let nDeck = [...nounDeck];
        let pDeck = [...particleDeck];

        const handUpdates: Promise<void>[] = players.map(async (player) => {
            const { drawn: insults, remaining: iRem } = drawCards(iDeck, 3);
            iDeck = iRem;
            const { drawn: cushions, remaining: cRem } = drawCards(cDeck, 3);
            cDeck = cRem;
            const { drawn: nouns, remaining: nRem } = drawCards(nDeck, 2);
            nDeck = nRem;
            const { drawn: particles, remaining: pRem } = drawCards(pDeck, 2);
            pDeck = pRem;

            const hand: HandType = { insults, cushions, nouns, particles };
            const { error } = await supabase.from('players').update({ hand }).eq('id', player.id);
            if (error) console.error('[startGame] hand update error:', error);
        });

        await Promise.all(handUpdates);

        const { error: roomErr } = await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);
        if (roomErr) console.error('[startGame] rooms update error:', roomErr);
        const { error: stateErr } = await supabase.from('game_states').update({ phase: 'exchange' }).eq('room_id', roomId);
        if (stateErr) console.error('[startGame] game_states update error:', stateErr);
    };

    // 手札のカードをクリック: 文章ビルダーに追加/手札に戻す
    const handleCardToggle = (card: Card) => {
        setSentence(prev => {
            const alreadySelected = prev.some(c => c.id === card.id);
            if (alreadySelected) {
                return prev.filter(c => c.id !== card.id);
            } else {
                return [...prev, card];
            }
        });
    };

    // 文章ビルダー: 並べ替え
    const handleSentenceReorder = (newSentence: Card[]) => {
        setSentence(newSentence);
    };

    // 文章ビルダー: 手札に戻す
    const handleSentenceRemove = (cardId: string) => {
        setSentence(prev => prev.filter(c => c.id !== cardId));
    };

    // exchange フェーズ確認完了（全員揃ったら select へ）
    const confirmExchange = async () => {
        if (!currentPlayer || !gameState) return;

        const { data: latestState } = await supabase.from('game_states').select('votes').eq('id', gameState.id).single();
        const currentConfirmed = latestState?.votes || gameState.votes;

        if (currentConfirmed[currentPlayer.id]) return;

        setHasCompletedExchange(true);

        const newConfirmed = { ...currentConfirmed, [currentPlayer.id]: 'confirmed' };
        const { error: confirmErr } = await supabase.from('game_states').update({ votes: newConfirmed }).eq('id', gameState.id);
        if (confirmErr) console.error('[confirmExchange] update error:', confirmErr);

        if (Object.keys(newConfirmed).length >= players.length) {
            const { error: selectErr } = await supabase.from('game_states').update({ phase: 'select', votes: {} }).eq('id', gameState.id);
            if (selectErr) console.error('[confirmExchange] select phase update error:', selectErr);
        }
    };

    // カード選択を提出する
    const submitPlay = async () => {
        if (!currentPlayer || !gameState || sentence.length === 0) return;

        const play: Play = {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            sentence,
        };

        const { data: latestState } = await supabase.from('game_states').select('plays').eq('id', gameState.id).single();
        const currentPlays = latestState?.plays || gameState.plays;

        if (currentPlays.some((p: Play) => p.playerId === currentPlayer.id)) return;

        const newPlays = [...currentPlays, play];
        const { error: playsErr } = await supabase.from('game_states').update({ plays: newPlays }).eq('id', gameState.id);
        if (playsErr) console.error('[submitPlay] plays update error:', playsErr);

        if (newPlays.length >= players.length) {
            const { error: revealErr } = await supabase.from('game_states').update({ phase: 'reveal' }).eq('id', gameState.id);
            if (revealErr) console.error('[submitPlay] reveal phase update error:', revealErr);
        }
    };

    // 投票を提出する
    const submitVote = async (targetPlayerId: string) => {
        if (!currentPlayer || !gameState) return;
        if (targetPlayerId === currentPlayer.id) return;

        const { data: latestState } = await supabase.from('game_states').select('votes').eq('id', gameState.id).single();
        const currentVotes = latestState?.votes || gameState.votes;

        if (currentVotes[currentPlayer.id]) return;

        const newVotes = { ...currentVotes, [currentPlayer.id]: targetPlayerId };
        const { error: votesErr } = await supabase.from('game_states').update({ votes: newVotes }).eq('id', gameState.id);
        if (votesErr) console.error('[submitVote] votes update error:', votesErr);

        if (Object.keys(newVotes).length >= players.length) {
            const points = calculateScores(newVotes);
            for (const player of players) {
                if (points[player.id]) {
                    const { error: scoreErr } = await supabase.from('players').update({ score: player.score + points[player.id] }).eq('id', player.id);
                    if (scoreErr) console.error('[submitVote] score update error:', scoreErr);
                }
            }
            const { error: resultErr } = await supabase.from('game_states').update({ phase: 'result' }).eq('id', gameState.id);
            if (resultErr) console.error('[submitVote] result phase update error:', resultErr);
        }
    };

    if (!room || !gameState || !currentPlayer) {
        return <div className="min-h-screen flex items-center justify-center p-4">Loading...</div>;
    }

    const isHost = room.host_id === currentPlayer.id;
    const hasPlayed = gameState.plays.some(p => p.playerId === currentPlayer.id);
    const selectedVote = gameState.votes[currentPlayer.id] || null;
    const confirmedCount = gameState.phase === 'exchange' ? Object.keys(gameState.votes).length : 0;

    // 現在の手札から文章ビルダーで選択済みのIDをSetで作る
    const selectedIds = new Set(sentence.map(c => c.id));

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* ヘッダー情報 */}
                <header className="flex flex-wrap items-center justify-between bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-xl font-black text-indigo-900">Soft Dis-Play</h1>
                        <p className="text-sm text-gray-500 font-medium tracking-wide">
                            ルームコード: <span className="text-indigo-600 font-bold uppercase">{room.code}</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="px-4 py-2 bg-indigo-50 text-indigo-800 rounded-lg text-sm font-bold">
                            ラウンド: {gameState.round} / {gameState.total_rounds}
                        </div>
                        <div className="px-4 py-2 bg-red-50 text-red-800 rounded-lg text-sm font-bold">
                            フェーズ: {gameState.phase.toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* --- Waiting フェーズ --- */}
                {gameState.phase === 'waiting' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-2xl mx-auto">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">参加者の入室を待っています...</h2>
                        <div className="flex flex-wrap gap-3 justify-center mb-8">
                            {players.map(p => (
                                <div key={p.id} className="px-5 py-2.5 bg-gray-100 rounded-full font-bold text-gray-700 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${p.id === room.host_id ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                                    {p.name} {p.id === currentPlayer.id ? '(あなた)' : ''}
                                </div>
                            ))}
                        </div>
                        {isHost ? (
                            <button
                                onClick={startGame}
                                disabled={players.length < 2}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-12 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {players.length < 2 ? '2人以上必要です' : 'ゲームを始める'}
                            </button>
                        ) : (
                            <p className="text-gray-500 font-medium">ホスト（{players.find(p => p.id === room.host_id)?.name}）の開始を待っています</p>
                        )}
                    </div>
                )}

                {/* --- Exchange フェーズ --- */}
                {gameState.phase === 'exchange' && (
                    <div className="space-y-6 text-center">
                        <h2 className="text-2xl font-bold text-gray-800">手札を確認してください</h2>
                        <Hand
                            hand={currentPlayer.hand}
                            selectedIds={new Set()}
                            onToggle={() => { }}
                            disabled={hasCompletedExchange}
                        />
                        <button
                            onClick={confirmExchange}
                            disabled={hasCompletedExchange}
                            className="bg-purple-600 text-white font-bold py-3 px-8 rounded-lg shadow disabled:opacity-50"
                        >
                            {hasCompletedExchange ? `確認待ち... (${confirmedCount}/${players.length}人)` : '確認完了'}
                        </button>
                    </div>
                )}

                {/* --- Select フェーズ --- */}
                {gameState.phase === 'select' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="text-center">
                            <h2 className="text-2xl font-black text-gray-800 tracking-wide">
                                最も巧みな「柔らかい悪口」を作りましょう
                            </h2>
                            <p className="text-gray-600 mt-1">手札からカードをクリックして文章を組み立ててください</p>
                        </div>

                        {/* 文章ビルダー */}
                        <SentenceBuilder
                            sentence={sentence}
                            onReorder={handleSentenceReorder}
                            onRemove={handleSentenceRemove}
                        />

                        {/* 手札 */}
                        <Hand
                            hand={currentPlayer.hand}
                            selectedIds={selectedIds}
                            onToggle={handleCardToggle}
                            disabled={hasPlayed}
                        />

                        <div className="text-center pt-2">
                            <button
                                onClick={submitPlay}
                                disabled={hasPlayed || sentence.length === 0}
                                className={`
                                    font-bold py-4 px-12 rounded-full shadow-lg transition-all transform
                                    ${hasPlayed || sentence.length === 0
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105'
                                    }
                                `}
                            >
                                {hasPlayed ? '提出済み' : `この文章を提出する！`}
                            </button>
                            <div className="mt-4 text-sm text-gray-500 font-medium">
                                提出状況: {gameState.plays.length} / {players.length}人
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Reveal & Vote フェーズ --- */}
                {(gameState.phase === 'reveal' || gameState.phase === 'vote') && (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="text-center">
                            <h2 className="text-2xl font-black text-gray-800 mb-2">
                                {gameState.phase === 'reveal' ? '全員の発表！' : '一番巧妙な表現に投票しよう！'}
                            </h2>
                            <p className="text-gray-600 font-medium">
                                {gameState.phase === 'reveal'
                                    ? '全員が出揃いました。心の準備はいいですか？'
                                    : '自分以外の最高にマイルドな表現を選んで投票してください。'}
                            </p>

                            {gameState.phase === 'reveal' && isHost && (
                                <button
                                    onClick={async () => {
                                        const { error } = await supabase.from('game_states').update({ phase: 'vote' }).eq('id', gameState.id);
                                        if (error) console.error('[reveal] vote phase update error:', error);
                                    }}
                                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded shadow"
                                >
                                    投票フェーズに進む
                                </button>
                            )}
                        </div>

                        <VotePanel
                            plays={gameState.plays}
                            currentPlayerId={currentPlayer.id}
                            selectedVote={selectedVote}
                            onVote={submitVote}
                            disabled={gameState.phase !== 'vote' || selectedVote !== null}
                        />

                        {gameState.phase === 'vote' && (
                            <div className="text-center text-sm font-bold text-gray-500">
                                投票済み: {Object.keys(gameState.votes).length} / {players.length}人
                            </div>
                        )}
                    </div>
                )}

                {/* --- Result & Gameover フェーズ --- */}
                {(gameState.phase === 'result' || gameState.phase === 'gameover') && (
                    <div className="space-y-8 animate-in fade-in zoom-in-95">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black text-indigo-900 mb-2">
                                {gameState.phase === 'gameover' ? 'ゲーム終了！' : `ラウンド ${gameState.round} 結果`}
                            </h2>
                            {isHost && gameState.phase === 'result' && (
                                <button
                                    onClick={async () => {
                                        if (gameState.round >= gameState.total_rounds) {
                                            const { error } = await supabase.from('game_states').update({ phase: 'gameover' }).eq('id', gameState.id);
                                            if (error) console.error('[result] gameover phase update error:', error);
                                        } else {
                                            const { error } = await supabase.from('game_states').update({
                                                phase: 'exchange',
                                                round: gameState.round + 1,
                                                plays: [],
                                                votes: {}
                                            }).eq('id', gameState.id);
                                            if (error) console.error('[result] next round update error:', error);
                                        }
                                    }}
                                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg"
                                >
                                    {gameState.round >= gameState.total_rounds ? '最終結果へ' : '次のラウンドへ進む'}
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            {/* 投票結果の詳細 */}
                            {gameState.phase === 'result' && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">このラウンドの投票結果</h3>
                                    <ul className="space-y-4">
                                        {gameState.plays.map(play => {
                                            const voteCount = Object.values(gameState.votes).filter(v => v === play.playerId).length;
                                            return (
                                                <li key={play.playerId} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-bold text-gray-700 block">{play.playerName}</span>
                                                        <p className="text-base font-bold text-indigo-700 mt-1 break-words">
                                                            {play.sentence.map(c => c.text).join('')}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-baseline gap-1 shrink-0">
                                                        <span className="text-2xl font-black text-indigo-600">{voteCount}</span>
                                                        <span className="text-xs font-bold text-gray-400">票</span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* スコアボード */}
                            <div>
                                <ScoreBoard players={players} isFinal={gameState.phase === 'gameover'} />
                                {gameState.phase === 'gameover' && (
                                    <div className="mt-8 text-center">
                                        <button
                                            onClick={() => router.push('/')}
                                            className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-8 rounded-lg"
                                        >
                                            トップページに戻る
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
