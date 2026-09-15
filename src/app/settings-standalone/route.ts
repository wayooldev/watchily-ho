import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  tvNavHtml,
  tvNavCss,
  tvLogoutScript,
  tvLogoutModalCheckKeydown,
} from "@/lib/tv-shared";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BASE = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";

const COUNTRY_NAMES: Record<string, string> = {
  US: "Estados Unidos",
  ES: "España",
  MX: "México",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  BR: "Brasil",
  GB: "Reino Unido",
  DE: "Alemania",
  FR: "Francia",
};

const PROVIDER_NAMES: Record<string, string> = {
  netflix: "Netflix",
  disney_plus: "Disney+",
  hbo_max: "HBO Max",
  amazon_prime: "Amazon Prime Video",
  apple_tv_plus: "Apple TV+",
  paramount_plus: "Paramount+",
  crunchyroll: "Crunchyroll",
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${BASE}/login-standalone`, 302);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("country_code")
    .eq("id", user.id)
    .single();

  const { data: providerRows } = await supabase
    .from("user_providers")
    .select("provider_id")
    .eq("user_id", user.id);

  const countryCode = profile?.country_code ?? "MX";
  const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;
  const providers = (providerRows ?? []).map(
    (r) => PROVIDER_NAMES[r.provider_id] ?? r.provider_id,
  );

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily - Configuración</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:0}
    .page{padding:32px 48px 48px}
    ${tvNavCss}
    .card{background:rgba(26,26,30,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:40px;max-width:600px}
    .row{margin-bottom:24px;font-size:28px}
    .row .label{color:#a1a1aa;margin-bottom:8px}
    .row .value{font-weight:600}
    .providers{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
    .providers span{background:rgba(99,102,241,0.3);padding:8px 16px;border-radius:8px;font-size:22px}
    .web-link{margin-top:32px;font-size:26px}
    .web-link a{color:#60a5fa;text-decoration:underline}
  </style>
</head>
<body>
  ${tvNavHtml(BASE, "config")}
  <main class="page">
  <h1 style="font-size:36px;color:#e5b00b;margin-bottom:24px">Configuración</h1>
  <div class="card">
    <div class="row">
      <p class="label">País</p>
      <p class="value">${countryName}</p>
    </div>
    <div class="row">
      <p class="label">Plataformas</p>
      <div class="providers">${providers.length ? providers.map((p) => `<span>${p}</span>`).join("") : "<span style='color:#888'>Ninguna</span>"}</div>
    </div>
    <p class="web-link">Para cambiar país o plataformas, abre <a href="${BASE}/settings">watchily.wayool.com/settings</a> en tu móvil o PC.</p>
  </div>
  </main>
  <script>
    (function(){
      var f=document.querySelectorAll('.tv-nav a, .tv-nav button');
      function i(el){for(var j=0;j<f.length;j++)if(f[j]===el)return j;return -1}
      var _fa=document.querySelector('.tv-nav a');if(_fa)_fa.focus();
      document.addEventListener('keydown',function(e){
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
        var idx=i(document.activeElement);
        if(idx<0){${tvLogoutModalCheckKeydown}if(f[0])f[0].focus();e.preventDefault();return;}
        e.preventDefault();
        var next=-1;
        if(e.key==='ArrowRight'||e.key==='ArrowDown')next=idx+1;
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=idx-1;
        if(next>=0&&next<f.length)f[next].focus();
      },true);
    })();
  </script>
  <script>${tvLogoutScript()}</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
