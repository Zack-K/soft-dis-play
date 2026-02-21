import React from 'react';
import { Player } from '../types';

type ScoreBoardProps = {
    players: Player[];
    isFinal?: boolean;
};

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ players, isFinal = false }) => {
    // スコア順にソート
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
        <div className={`w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-lg border ${isFinal ? 'border-yellow-400 bg-yellow-50/30' : 'border-gray-200 bg-white'}`}>
            {isFinal && (
                <div className="bg-yellow-400 text-yellow-900 text-center py-4 font-black tracking-widest text-xl uppercase">
                    Final Results
                </div>
            )}

            <div className="divide-y divide-gray-100">
                {sortedPlayers.map((player, index) => {
                    const isTop = index === 0 && player.score > 0;
                    return (
                        <div key={player.id} className={`flex items-center justify-between p-4 ${isTop ? 'bg-amber-50/50' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                  ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                        index === 1 ? 'bg-gray-300 text-gray-800' :
                                            index === 2 ? 'bg-amber-700 text-amber-100' : 'bg-gray-100 text-gray-500'}
                `}>
                                    {index + 1}
                                </div>
                                <div className="font-semibold text-gray-800 text-lg">
                                    {player.name}
                                    {isTop && isFinal && <span className="ml-2 text-xl" title="Winner">👑</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-2xl font-black text-indigo-900">{player.score}</span>
                                <span className="text-sm font-medium text-gray-500 mb-1">pts</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
