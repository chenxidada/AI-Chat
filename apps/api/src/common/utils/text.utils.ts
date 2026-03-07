/**
 * Extract plain text from Markdown content (remove markup)
 */
export function extractPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/>\s/g, '')
    .replace(/[-*+]\s/g, '')
    .replace(/\|.*?\|/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Count words (Chinese characters counted individually, English words counted by spaces)
 */
export function countWords(text: string): number {
  const chinese = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  const english = text.replace(/[\u4e00-\u9fa5]/g, '').match(/\b\w+\b/g)?.length || 0;
  return chinese + english;
}
