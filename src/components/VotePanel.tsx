'use client';

import React from 'react';
import { Play } from '../types';

type VotePanelProps = {
    plays: Play[];
    currentPlayerId: string;
    selectedVote: string | null;
    onVote: (playerId: string) => void;
    disabled?: boolean;
};

const TYPE_COLORS: Record<string, string> = {
    insult: 'text-red-700 font-bold',
    cushion: 'text-blue-700',
    noun: 'text-green-700 font-bold',
    particle: 'text-yellow-700',
};

export const VotePanel: React.FC<VotePanelProps> = ({ plays, currentPlayerId, selectedVote, onVote, disabled }) => {
    return (
        <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto p-4 md:p-8 bg-gray-50/50 rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plays.map((play) => {
                    const isOwn = play.playerId === currentPlayerId;
                    const isSelected = selectedVote === play.playerId;
                    const sentenceText = play.sentence.map(c => c.text).join('');

                    return (
                        <button
                            key={play.playerId}
                            onClick={() => onVote(play.playerId)}
                            disabled={disabled || isOwn}
                            className={`
                                relative p-6 rounded-xl border flex flex-col gap-3 text-left transition-all duration-200
                                ${isOwn ? 'bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed' : 'bg-white border-gray-200 hover:border-indigo-400 hover:shadow-md cursor-pointer'}
                                ${isSelected ? 'ring-4 ring-indigo-500 border-indigo-500 scale-[1.02]' : ''}
                            `}
                        >
                            {isOwn && (
                                <div className="absolute -top-3 -right-3 bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                    自分の出す言葉
                                </div>
                            )}
                            {isSelected && (
                                <div className="absolute -top-3 -left-3 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                    投票！
                                </div>
                            )}

                            {/* 組み立てられた文章を表示 */}
                            <div className="flex flex-col gap-2 items-center justify-center min-h-[100px] border-b border-gray-100 pb-4">
                                {/* 文章プレビュー（全体） */}
                                <p className="text-xl font-bold text-gray-800 text-center leading-relaxed">
                                    {sentenceText}
                                </p>
                                {/* カードの色分け表示 */}
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {play.sentence.map((card) => (
                                        <span key={card.id} className={`text-sm ${TYPE_COLORS[card.type] ?? ''}`}>
                                            {card.text}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="text-xs text-gray-400 text-center uppercase tracking-wider font-semibold">
                                {play.playerName.slice(0, 12)}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
