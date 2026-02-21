'use client';

import React from 'react';
import { Card } from './Card';
import { Hand as HandType, Card as CardType } from '../types';

type HandProps = {
    hand: HandType;
    selectedIds: Set<string>;
    onToggle: (card: CardType) => void;
    disabled?: boolean;
};

const SECTIONS = [
    { key: 'cushions' as const, label: 'クッション言葉', color: 'text-blue-800', badge: 'bg-blue-100' },
    { key: 'insults' as const, label: '悪口', color: 'text-red-800', badge: 'bg-red-100' },
    { key: 'nouns' as const, label: '名詞', color: 'text-green-800', badge: 'bg-green-100' },
    { key: 'particles' as const, label: '助詞', color: 'text-yellow-800', badge: 'bg-yellow-100' },
];

export const Hand: React.FC<HandProps> = ({ hand, selectedIds, onToggle, disabled }) => {
    return (
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto p-4 bg-gray-50/50 rounded-2xl">
            {SECTIONS.map(({ key, label, color, badge }) => (
                <div key={key}>
                    <h3 className={`text-base font-bold ${color} mb-3 flex items-center gap-2`}>
                        <span className={`${badge} ${color} px-2 py-0.5 rounded-md text-xs`}>{label}</span>
                        手札
                    </h3>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                        {hand[key].map((card) => (
                            <Card
                                key={card.id}
                                card={card}
                                selected={selectedIds.has(card.id)}
                                onClick={() => onToggle(card)}
                                disabled={disabled}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
