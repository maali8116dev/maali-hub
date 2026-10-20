import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import authLogoIcon from "@/assets/logo_icon.webp";
import { SidebarMenuButton } from "@/components/ui/sidebar";

type SidebarBrandProps = {
  subtitle: string;
};

export function SidebarBrand({ subtitle }: SidebarBrandProps) {
  const { t } = useTranslation("common");

  return (
    <SidebarMenuButton asChild size="lg">
      <Link to="/">
        <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
          <img
            src={authLogoIcon}
            alt={t("auth.brandAlt")}
            className="size-8 object-contain"
          />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">Maali</span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </Link>
    </SidebarMenuButton>
  );
}
