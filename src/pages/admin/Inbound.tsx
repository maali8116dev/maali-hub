import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mail, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ContactSubmission,
  ContactSubmissionStatus,
  useContactSubmissions,
  useUpdateContactSubmission,
} from "@/hooks/useContactSubmissions";
import { useNewsletterSubscribers } from "@/hooks/useNewsletterSubscribers";
import { formatDate } from "@/lib/dateUtils";
import { useTranslation } from "react-i18next";

const CONTACT_STATUS_STYLES: Record<string, string> = {
  new: "bg-primary/10 text-primary border-primary/20",
  read: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  replied: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-muted text-muted-foreground",
};

const SUBJECT_KEYS = ["funding", "application", "partnership", "technical", "general"] as const;

const STATUS_OPTIONS: ContactSubmissionStatus[] = ["new", "read", "replied", "archived"];

const AdminInbound = () => {
  const { t } = useTranslation(["dashboard"]);
  const ip = "admin.inboundPage";
  const { toast } = useToast();
  const [contactSearch, setContactSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newsletterSearch, setNewsletterSearch] = useState("");
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [editStatus, setEditStatus] = useState<ContactSubmissionStatus>("new");
  const [editNotes, setEditNotes] = useState("");

  const {
    data: contacts = [],
    isLoading: contactsLoading,
    error: contactsError,
    refetch: refetchContacts,
  } = useContactSubmissions();
  const updateContact = useUpdateContactSubmission();
  const {
    data: subscribers = [],
    isLoading: subscribersLoading,
    error: subscribersError,
    refetch: refetchSubscribers,
  } = useNewsletterSubscribers();

  const openContact = (row: ContactSubmission) => {
    setSelected(row);
    setEditStatus(row.status);
    setEditNotes(row.admin_notes ?? "");
  };

  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase();
    return contacts.filter((c) => {
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesSearch =
        !q ||
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.message.toLowerCase().includes(q) ||
        (t(`${ip}.subjects.${c.subject as (typeof SUBJECT_KEYS)[number]}`, c.subject)).toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [contacts, contactSearch, statusFilter, t]);

  const filteredSubscribers = useMemo(() => {
    const q = newsletterSearch.toLowerCase();
    return subscribers.filter(
      (s) => !q || s.email.toLowerCase().includes(q) || s.source.toLowerCase().includes(q)
    );
  }, [subscribers, newsletterSearch]);

  const contactColumns: ColumnDef<ContactSubmission>[] = useMemo(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        header: ({ column }) => <SortableColumnHeader column={column} title={t(`${ip}.columns.name`)} />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "subject",
        header: ({ column }) => <SortableColumnHeader column={column} title={t(`${ip}.columns.subject`)} />,
        cell: ({ row }) => (
          <span className="text-sm">
            {t(`${ip}.subjects.${row.original.subject as (typeof SUBJECT_KEYS)[number]}`, row.original.subject)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableColumnHeader column={column} title={t(`${ip}.columns.status`)} />,
        cell: ({ row }) => (
          <Badge variant="outline" className={CONTACT_STATUS_STYLES[row.original.status] ?? ""}>
            {t(`${ip}.statuses.${row.original.status as ContactSubmissionStatus}`, row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => <SortableColumnHeader column={column} title={t(`${ip}.columns.received`)} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="outline" size="sm" onClick={() => openContact(row.original)}>
            {t(`${ip}.view`)}
          </Button>
        ),
      },
    ],
    [t]
  );

  const newsletterColumns: ColumnDef<(typeof subscribers)[0]>[] = useMemo(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => <SortableColumnHeader column={column} title={t(`${ip}.columns.email`)} />,
      },
      {
        accessorKey: "source",
        header: ({ column }) => <SortableColumnHeader column={column} title={t(`${ip}.columns.source`)} />,
        cell: ({ row }) => <span className="capitalize text-sm">{row.original.source}</span>,
      },
      {
        accessorKey: "subscribed_at",
        header: ({ column }) => <SortableColumnHeader column={column} title={t(`${ip}.columns.subscribed`)} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.subscribed_at)}</span>
        ),
      },
    ],
    [t]
  );

  const handleSaveContact = async () => {
    if (!selected) return;
    try {
      await updateContact.mutateAsync({
        id: selected.id,
        status: editStatus,
        admin_notes: editNotes.trim() || null,
      });
      toast({ title: t(`${ip}.toast.saved`), description: t(`${ip}.toast.savedDesc`) });
      setSelected(null);
    } catch {
      toast({
        title: t(`${ip}.toast.updateFailed`),
        description: t(`${ip}.toast.updateFailedDesc`),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(`${ip}.title`)}</h1>
        <p className="text-muted-foreground mt-2">{t(`${ip}.subtitle`)}</p>
      </div>

      <Tabs defaultValue="contact">
        <TabsList>
          <TabsTrigger value="contact" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t(`${ip}.tabs.contact`)} ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="newsletter" className="gap-2">
            <Mail className="h-4 w-4" />
            {t(`${ip}.tabs.newsletter`)} ({subscribers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t(`${ip}.contactSearch`)}
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t(`${ip}.status`)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t(`${ip}.allStatuses`)}</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`${ip}.statuses.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {contactsError ? (
            <Alert variant="destructive">
              <AlertTitle>{t(`${ip}.loadContactError`)}</AlertTitle>
              <AlertDescription>
                {(contactsError as Error).message}
                <Button variant="outline" size="sm" className="ml-3" onClick={() => refetchContacts()}>
                  {t(`${ip}.retry`)}
                </Button>
              </AlertDescription>
            </Alert>
          ) : contactsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t(`${ip}.contactSubmissions`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable columns={contactColumns} data={filteredContacts} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="newsletter" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t(`${ip}.newsletterSearch`)}
                  value={newsletterSearch}
                  onChange={(e) => setNewsletterSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {subscribersError ? (
            <Alert variant="destructive">
              <AlertTitle>{t(`${ip}.loadSubscribersError`)}</AlertTitle>
              <AlertDescription>
                {(subscribersError as Error).message}
                <Button variant="outline" size="sm" className="ml-3" onClick={() => refetchSubscribers()}>
                  {t(`${ip}.retry`)}
                </Button>
              </AlertDescription>
            </Alert>
          ) : subscribersLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t(`${ip}.newsletterSubscribers`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable columns={newsletterColumns} data={filteredSubscribers} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.first_name} {selected.last_name}
                </SheetTitle>
                <SheetDescription>{selected.email}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">{t(`${ip}.sheet.subject`)}</p>
                    <p className="font-medium">
                      {t(`${ip}.subjects.${selected.subject as (typeof SUBJECT_KEYS)[number]}`, selected.subject)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t(`${ip}.sheet.received`)}</p>
                    <p className="font-medium">{formatDate(selected.created_at)}</p>
                  </div>
                  {selected.phone && (
                    <div>
                      <p className="text-muted-foreground">{t(`${ip}.sheet.phone`)}</p>
                      <p className="font-medium">{selected.phone}</p>
                    </div>
                  )}
                  {selected.country && (
                    <div>
                      <p className="text-muted-foreground">{t(`${ip}.sheet.country`)}</p>
                      <p className="font-medium">{selected.country}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-muted-foreground mb-1">{t(`${ip}.sheet.message`)}</p>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3">{selected.message}</p>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="contact-status">{t(`${ip}.status`)}</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(v) => setEditStatus(v as ContactSubmissionStatus)}
                  >
                    <SelectTrigger id="contact-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`${ip}.statuses.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-notes">{t(`${ip}.sheet.adminNotes`)}</Label>
                  <Textarea
                    id="admin-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={t(`${ip}.sheet.notesPlaceholder`)}
                    rows={4}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveContact}
                  disabled={updateContact.isPending}
                >
                  {updateContact.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t(`${ip}.sheet.saveChanges`)
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminInbound;
