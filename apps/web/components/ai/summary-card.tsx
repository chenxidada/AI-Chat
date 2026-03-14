'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SummaryCardProps {
  summary?: string;
  keywords?: string[];
  onGenerateSummary?: () => void;
  isGenerating?: boolean;
}

export function SummaryCard({
  summary,
  keywords = [],
  onGenerateSummary,
  isGenerating,
}: SummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">对话摘要</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {summary ? (
            <>
              <p className="text-sm text-gray-600">{summary}</p>

              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-2">暂无摘要</p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onGenerateSummary?.();
                }}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {isGenerating ? '生成中...' : '生成摘要'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
