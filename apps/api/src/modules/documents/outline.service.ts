import { Injectable } from '@nestjs/common';

export interface OutlineItem {
  level: number;
  text: string;
  slug: string;
  children: OutlineItem[];
}

@Injectable()
export class OutlineService {
  /**
   * 从 Markdown 内容提取目录大纲
   */
  extractOutline(content: string): OutlineItem[] {
    const lines = content.split('\n');
    const headings: Array<{ level: number; text: string; slug: string }> = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const slug = this.generateSlug(text);
        headings.push({ level, text, slug });
      }
    }

    return this.buildTree(headings);
  }

  /**
   * 将扁平标题列表构建为树形结构
   */
  private buildTree(
    headings: Array<{ level: number; text: string; slug: string }>,
  ): OutlineItem[] {
    const root: OutlineItem[] = [];
    const stack: OutlineItem[] = [];

    for (const heading of headings) {
      const item: OutlineItem = {
        level: heading.level,
        text: heading.text,
        slug: heading.slug,
        children: [],
      };

      // 找到合适的父节点
      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }

      stack.push(item);
    }

    return root;
  }

  /**
   * 生成标题的 slug
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
