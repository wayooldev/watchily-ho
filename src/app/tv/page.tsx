import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Desktop / non-middleware entry for /tv — mirror middleware React TV routing. */
export default async function TVPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/library?device=tv");
  redirect("/login?device=tv");
}
