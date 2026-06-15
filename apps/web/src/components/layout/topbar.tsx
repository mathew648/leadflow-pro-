"use client";
import { Menu, Search, Bell, Plus } from "lucide-react";
import { useUIStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  title: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
}

export function Topbar({ title, action }: TopbarProps) {
  const { setSidebarOpen, sidebarOpen } = useUIStore();

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-muted transition-colors hidden sm:flex">
          <Search className="w-5 h-5 text-muted-foreground" />
        </button>
        <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
        </button>
        {action && (
          <Button size="sm" onClick={action.onClick} className="gap-1.5">
            {action.icon ?? <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
