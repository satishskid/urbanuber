import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export type ChipState = 'suggested' | 'confirmed' | 'rejected';

export interface ContextChipProps {
    label: string;
    state?: ChipState;
    onPress?: () => void;
    className?: string;
}

export const ContextChip: React.FC<ContextChipProps> = ({
    label,
    state = 'suggested',
    onPress,
    className,
}) => {
    const getContainerStyles = (state: ChipState) => {
        switch (state) {
            case 'confirmed':
                return 'bg-green-500 border-green-500';
            case 'rejected':
                return 'bg-red-100 border-red-200';
            case 'suggested':
            default:
                return 'bg-gray-100 border-gray-200';
        }
    };

    const getTextStyles = (state: ChipState) => {
        switch (state) {
            case 'confirmed':
                return 'text-white font-semibold';
            case 'rejected':
                return 'text-red-600 line-through';
            case 'suggested':
            default:
                return 'text-gray-800';
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            disabled={!onPress}
            className={cn(
                'flex-row items-center justify-center px-4 py-2 rounded-full border',
                getContainerStyles(state),
                className
            )}
        >
            {state === 'confirmed' && (
                <Text className="text-white mr-1 text-sm font-bold">✓</Text>
            )}
            <Text className={cn('text-sm', getTextStyles(state))}>{label}</Text>
        </TouchableOpacity>
    );
};
