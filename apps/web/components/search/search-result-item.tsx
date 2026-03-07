import type { SearchHit } from '@/hooks/use-search';

interface HighlightedTextProps {
  html: string;
}

function HighlightedText({ html }: HighlightedTextProps) {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className="[&>mark]:bg-yellow-200 [&>mark]:text-yellow-900 [&>mark]:rounded-sm [&>mark]:px-0.5"
    />
  );
}

interface SearchResultItemProps {
  hit: SearchHit;
  isActive?: boolean;
  onClick?: () => void;
}

export function SearchResultItem({ hit, isActive, onClick }: SearchResultItemProps) {
  const updatedDate = new Date(hit.updatedAt * 1000);
  const timeStr = updatedDate.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors ${
        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="font-medium text-gray-900 truncate text-sm">
          <HighlightedText html={hit._formatted.title} />
        </span>
        {hit.folderName && (
          <span className="text-xs text-gray-400 shrink-0">{hit.folderName}</span>
        )}
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 pl-6">
        <HighlightedText html={hit._formatted.contentPlain} />
      </p>
      <div className="flex items-center gap-2 mt-1 pl-6">
        {hit.tags.slice(0, 2).map((tag, i) => (
          <span key={i} className="text-xs text-gray-400">#{tag}</span>
        ))}
        <span className="text-xs text-gray-300 ml-auto">{timeStr}</span>
      </div>
    </button>
  );
}
