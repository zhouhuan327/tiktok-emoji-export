'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useStore } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HardDrive, Settings, Activity, Eye } from 'lucide-react';
import SdSyncPage from '@/components/sd-sync/SdSyncPage';
import LocalPreviewPage from '@/components/local-preview/LocalPreviewPage';

export default function Home() {
  // Global State Actions
  const { 
    fetchDevices, 
    pollSyncStatus, 
    restoreSession 
  } = useStore();

  // Initialize and Global Poll
  useEffect(() => {
    // Initial fetch
    fetchDevices();
    restoreSession();

    // Poll for sync status and device status
    // This runs globally regardless of the active tab
    const interval = setInterval(() => {
      // Only poll sync status if we are currently syncing
      if (useStore.getState().syncing) {
        pollSyncStatus();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Tabs defaultValue="sd-sync" className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      <Toaster 
        position="top-center" 
        toastOptions={{
          className: "opacity-80 pointer-events-none select-none backdrop-blur-md bg-white/70 dark:bg-black/70 border-white/20",
        }}
      />
      
      {/* Top Navigation Bar */}
      <div className="border-b bg-card px-6 py-3 flex items-center justify-between shadow-sm shrink-0 z-50">
        <div className="flex items-center gap-2">
           <div className="bg-primary p-1.5 rounded-lg text-primary-foreground">
             <Activity size={20} />
           </div>
           <h1 className="font-bold text-lg tracking-tight">Media Hub</h1>
        </div>

        <TabsList className="grid w-[600px] grid-cols-3">
          <TabsTrigger value="sd-sync" className="gap-2">
             <HardDrive size={16} />
             SD Sync
          </TabsTrigger>
          <TabsTrigger value="local-preview" className="gap-2">
             <Eye size={16} />
             Local Preview
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" disabled>
             <Settings size={16} />
             设置 (Coming Soon)
          </TabsTrigger>
        </TabsList>

        <div className="w-[100px] flex justify-end">
           {/* Right side placeholder (User profile etc) */}
           <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-6 bg-muted/20">
         <TabsContent value="sd-sync" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
             <SdSyncPage />
         </TabsContent>
         <TabsContent value="local-preview" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
             <LocalPreviewPage />
         </TabsContent>
         <TabsContent value="settings" className="h-full mt-0">
             <div className="flex items-center justify-center h-full text-muted-foreground">
               Setting Page Placeholder
             </div>
         </TabsContent>
      </div>
    </Tabs>
  );
}
