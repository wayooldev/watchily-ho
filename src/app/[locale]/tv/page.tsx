import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LocaleTVPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const prefix = locale === "es" ? "/es" : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`${prefix}/library?device=tv`);
  redirect(`${prefix}/login?device=tv`);
}
