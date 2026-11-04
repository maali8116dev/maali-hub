import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  ClipboardCheck,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import type { TFunction } from "i18next";
import { SortableColumnHeader } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pickLocalizedField, type OpportunityTranslations } from "@/lib/localizedContent";
import { getLocalizedSectorName } from "@/lib/localizedSector";
import { getProjectApplicationStateLabel, isProjectOpen } from "@/lib/projectAvailability";
import { getProjectStatusBadge } from "@/lib/statusBadges";
import type { VisibilityState } from "@tanstack/react-table";

export type OpportunityTableRow = {
  id: number;
  title: string;
  description: string;
  status: string;
  deadline: string;
  location: string;
  currentApplicants: number;
  maxApplicants?: number | null;
  opportunityType?: string | null;
  sector?: string;
  fundingAmount?: string | null;
  currency?: string | null;
  country?: string | null;
  createdAt?: string;
  featured?: boolean;
  translations?: OpportunityTranslations | null;
};

/** Optional columns hidden by default; toggle via Columns menu */
export const OPPORTUNITY_TABLE_HIDDEN_COLUMNS: VisibilityState = {
  sector: false,
  opportunityType: false,
  applicationWindow: false,
  country: false,
  fundingAmount: false,
  createdAt: false,
  featured: false,
};

const partnerStatusColors: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  "closing-soon": "bg-amber-500/10 text-amber-600 border-amber-200",
  closed: "bg-red-500/10 text-red-600 border-red-200",
  new: "bg-blue-500/10 text-blue-600 border-blue-200",
  archived: "bg-muted text-muted-foreground",
};

type BaseOptions = {
  t: TFunction;
  language: string;
};

export type AdminOpportunityColumnOptions = BaseOptions & {
  role: "admin";
  opportunitiesWithWinners: number[];
  navigate: (path: string) => void;
  onDelete: (id: number) => void;
  deletePending: boolean;
};

export type PartnerOpportunityColumnOptions = BaseOptions & {
  role: "partner";
  navigate: (path: string) => void;
};

export type CreateOpportunityColumnsOptions =
  | AdminOpportunityColumnOptions
  | PartnerOpportunityColumnOptions;

function col(t: TFunction, key: string) {
  return t(`opportunities.table.columns.${key}`, { ns: "dashboard" });
}

function columnMeta(t: TFunction, key: string) {
  return { meta: { label: col(t, key) } };
}

function stripHtml(text: string) {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function createTitleColumn(options: CreateOpportunityColumnsOptions): ColumnDef<OpportunityTableRow> {
  const { t, language } = options;

  return {
    accessorKey: "title",
    ...columnMeta(t, "title"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "title")} />
    ),
    cell: ({ row }) => {
      const title = pickLocalizedField(
        language,
        row.original.title,
        row.original.translations,
        "title",
      );

      if (options.role === "partner") {
        const description = pickLocalizedField(
          language,
          row.original.description,
          row.original.translations,
          "description",
        );
        return (
          <button
            type="button"
            className="space-y-1 text-left hover:underline"
            onClick={() => {
              const destination =
                row.original.currentApplicants > 0
                  ? `/partner/opportunities/${row.original.id}/applications`
                  : `/partner/opportunities/${row.original.id}`;
              options.navigate(destination);
            }}
          >
            <span className="font-medium">{title}</span>
            {description ? (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {stripHtml(description)}
              </p>
            ) : null}
          </button>
        );
      }

      return <span className="font-medium">{title}</span>;
    },
  };
}

function createDeadlineColumn(
  t: TFunction,
  dateFormat: "locale" | "short",
): ColumnDef<OpportunityTableRow> {
  return {
    accessorKey: "deadline",
    ...columnMeta(t, "deadline"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "deadline")} />
    ),
    cell: ({ row }) => {
      const deadline = row.original.deadline;
      if (dateFormat === "short") {
        return format(new Date(deadline), "MMM d, yyyy");
      }
      return (
        <span className="text-sm text-muted-foreground">
          {new Date(deadline).toLocaleDateString()}
        </span>
      );
    },
    sortingFn: (rowA, rowB) =>
      new Date(rowA.original.deadline).getTime() - new Date(rowB.original.deadline).getTime(),
  };
}

function createSectorColumn(t: TFunction): ColumnDef<OpportunityTableRow> {
  return {
    accessorKey: "sector",
    ...columnMeta(t, "sector"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "sector")} />
    ),
    cell: ({ row }) => {
      const sector = row.original.sector;
      if (!sector) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="outline">{getLocalizedSectorName(sector, t)}</Badge>
      );
    },
  };
}

function createApplicationWindowColumn(t: TFunction): ColumnDef<OpportunityTableRow> {
  return {
    id: "applicationWindow",
    ...columnMeta(t, "applicationWindow"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "applicationWindow")} />
    ),
    cell: ({ row }) => {
      const label = getProjectApplicationStateLabel(
        row.original.status,
        row.original.deadline,
        t,
      );
      const open = isProjectOpen(row.original.status, row.original.deadline);
      return (
        <Badge variant={open ? "default" : "secondary"}>
          {label}
        </Badge>
      );
    },
    sortingFn: (rowA, rowB) => {
      const aLabel = getProjectApplicationStateLabel(
        rowA.original.status,
        rowA.original.deadline,
        t,
      );
      const bLabel = getProjectApplicationStateLabel(
        rowB.original.status,
        rowB.original.deadline,
        t,
      );
      return aLabel.localeCompare(bLabel);
    },
  };
}

function createOpportunityTypeColumn(t: TFunction): ColumnDef<OpportunityTableRow> {
  return {
    accessorKey: "opportunityType",
    ...columnMeta(t, "opportunityType"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "opportunityType")} />
    ),
    cell: ({ row }) => {
      const value = row.original.opportunityType;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return (
        <span>
          {t(`opportunities.form.types.${value}`, { ns: "dashboard", defaultValue: String(value) })}
        </span>
      );
    },
  };
}

function createCountryColumn(t: TFunction): ColumnDef<OpportunityTableRow> {
  return {
    accessorKey: "country",
    ...columnMeta(t, "country"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "country")} />
    ),
    cell: ({ row }) => {
      const value = row.original.country;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span className="text-sm">{value}</span>;
    },
  };
}

function createFundingColumn(t: TFunction): ColumnDef<OpportunityTableRow> {
  return {
    accessorKey: "fundingAmount",
    ...columnMeta(t, "funding"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "funding")} />
    ),
    cell: ({ row }) => {
      const { fundingAmount, currency } = row.original;
      if (!fundingAmount) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="text-sm">
          {[currency, fundingAmount].filter(Boolean).join(" ")}
        </span>
      );
    },
  };
}

function createCreatedColumn(t: TFunction, language: string): ColumnDef<OpportunityTableRow> {
  return {
    accessorKey: "createdAt",
    ...columnMeta(t, "created"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "created")} />
    ),
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      if (!createdAt) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="text-sm text-muted-foreground">
          {new Date(createdAt).toLocaleDateString(language)}
        </span>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.createdAt ? new Date(rowA.original.createdAt).getTime() : 0;
      const b = rowB.original.createdAt ? new Date(rowB.original.createdAt).getTime() : 0;
      return a - b;
    },
  };
}

function createFeaturedColumn(t: TFunction): ColumnDef<OpportunityTableRow> {
  return {
    accessorKey: "featured",
    ...columnMeta(t, "featured"),
    header: ({ column }) => (
      <SortableColumnHeader column={column} title={col(t, "featured")} />
    ),
    cell: ({ row }) =>
      row.original.featured ? (
        <Badge variant="secondary">{t("admin.cmsList.partners.yes", { ns: "dashboard" })}</Badge>
      ) : (
        <span className="text-sm text-muted-foreground">
          {t("admin.cmsList.partners.no", { ns: "dashboard" })}
        </span>
      ),
  };
}

function createAdminColumns(options: AdminOpportunityColumnOptions): ColumnDef<OpportunityTableRow>[] {
  const { t, opportunitiesWithWinners, navigate, onDelete, deletePending } = options;

  return [
    createTitleColumn(options),
    {
      accessorKey: "status",
      ...columnMeta(t, "status"),
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={col(t, "status")} />
      ),
      cell: ({ row }) => {
        const project = row.original;
        const hasWinners = opportunitiesWithWinners.includes(project.id);
        return (
          <div className="flex items-center gap-2">
            {getProjectStatusBadge(project.status, t)}
            {hasWinners && (
              <Badge className="bg-success/10 text-success border-success/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t("admin.opportunitiesPage.winnersSelected", { ns: "dashboard" })}
              </Badge>
            )}
          </div>
        );
      },
    },
    createSectorColumn(t),
    createOpportunityTypeColumn(t),
    createApplicationWindowColumn(t),
    createDeadlineColumn(t, "locale"),
    {
      accessorKey: "currentApplicants",
      ...columnMeta(t, "applicants"),
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={col(t, "applicants")} />
      ),
      cell: ({ row }) => <span>{row.original.currentApplicants}</span>,
    },
    {
      accessorKey: "location",
      ...columnMeta(t, "location"),
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={col(t, "location")} />
      ),
      cell: ({ row }) => <span className="text-sm">{row.original.location}</span>,
    },
    createCountryColumn(t),
    createFundingColumn(t),
    createCreatedColumn(t, options.language),
    createFeaturedColumn(t),
    {
      id: "actions",
      enableHiding: false,
      ...columnMeta(t, "actions"),
      header: col(t, "actions"),
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/opportunities/${project.id}`)}
              title={t("opportunities.table.actions.viewProject", { ns: "dashboard" })}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/opportunities/${project.id}/applications`)}
              title={t("opportunities.table.actions.viewApplications", { ns: "dashboard" })}
            >
              <ClipboardCheck className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/opportunities/${project.id}/edit`)}
              title={t("opportunities.table.actions.editProject", { ns: "dashboard" })}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onDelete(project.id)}
              disabled={deletePending}
              title={t("opportunities.table.actions.deleteProject", { ns: "dashboard" })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
}

function createPartnerColumns(options: PartnerOpportunityColumnOptions): ColumnDef<OpportunityTableRow>[] {
  const { t, navigate, language } = options;

  return [
    createTitleColumn(options),
    {
      accessorKey: "status",
      ...columnMeta(t, "status"),
      header: col(t, "status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant="outline" className={partnerStatusColors[status] || ""}>
            {t(`opportunities.form.statuses.${status}`, { ns: "dashboard", defaultValue: status })}
          </Badge>
        );
      },
    },
    createSectorColumn(t),
    createOpportunityTypeColumn(t),
    createApplicationWindowColumn(t),
    {
      accessorKey: "location",
      ...columnMeta(t, "location"),
      header: col(t, "location"),
    },
    createCountryColumn(t),
    createDeadlineColumn(t, "short"),
    {
      accessorKey: "currentApplicants",
      ...columnMeta(t, "applicants"),
      header: col(t, "applicants"),
      cell: ({ row }) => {
        const current = row.getValue("currentApplicants") as number;
        const max = row.original.maxApplicants;
        return max ? `${current}/${max}` : current.toString();
      },
    },
    createFundingColumn(t),
    createCreatedColumn(t, language),
    createFeaturedColumn(t),
    {
      id: "actions",
      enableHiding: false,
      ...columnMeta(t, "actions"),
      header: col(t, "actions"),
      cell: ({ row }) => {
        const opportunity = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigate(`/partner/opportunities/${opportunity.id}`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {t("opportunities.table.actions.viewOpportunity", { ns: "dashboard" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/partner/opportunities/${opportunity.id}/applications`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                {t("opportunities.table.actions.allApplications", {
                  ns: "dashboard",
                  count: opportunity.currentApplicants,
                })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/partner/opportunities/${opportunity.id}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {t("opportunities.table.actions.edit", { ns: "dashboard" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export function createOpportunityColumns(
  options: CreateOpportunityColumnsOptions,
): ColumnDef<OpportunityTableRow>[] {
  if (options.role === "admin") {
    return createAdminColumns(options);
  }
  return createPartnerColumns(options);
}
