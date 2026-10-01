import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Form, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { providerSchema, type ProviderFormData } from "@/lib/schemas/provider";
import { FILE_AGENT_ICONS, type FileAgentId } from "@/config/fileAgents";
import { BasicFormFields } from "./BasicFormFields";
import { EndpointField } from "./shared/EndpointField";
import { ApiKeySection } from "./shared/ApiKeySection";
import { ModelInputWithFetch } from "./shared/ModelInputWithFetch";
import { fetchModelsForConfig, type FetchedModel } from "@/lib/api/model-fetch";
import type { ProviderFormProps } from "./ProviderForm";
import type { PiConnection } from "@/lib/api/externalAgents";
import { validConnection } from "@/components/agents/connectionTemplates";
import { extractErrorMessage } from "@/utils/errorUtils";

/** A provider-form driver, hosted in the same add/edit panels as Codex. No separate agent workspace. */
export function FileAgentProviderForm(
  props: ProviderFormProps & { appId: FileAgentId },
) {
  const { t } = useTranslation();
  const existing = props.initialData?.settingsConfig as
    | Partial<PiConnection>
    | undefined;
  const [connection, setConnection] = useState<PiConnection>({
    baseUrl: existing?.baseUrl ?? "",
    model: existing?.model ?? "",
    api: existing?.api ?? "openai-completions",
    credentialMode: existing?.credentialMode ?? "literal",
    credential: existing?.credential ?? "",
  });
  const [models, setModels] = useState<FetchedModel[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: props.initialData?.name ?? "",
      websiteUrl: props.initialData?.websiteUrl ?? "",
      notes: props.initialData?.notes ?? "",
      icon: props.initialData?.icon ?? FILE_AGENT_ICONS[props.appId],
      iconColor: props.initialData?.iconColor ?? "",
      settingsConfig: JSON.stringify(connection),
    },
  });
  const change = (values: Partial<PiConnection>) => {
    const next = { ...connection, ...values };
    setConnection(next);
    form.setValue("settingsConfig", JSON.stringify(next));
    setError("");
  };
  const fetchModels = async () => {
    setFetching(true);
    try {
      const url = connection.baseUrl.replace(/\/chat\/completions\/?$/, "");
      setModels(await fetchModelsForConfig(url, connection.credential));
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setFetching(false);
    }
  };
  const submit = async (values: ProviderFormData) => {
    if (!values.name.trim() || !validConnection(connection, props.appId)) {
      setError(t("agentProvider.invalid"));
      return;
    }
    setSaving(true);
    props.onSubmittingChange?.(true);
    setError("");
    try {
      await props.onSubmit({
        ...values,
        name: values.name.trim(),
        settingsConfig: JSON.stringify({
          ...props.initialData?.settingsConfig,
          ...connection,
        }),
        presetCategory: props.initialData?.category ?? "custom",
        meta: props.initialData?.meta,
      });
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSaving(false);
      props.onSubmittingChange?.(false);
    }
  };
  return (
    <Form {...form}>
      <form
        id="provider-form"
        className="space-y-6"
        onSubmit={form.handleSubmit(submit)}
      >
        <fieldset disabled={saving} className="space-y-6">
          <BasicFormFields form={form} />
          <EndpointField
            id="file-provider-url"
            label="Base URL"
            value={connection.baseUrl}
            onChange={(baseUrl) => change({ baseUrl })}
            placeholder="https://relay.example/v1"
            showManageButton={false}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <FormLabel htmlFor="file-provider-auth">
                {t("extraAgents.auth")}
              </FormLabel>
              <SearchSelect
                id="file-provider-auth"
                aria-label={t("extraAgents.auth")}
                disabled={saving || props.appId === "workbuddy"}
                value={connection.credentialMode}
                onValueChange={(mode) =>
                  change({
                    credentialMode: mode as PiConnection["credentialMode"],
                    credential: "",
                  })
                }
                options={[
                  { value: "literal", label: t("extraAgents.literal") },
                  ...(props.appId === "workbuddy"
                    ? []
                    : [{ value: "env", label: t("extraAgents.env") }]),
                ]}
              />
            </div>
            <div className="space-y-2">
              <FormLabel htmlFor="file-provider-protocol">
                {t("extraAgents.protocol")}
              </FormLabel>
              <SearchSelect
                id="file-provider-protocol"
                aria-label={t("extraAgents.protocol")}
                value={connection.api}
                disabled={saving || props.appId === "workbuddy"}
                onValueChange={(api) =>
                  change({ api: api as PiConnection["api"] })
                }
                options={[
                  {
                    value: "openai-completions",
                    label: "OpenAI Chat Completions",
                  },
                  ...(props.appId === "workbuddy"
                    ? []
                    : [
                        {
                          value: "openai-responses",
                          label: "OpenAI Responses",
                        },
                        {
                          value: "anthropic-messages",
                          label: "Anthropic Messages",
                        },
                      ]),
                ]}
              />
            </div>
          </div>
          {connection.credentialMode === "env" ? (
            <div className="space-y-2">
              <FormLabel htmlFor="file-provider-env">
                {t("extraAgents.envName")}
              </FormLabel>
              <Input
                id="file-provider-env"
                value={connection.credential}
                onChange={(e) => change({ credential: e.target.value })}
                placeholder="HROUTER_API_KEY"
              />
            </div>
          ) : (
            <ApiKeySection
              id="file-provider-key"
              value={connection.credential}
              onChange={(credential) => change({ credential })}
              shouldShowLink={false}
              websiteUrl=""
            />
          )}
          <div className="space-y-2">
            <FormLabel htmlFor="file-provider-model">
              {t("extraAgents.model")}
            </FormLabel>
            <ModelInputWithFetch
              id="file-provider-model"
              value={connection.model}
              onChange={(model) => change({ model })}
              fetchedModels={models}
              isLoading={fetching}
              onFetch={
                connection.credentialMode === "literal" &&
                !!connection.credential &&
                !!connection.baseUrl
                  ? () => void fetchModels()
                  : undefined
              }
              placeholder="model-id"
            />
          </div>
          <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            {t(`agentProvider.${props.appId}Notice`)}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {props.showButtons !== false && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={props.onCancel}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {props.submitLabel}
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </Form>
  );
}
