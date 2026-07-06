import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { Loader2, Copy, KeyRound, Webhook, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCreatePartnerApiKey,
  usePartnerApiKeys,
  usePartnerWebhook,
  useRevokePartnerApiKey,
  useRotatePartnerWebhookSecret,
  useSavePartnerWebhook,
} from "@/hooks/usePartnerApi";
import {
  getPartnerApiBaseUrl,
  PARTNER_API_SCOPES,
  PARTNER_API_TEST_SCOPES,
  PARTNER_API_TEST_FORBIDDEN_SCOPES,
  PARTNER_WEBHOOK_EVENTS,
  type PartnerApiScope,
  type PartnerWebhookEvent,
} from "@/lib/partnerApiConstants";

type PartnerApiPanelProps = {
  partnerOrgId: number;
  canManage: boolean;
};

type CreateKeyValues = {
  environment: "test" | "live";
  days: number;
  scopes: PartnerApiScope[];
};

type WebhookValues = {
  endpointUrl: string;
  subscribedEvents: PartnerWebhookEvent[];
};

const defaultTestScopes = [...PARTNER_API_TEST_SCOPES];

export function PartnerApiPanel({ partnerOrgId, canManage }: PartnerApiPanelProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const apiBaseUrl = getPartnerApiBaseUrl();

  const { data: keys = [], isLoading: keysLoading } = usePartnerApiKeys(partnerOrgId);
  const { data: webhook, isLoading: webhookLoading } = usePartnerWebhook(partnerOrgId);

  const createKey = useCreatePartnerApiKey(partnerOrgId);
  const revokeKey = useRevokePartnerApiKey(partnerOrgId);
  const saveWebhook = useSavePartnerWebhook(partnerOrgId);
  const rotateSecret = useRotatePartnerWebhookSecret(partnerOrgId);

  const [showCreateKey, setShowCreateKey] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
  const [revealedWebhookSecret, setRevealedWebhookSecret] = useState<string | null>(null);

  const createKeySchema = z.object({
    environment: z.enum(["test", "live"]),
    days: z.coerce.number().min(1).max(365),
    scopes: z.array(z.enum(PARTNER_API_SCOPES)).min(1),
  });

  const webhookSchema = z.object({
    endpointUrl: z.string().url(t("partner.apiPage.webhooks.validation.url")),
    subscribedEvents: z
      .array(z.enum(PARTNER_WEBHOOK_EVENTS))
      .min(1, t("partner.apiPage.webhooks.validation.events")),
  });

  const createForm = useForm<CreateKeyValues>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { environment: "test", days: 365, scopes: defaultTestScopes },
  });

  const createEnvironment = createForm.watch("environment");

  useEffect(() => {
    if (createEnvironment !== "test") return;
    const scopes = createForm.getValues("scopes");
    const next = scopes.filter(
      (scope) => !(PARTNER_API_TEST_FORBIDDEN_SCOPES as readonly string[]).includes(scope),
    );
    if (next.length !== scopes.length) {
      createForm.setValue("scopes", next);
    }
  }, [createEnvironment, createForm]);

  const webhookForm = useForm<WebhookValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { endpointUrl: "", subscribedEvents: [...PARTNER_WEBHOOK_EVENTS] },
  });

  useEffect(() => {
    if (webhook) {
      webhookForm.reset({
        endpointUrl: webhook.endpointUrl ?? "",
        subscribedEvents: (webhook.subscribedEvents ?? []) as PartnerWebhookEvent[],
      });
    }
  }, [webhook, webhookForm]);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: t("partner.apiPage.copied", { label }) });
    } catch {
      toast({ title: t("partner.apiPage.copyFailed"), variant: "destructive" });
    }
  };

  const onCreateKey = async (values: CreateKeyValues) => {
    try {
      const scopes = values.environment === "test"
        ? values.scopes.filter(
          (scope) => !(PARTNER_API_TEST_FORBIDDEN_SCOPES as readonly string[]).includes(scope),
        )
        : values.scopes;
      const result = await createKey.mutateAsync({ ...values, scopes });
      setRevealedApiKey(result.apiKey);
      setShowCreateKey(false);
      createForm.reset({ environment: "test", days: 365, scopes: defaultTestScopes });
      toast({ title: t("partner.apiPage.keys.created") });
    } catch (err) {
      toast({
        title: t("partner.apiPage.keys.createFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const onRevokeKey = async () => {
    if (!revokeTarget) return;
    try {
      await revokeKey.mutateAsync(revokeTarget);
      setRevokeTarget(null);
      toast({ title: t("partner.apiPage.keys.revoked") });
    } catch (err) {
      toast({
        title: t("partner.apiPage.keys.revokeFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const onSaveWebhook = async (values: WebhookValues) => {
    try {
      const result = await saveWebhook.mutateAsync({
        endpointUrl: values.endpointUrl,
        subscribedEvents: values.subscribedEvents,
      });
      if (result.signingSecret) setRevealedWebhookSecret(result.signingSecret);
      toast({ title: t("partner.apiPage.webhooks.saved") });
    } catch (err) {
      toast({
        title: t("partner.apiPage.webhooks.saveFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const onRotateSecret = async () => {
    try {
      const result = await rotateSecret.mutateAsync();
      setRevealedWebhookSecret(result.signingSecret);
      toast({ title: t("partner.apiPage.webhooks.rotated") });
    } catch (err) {
      toast({
        title: t("partner.apiPage.webhooks.rotateFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const selectedScopes = createForm.watch("scopes") ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("partner.apiPage.overview.title")}</CardTitle>
          <CardDescription>{t("partner.apiPage.overview.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("partner.apiPage.overview.baseUrl")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">{apiBaseUrl || "—"}</code>
            {apiBaseUrl ? (
              <Button type="button" variant="outline" size="sm" onClick={() => copyText(apiBaseUrl, "URL")}>
                <Copy className="h-4 w-4 mr-1" />
                {t("partner.apiPage.copy")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("partner.apiPage.overview.authHint")}</p>
        </CardContent>
      </Card>

      {revealedApiKey ? (
        <Alert>
          <KeyRound className="h-4 w-4" />
          <AlertTitle>{t("partner.apiPage.keys.revealTitle")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{t("partner.apiPage.keys.revealDescription")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded break-all">{revealedApiKey}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => copyText(revealedApiKey, "API key")}>
                <Copy className="h-4 w-4 mr-1" />
                {t("partner.apiPage.copy")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t("partner.apiPage.keys.title")}
            </CardTitle>
            <CardDescription>{t("partner.apiPage.keys.description")}</CardDescription>
          </div>
          {canManage ? (
            <Button type="button" onClick={() => setShowCreateKey(true)}>
              {t("partner.apiPage.keys.create")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default">
            <AlertTitle>{t("partner.apiPage.keys.testKeyLimitationsTitle")}</AlertTitle>
            <AlertDescription>{t("partner.apiPage.keys.testKeyLimitationsDescription")}</AlertDescription>
          </Alert>
          {keysLoading ? (
            <p className="text-sm text-muted-foreground">{t("partner.apiPage.loading")}</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("partner.apiPage.keys.empty")}</p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm">{key.key_prefix}…</code>
                      <Badge variant={key.environment === "live" ? "default" : "secondary"}>
                        {key.environment}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("partner.apiPage.keys.expires", {
                        date: format(new Date(key.expires_at), "PP"),
                      })}
                      {key.last_used_at
                        ? ` · ${t("partner.apiPage.keys.lastUsed", {
                            date: format(new Date(key.last_used_at), "PP"),
                          })}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {t(`partner.apiPage.keys.scopeLabels.${scope}`, { defaultValue: scope })}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {canManage ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setRevokeTarget(key.id)}>
                      {t("partner.apiPage.keys.revoke")}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {revealedWebhookSecret ? (
        <Alert>
          <Webhook className="h-4 w-4" />
          <AlertTitle>{t("partner.apiPage.webhooks.revealTitle")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{t("partner.apiPage.webhooks.revealDescription")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded break-all">{revealedWebhookSecret}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyText(revealedWebhookSecret, "secret")}
              >
                <Copy className="h-4 w-4 mr-1" />
                {t("partner.apiPage.copy")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              {t("partner.apiPage.webhooks.title")}
            </CardTitle>
            <CardDescription>{t("partner.apiPage.webhooks.description")}</CardDescription>
          </div>
          {canManage && webhook?.secretPrefix ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRotateSecret}
              disabled={rotateSecret.isPending}
            >
              {rotateSecret.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RotateCw className="h-4 w-4 mr-1" />
                  {t("partner.apiPage.webhooks.rotate")}
                </>
              )}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {webhookLoading ? (
            <p className="text-sm text-muted-foreground">{t("partner.apiPage.loading")}</p>
          ) : (
            <Form {...webhookForm}>
              <form onSubmit={webhookForm.handleSubmit(onSaveWebhook)} className="space-y-4">
                <CustomFormField
                  control={webhookForm.control}
                  name="endpointUrl"
                  label={t("partner.apiPage.webhooks.endpoint")}
                  fieldType={FormFieldType.URL}
                  placeholder="https://api.example.com/webhooks/maali"
                  disabled={!canManage}
                />

                <FormField
                  control={webhookForm.control}
                  name="subscribedEvents"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t("partner.apiPage.webhooks.events")}</FormLabel>
                      <div className="space-y-2">
                        {PARTNER_WEBHOOK_EVENTS.map((event) => (
                          <FormField
                            key={event}
                            control={webhookForm.control}
                            name="subscribedEvents"
                            render={({ field }) => {
                              const checked = field.value?.includes(event);
                              return (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={checked}
                                      disabled={!canManage}
                                      onCheckedChange={(isChecked) => {
                                        const next = isChecked
                                          ? [...(field.value ?? []), event]
                                          : (field.value ?? []).filter((v) => v !== event);
                                        field.onChange(next);
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {t(`partner.apiPage.webhooks.eventLabels.${event.replace(/\./g, "_")}`, {
                                      defaultValue: event,
                                    })}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {webhook?.secretPrefix ? (
                  <p className="text-xs text-muted-foreground">
                    {t("partner.apiPage.webhooks.secretPrefix", { prefix: webhook.secretPrefix })}
                  </p>
                ) : null}

                {canManage ? (
                  <Button type="submit" disabled={saveWebhook.isPending}>
                    {saveWebhook.isPending ? t("partner.apiPage.saving") : t("partner.apiPage.webhooks.save")}
                  </Button>
                ) : null}
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showCreateKey} onOpenChange={setShowCreateKey}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("partner.apiPage.keys.createTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("partner.apiPage.keys.createDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateKey)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("partner.apiPage.keys.environment")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="test">{t("partner.apiPage.keys.envTest")}</SelectItem>
                        <SelectItem value="live">{t("partner.apiPage.keys.envLive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <CustomFormField
                control={createForm.control}
                name="days"
                label={t("partner.apiPage.keys.expiryDays")}
                fieldType={FormFieldType.NUMBER}
                min={1}
                max={365}
              />

              <FormField
                control={createForm.control}
                name="scopes"
                render={() => (
                  <FormItem>
                    <FormLabel>{t("partner.apiPage.keys.scopes")}</FormLabel>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {PARTNER_API_SCOPES.map((scope) => (
                        <FormField
                          key={scope}
                          control={createForm.control}
                          name="scopes"
                          render={({ field }) => {
                            const checked = field.value?.includes(scope);
                            const isForbiddenForTest = (PARTNER_API_TEST_FORBIDDEN_SCOPES as readonly string[]).includes(scope);
                            const disabled = createEnvironment === "test" && isForbiddenForTest;
                            return (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={checked}
                                    disabled={disabled}
                                    onCheckedChange={(isChecked) => {
                                      if (disabled) return;
                                      const next = isChecked
                                        ? [...(field.value ?? []), scope]
                                        : (field.value ?? []).filter((v) => v !== scope);
                                      field.onChange(next);
                                    }}
                                  />
                                </FormControl>
                                  <FormLabel className="font-normal text-xs">
                                    {t(`partner.apiPage.keys.scopeLabels.${scope}`, { defaultValue: scope })}
                                  </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AlertDialogFooter>
                <AlertDialogCancel type="button">{t("partner.apiPage.cancel")}</AlertDialogCancel>
                <AlertDialogAction type="submit" disabled={createKey.isPending || !selectedScopes.length}>
                  {createKey.isPending ? t("partner.apiPage.saving") : t("partner.apiPage.keys.create")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("partner.apiPage.keys.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("partner.apiPage.keys.revokeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("partner.apiPage.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onRevokeKey} disabled={revokeKey.isPending}>
              {t("partner.apiPage.keys.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
