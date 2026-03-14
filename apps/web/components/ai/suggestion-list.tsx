'use client';

import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuggestionListProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isLoading?: boolean;
}

export function SuggestionList({ suggestions, onSelect, isLoading }: SuggestionListProps) {
  if (suggestions.length === 0 && !isLoading) return null;

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Lightbulb className="h-4 w-4" />
        <span>您可能想问：</span>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <>
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
          </>
        ) : (
          suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start text-left h-auto py-2 px-3"
              onClick={() => onSelect(suggestion)}
            >
              {suggestion}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
