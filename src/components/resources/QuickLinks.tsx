import { Link } from "react-router-dom";
import { HelpCircle, Users, MessageCircle, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const quickLinks = [
  {
    title: "FAQs",
    description: "Find answers to common questions",
    icon: HelpCircle,
    href: "/faq",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  {
    title: "Mentors",
    description: "Connect with industry experts",
    icon: Users,
    href: "/mentors",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10"
  },
  {
    title: "Support",
    description: "Get help from our team",
    icon: MessageCircle,
    href: "/contact",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10"
  },
  {
    title: "Guide",
    description: "Step-by-step application guide",
    icon: BookOpen,
    href: "/guide",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10"
  }
];

export function QuickLinks() {
  return (
    <section className="mt-12 pt-12 border-t border-border/50">
      <h2 className="text-xl font-semibold text-foreground mb-6">
        Need more help?
      </h2>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          
          return (
            <Link key={link.href} to={link.href}>
              <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/30 group">
                <CardContent className="p-5">
                  <div className={cn("inline-flex p-2.5 rounded-lg mb-3", link.bgColor)}>
                    <Icon className={cn("h-5 w-5", link.color)} />
                  </div>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {link.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
