import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { PushToggle } from "@/components/pwa/push-toggle";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { localizedPath, type AppLocale } from "@/i18n/routing";
import { withTvDeviceQuery } from "@/lib/tv-mode";

export default async function SettingsPage({
  locale,
  searchParams,
}: {
  locale?: AppLocale;
  searchParams?: Promise<{ device?: string }>;
} = {}) {
  const activeLocale = locale ?? (await getLocale());
  const params = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      withTvDeviceQuery(localizedPath("/login", activeLocale), params.device),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, country_code")
    .eq("id", user.id)
    .single();

  const { data: providerRows } = await supabase
    .from("user_providers")
    .select("provider_id")
    .eq("user_id", user.id);
  const selectedProviderIds = (providerRows ?? []).map((r) => r.provider_id);

  const defaultCountry = profile?.country_code ?? "MX";
  const needsOnboarding =
    !profile?.country_code || selectedProviderIds.length === 0;
  const authProvider =
    (user.app_metadata as { provider?: string })?.provider ??
    user.identities?.[0]?.provider ??
    "email";
  const t = await getTranslations({
    locale: activeLocale,
    namespace: "settings",
  });

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-center text-2xl font-bold tracking-tight">
        {t("title")}
      </h1>
      <div className="mt-6 space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div>
          <p className="text-sm text-muted-foreground">{t("email")}</p>
          <p className="font-medium">{user.email ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("signedInWith")}</p>
          <p className="font-medium">
            {authProvider === "google" ? "Google" : t("emailPassword")}
          </p>
        </div>
        <SettingsForm
          initialCountry={defaultCountry}
          initialProviderIds={selectedProviderIds}
          redirectOnSave={needsOnboarding}
        />
        <PushToggle />
      </div>
    </main>
  );
}
