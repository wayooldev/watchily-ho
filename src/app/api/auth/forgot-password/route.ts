import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = body?.email?.toString()?.trim();

  if (!email) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  const base = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/update-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Revisa tu correo para configurar la contraseña",
  });
}
