"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  localizedPath,
  usePathname as useLocalePathname,
  useRouter as useLocaleRouter,
} from "@/i18n/routing";
import { useRouter } from "next/navigation";
import { type IconType } from "react-icons";
import { TbBrandDisney } from "react-icons/tb";
import {
  SiAppletv,
  SiCrunchyroll,
  SiHbo,
  SiNetflix,
  SiParamountplus,
  SiPrimevideo,
} from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { captureProductEvent } from "@/lib/analytics";
import {
  getMutationErrorMessage,
  requireSuccessfulResponse,
} from "@/lib/mutation-feedback";
import { useTvMode } from "@/components/tv-mode-context";

const PROVIDERS = [
  { id: "netflix", name: "Netflix", icon: SiNetflix, color: "#E50914" },
  { id: "disney_plus", name: "Disney+", icon: TbBrandDisney, color: "#113CCF" },
  { id: "hbo_max", name: "HBO Max", icon: SiHbo, color: "#B535F6" },
  {
    id: "amazon_prime",
    name: "Amazon Prime Video",
    icon: SiPrimevideo,
    color: "#00A8E1",
  },
  { id: "apple_tv_plus", name: "Apple TV+", icon: SiAppletv, color: "#FFFFFF" },
  {
    id: "paramount_plus",
    name: "Paramount+",
    icon: SiParamountplus,
    color: "#0064FF",
  },
  {
    id: "crunchyroll",
    name: "Crunchyroll",
    icon: SiCrunchyroll,
    color: "#F47521",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  icon?: IconType;
  color?: string;
}[];

const COUNTRIES = [
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "BR", name: "Brasil" },
  { code: "GB", name: "Reino Unido" },
  { code: "DE", name: "Alemania" },
  { code: "FR", name: "Francia" },
];

export function SettingsForm({
  initialCountry,
  initialProviderIds,
  redirectOnSave = false,
}: {
  initialCountry: string;
  initialProviderIds: string[];
  redirectOnSave?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const localizedRouter = useLocaleRouter();
  const localizedPathname = useLocalePathname();
  const router = useRouter();
  const { isTv } = useTvMode();
  const [country, setCountry] = useState(initialCountry);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialProviderIds),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCountry(initialCountry);
    setSelectedIds(new Set(initialProviderIds));
  }, [initialCountry, initialProviderIds]);

  const toggleProvider = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const switchLocale = (nextLocale: "en" | "es") => {
    localizedRouter.replace(`${localizedPathname}${window.location.search}`, {
      locale: nextLocale,
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const [profileResponse, providersResponse] = await Promise.all([
        fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country_code: country }),
        }),
        fetch("/api/profile/providers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerIds: Array.from(selectedIds) }),
        }),
      ]);
      await Promise.all([
        requireSuccessfulResponse(profileResponse, t("saveError")),
        requireSuccessfulResponse(providersResponse, t("saveError")),
      ]);
      setSaved(true);
      captureProductEvent("settings_saved", {
        country,
        providerCount: selectedIds.size,
      });
      toast.success(t("savedToast"));
      if (redirectOnSave) {
        // Onboarding: ir a popular (primera vez configurando)
        router.push(localizedPath("/popular", locale));
      } else {
        // Ya configurado: volver a la página anterior
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(localizedPath("/popular", locale));
        }
      }
    } catch (error) {
      toast.error(getMutationErrorMessage(error, t("saveError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="locale-setting">{common("language")}</Label>
        {isTv ? (
          <select
            id="locale-setting"
            aria-label={common("switchLanguage")}
            value={locale}
            onChange={(event) =>
              switchLocale(event.target.value as "en" | "es")
            }
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="en">{common("english")}</option>
            <option value="es">{common("spanish")}</option>
          </select>
        ) : (
          <Select
            value={locale}
            onValueChange={(value) => switchLocale(value as "en" | "es")}
          >
            <SelectTrigger
              id="locale-setting"
              className="h-11"
              aria-label={common("switchLanguage")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{common("english")}</SelectItem>
              <SelectItem value="es">{common("spanish")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">{t("country")}</Label>
        {isTv ? (
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="country" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-3">
        <Label>{t("providers")}</Label>
        <p className="text-sm text-muted-foreground">
          {t("providerDescription")}
        </p>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                selectedIds.has(p.id)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => toggleProvider(p.id)}
                className="h-4 w-4 shrink-0 rounded border-input"
              />
              {p.icon ? (
                <p.icon
                  className="size-4 shrink-0"
                  style={{ color: p.color }}
                />
              ) : null}
              <span className="font-medium">{p.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() =>
            window.history.length > 1 ? router.back() : router.push("/popular")
          }
        >
          {t("cancel")}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
      {saved && <p className="text-right text-sm text-primary">{t("saved")}</p>}
    </div>
  );
}
