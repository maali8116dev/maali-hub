import { Link } from "react-router-dom";
import { HelpCircle, Users, MessageCircle, BookOpen, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LINK_CONFIG = [
  { key: "faq", icon: HelpCircle, href: "/faq", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { key: "mentors", icon: Users, href: "/mentors", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { key: "support", icon: MessageCircle, href: "/contact", color: "text-violet-500", bgColor: "bg-violet-500/10" },
  { key: "guide", icon: BookOpen, href: "/guide", color: "text-amber-500", bgColor: "bg-amber-500/10" },
] as const;

type QuickLinksProps = {
  className?: string;
};

export function QuickLinks({ className }: QuickLinksProps) {
  const { t } = useTranslation("landing");

  return (
    <section className={cn("mt-12 pt-12 border-t border-border/50", className)}>
      <h2 className="text-xl font-semibold text-foreground mb-6">{t("helpLinks.title")}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LINK_CONFIG.map((link) => {
          const Icon = link.icon as LucideIcon;

          return (
            <Link key={link.href} to={link.href}>
              <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/30 group">
                <CardContent className="p-5">
                  <div className={cn("inline-flex p-2.5 rounded-lg mb-3", link.bgColor)}>
                    <Icon className={cn("h-5 w-5", link.color)} />
                  </div>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {t(`helpLinks.${link.key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{t(`helpLinks.${link.key}.description`)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
