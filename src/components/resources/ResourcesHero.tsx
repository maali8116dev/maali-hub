import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ResourcesHeroProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
}

export function ResourcesHero({ searchQuery, onSearchChange, totalCount }: ResourcesHeroProps) {
  return (
    <section className="relative py-12 md:py-16 mb-8">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent rounded-3xl -z-10" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-48 bg-accent/10 rounded-full blur-3xl -z-10" />
      
      <div className="text-center max-w-3xl mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
          Resource Library
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Access guides, templates, tutorials, and tools to help you succeed in your funding applications
        </p>
        
        {/* Search bar */}
        <div className="relative max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-12 pr-12 h-14 text-base rounded-xl border-border/50 bg-background/80 backdrop-blur-sm shadow-sm focus-visible:ring-primary/30"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => onSearchChange("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <p className="mt-3 text-sm text-muted-foreground">
            {totalCount} resources available
          </p>
        </div>
      </div>
    </section>
  );
}
