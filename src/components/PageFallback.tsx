import { Skeleton } from "@/components/ui/skeleton";

const PageFallback = () => (
  <div className="min-h-screen bg-background">
    <div className="border-b border-border sticky top-0 z-50 bg-background/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <div className="hidden md:flex items-center gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md md:hidden" />
          <Skeleton className="hidden md:block h-9 w-20" />
          <Skeleton className="hidden md:block h-9 w-28" />
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

export default PageFallback;
