import { Skeleton } from "@/components/ui/skeleton";

const ApplicationDetailsSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-8 w-64" />
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-96" />
    </div>
  </div>
);

export default ApplicationDetailsSkeleton;

