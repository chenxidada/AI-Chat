/**
 * 生成随机颜色（用于标签）
 */
export function generateRandomColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string, locale = 'zh-CN'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: Date | string, locale = 'zh-CN'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else {
    return formatDate(d, locale);
  }
}

/**
 * 计算字数（支持中英文）
 */
export function countWords(text: string): number {
  // 移除 Markdown 语法
  const plainText = text
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/`[^`]*`/g, '') // 行内代码
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接
    .replace(/[#*_~>-]/g, '') // Markdown 符号
    .trim();

  // 统计中文字符
  const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 统计英文单词
  const englishWords = plainText
    .replace(/[\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  return chineseChars + englishWords;
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * 生成 slug
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\u4e00-\u9fa5]+/g, (match) => {
      // 对中文进行简单的拼音转换或保留
      return match;
    })
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * 提取 Markdown 纯文本
 */
export function extractPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/`[^`]*`/g, '') // 行内代码
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接
    .replace(/^#{1,6}\s+/gm, '') // 标题
    .replace(/[*_~]/g, '') // 强调
    .replace(/>\s+/g, '') // 引用
    .replace(/^\s*[-*+]\s+/gm, '') // 无序列表
    .replace(/^\s*\d+\.\s+/gm, '') // 有序列表
    .replace(/\n{2,}/g, '\n') // 多余空行
    .trim();
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetValue = result[key as keyof T];
      const sourceValue = source[key as keyof T];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key as keyof T] = deepMerge(
          targetValue as object,
          sourceValue as object,
        ) as T[keyof T];
      } else if (sourceValue !== undefined) {
        result[key as keyof T] = sourceValue as T[keyof T];
      }
    }
  }

  return result;
}
