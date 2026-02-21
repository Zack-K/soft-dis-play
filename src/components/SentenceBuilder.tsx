'use client';

import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '../types';

// --- SortableCard: ドラッグ可能な個別カード ---
function SortableCard({ card, onRemove }: { card: CardType; onRemove: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

    const TYPE_COLORS: Record<string, string> = {
        insult: 'bg-red-100 border-red-300 text-red-900',
        cushion: 'bg-blue-100 border-blue-300 text-blue-900',
        noun: 'bg-green-100 border-green-300 text-green-900',
        particle: 'bg-yellow-100 border-yellow-300 text-yellow-900',
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                relative flex flex-col items-center gap-1 select-none
                ${isDragging ? 'z-50' : ''}
            `}
        >
            {/* ドラッグハンドル + カード本体 */}
            <div
                {...attributes}
                {...listeners}
                className={`
                    flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-grab active:cursor-grabbing
                    font-bold text-sm shadow-md transition-shadow hover:shadow-lg
                    ${TYPE_COLORS[card.type] ?? 'bg-gray-100 border-gray-300 text-gray-900'}
                `}
            >
                <span className="text-base">⠿</span>
                <span>{card.text}</span>
            </div>

            {/* 取り消しボタン */}
            <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onRemove(card.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                title="手札に戻す"
            >
                ×
            </button>
        </div>
    );
}

// --- SentenceBuilder: メインコンポーネント ---
type SentenceBuilderProps = {
    sentence: CardType[];
    onReorder: (newSentence: CardType[]) => void;
    onRemove: (cardId: string) => void;
};

export const SentenceBuilder: React.FC<SentenceBuilderProps> = ({ sentence, onReorder, onRemove }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = sentence.findIndex(c => c.id === active.id);
            const newIndex = sentence.findIndex(c => c.id === over.id);
            onReorder(arrayMove(sentence, oldIndex, newIndex));
        }
    }

    return (
        <div className="w-full max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-base font-bold text-gray-700">文章ビルダー</h3>
                <span className="text-xs text-gray-500">（ドラッグして並べ替え・×で手札に戻す）</span>
            </div>

            <div className="min-h-[80px] bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 flex items-center">
                {sentence.length === 0 ? (
                    <p className="text-gray-400 text-sm w-full text-center">
                        手札のカードをクリックして文章を組み立てましょう
                    </p>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={sentence.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                            <div className="flex flex-wrap gap-3 items-center">
                                {sentence.map((card) => (
                                    <SortableCard key={card.id} card={card} onRemove={onRemove} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* 文章プレビュー */}
            {sentence.length > 0 && (
                <div className="mt-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                    <p className="text-sm text-indigo-500 font-medium mb-1">プレビュー</p>
                    <p className="text-lg font-bold text-indigo-900 tracking-wide">
                        {sentence.map(c => c.text).join('')}
                    </p>
                </div>
            )}
        </div>
    );
};
