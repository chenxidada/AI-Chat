import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
