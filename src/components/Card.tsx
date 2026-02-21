import React from 'react';
import { Card as CardType } from '../types';

type CardProps = {
    card: CardType;
    selected?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    compact?: boolean; // SentenceBuilder内で小さく表示するモード
};

const TYPE_STYLES = {
    insult: { bg: 'bg-red-50', border: 'border-red-200', hover: 'hover:border-red-400', ring: 'ring-red-500', label: 'bg-red-100 text-red-800' },
    cushion: { bg: 'bg-blue-50', border: 'border-blue-200', hover: 'hover:border-blue-400', ring: 'ring-blue-500', label: 'bg-blue-100 text-blue-800' },
    noun: { bg: 'bg-green-50', border: 'border-green-200', hover: 'hover:border-green-400', ring: 'ring-green-500', label: 'bg-green-100 text-green-800' },
    particle: { bg: 'bg-yellow-50', border: 'border-yellow-200', hover: 'hover:border-yellow-400', ring: 'ring-yellow-500', label: 'bg-yellow-100 text-yellow-800' },
};

export const Card: React.FC<CardProps> = ({ card, selected, onClick, disabled, compact }) => {
    const styles = TYPE_STYLES[card.type] ?? TYPE_STYLES.insult;

    if (compact) {
        return (
            <div className={`
                px-3 py-2 rounded-lg border-2 text-sm font-bold text-gray-800 text-center
                ${styles.bg} ${styles.border}
            `}>
                {card.text}
            </div>
        );
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                relative w-28 h-40 rounded-xl shadow-md p-2 flex flex-col items-center justify-between text-left transition-all duration-200
                ${styles.bg} ${styles.border} border-2 ${styles.hover}
                ${selected ? `ring-4 ring-offset-2 scale-105 ${styles.ring}` : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : 'cursor-pointer hover:-translate-y-1 hover:shadow-lg'}
            `}
        >
            <div className={`text-xs font-semibold px-2 py-0.5 rounded w-full text-center ${styles.label}`}>
                {card.category}
            </div>
            <div className="flex-1 flex items-center justify-center text-center w-full mt-2">
                <p className="font-bold text-gray-800 text-sm leading-snug">
                    {card.text}
                </p>
            </div>
        </button>
    );
};
