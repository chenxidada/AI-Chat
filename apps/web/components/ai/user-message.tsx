'use client';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] px-4 py-3 bg-blue-500 text-white rounded-lg">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
