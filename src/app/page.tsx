'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { getShuffledInsultDeck, getShuffledCushionDeck, drawCards } from '../lib/gameLogic';
import { HAND_SIZE } from '../types';

export default function Lobby() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 6桁のランダムな英数字コードを生成
  const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return setError('ニックネームを入力してください');

    setLoading(true);
    setError('');

    try {
      // 1. 新しい部屋を作成
      const code = generateCode();
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ code, host_id: 'temp', status: 'waiting', total_rounds: 4 })
        .select()
        .single();

      if (roomError) throw roomError;

      // 2. プレイヤーを挿入（手札はゲーム開始時に配る）
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          name: playerName,
          hand: { insults: [], cushions: [], nouns: [], particles: [] }
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // 3. ルームのホストIDを更新
      await supabase.from('rooms').update({ host_id: player.id }).eq('id', room.id);

      // 4. 初期ゲーム状態を作成
      await supabase.from('game_states').insert({
        room_id: room.id,
        phase: 'waiting',
        round: 1,
        total_rounds: 4,
        plays: [],
        votes: {}
      });

      // localStorageに自分のプレイヤーIDを保存（セッション管理用）
      localStorage.setItem(`sdp_playerId_${room.id}`, player.id);

      router.push(`/room/${room.id}`);
    } catch (err: any) {
      console.error(err);
      setError('ルームの作成に失敗しました: ' + err.message);
      setLoading(false);
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return setError('ニックネームを入力してください');
    if (!roomCode.trim()) return setError('ルームコードを入力してください');

    setLoading(true);
    setError('');

    try {
      // 1. ルームを検索
      const { data: room, error: findError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single();

      if (findError || !room) throw new Error('ルームが見つかりません');
      if (room.status !== 'waiting') throw new Error('このルームは既にゲームが開始されています');

      // 2. プレイヤーに参加させる（手札はゲーム開始時に配る）
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          name: playerName,
          hand: { insults: [], cushions: [], nouns: [], particles: [] }
        })
        .select()
        .single();

      if (playerError) throw playerError;

      localStorage.setItem(`sdp_playerId_${room.id}`, player.id);

      router.push(`/room/${room.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '入室に失敗しました');
      setLoading(false);
    }
  };

  // Helper（未使用関数削除）

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-600 p-6 text-center">
          <h1 className="text-3xl font-black text-white tracking-wider">Soft Dis-Play</h1>
          <p className="text-indigo-200 mt-2 text-sm font-medium">その悪口、もう少しお上品に言えませんか？</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-6 border border-red-200">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">ニックネーム</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="あなたの名前"
              maxLength={10}
              disabled={loading}
            />
          </div>

          <div className="space-y-4 pt-2">
            <button
              onClick={createRoom}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors disabled:opacity-50"
            >
              {loading ? '処理中...' : '新しくルームを作る'}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">または</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tracking-widest text-center uppercase"
                placeholder="6桁のコード"
                maxLength={6}
                disabled={loading}
              />
              <button
                onClick={joinRoom}
                disabled={loading || roomCode.length < 1}
                className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-6 rounded-lg shadow transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                参加する
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
