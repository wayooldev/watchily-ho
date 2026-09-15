import { NextResponse } from "next/server";
import {
  tvLogoutScript,
  tvLogoutModalHtml,
  tvLogoutModalCss,
} from "@/lib/tv-shared";
import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";
import { getTitleDetails } from "@/lib/streaming/unified";
import { filterTitlesByUserProviders } from "@/lib/streaming/providers";

export const dynamic = "force-dynamic";

const BASE = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${BASE}/login-standalone`, 302);
  }

  const { data: list } = await supabase
    .from("lists")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!list) {
    return NextResponse.redirect(`${BASE}/lists-standalone`, 302);
  }

  const { data: providerRows } = await supabase
    .from("user_providers")
    .select("provider_id")
    .eq("user_id", user.id);
  const userProviderIds = (providerRows ?? []).map((r) => r.provider_id);

  const { data: items } = await supabase
    .from("list_items")
    .select("title_id")
    .eq("list_id", id)
    .order("position", { ascending: true });

  const titles: Awaited<ReturnType<typeof getTitleDetails>>[] = [];
  for (const item of items ?? []) {
    const t = await getTitleDetails(item.title_id);
    if (t) titles.push(t);
  }
  const validTitles = titles.filter(
    (t): t is NonNullable<typeof t> => t != null,
  );
  const filtered = filterTitlesByUserProviders(validTitles, userProviderIds);

  const tiles = filtered
    .map(
      (t) => `
      <a href="${BASE}/title-standalone/${t.id}" tabindex="0" class="tile-link" style="display:block;text-decoration:none;color:inherit;">
        <div class="tile">
          <div class="tile-poster">
            ${t.poster?.startsWith("http") ? `<img src="${t.poster}" alt="${escapeHtml(t.name)}" loading="lazy" />` : `<div class="tile-placeholder">${escapeHtml(t.name.slice(0, 2))}</div>`}
            <span class="tile-badge">${t.type === "series" ? "SERIE" : "PELÍCULA"}</span>
          </div>
          <div class="tile-info">
            <p class="tile-title">${escapeHtml(t.name)}</p>
            ${t.year ? `<span class="tile-year">${t.year}</span>` : ""}
          </div>
        </div>
      </a>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily - ${escapeHtml(list.name)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:48px}
    h1{font-size:48px;margin-bottom:8px;color:#e5b00b}
    .sub{margin-bottom:28px;color:#888;font-size:22px}
    nav{margin-bottom:36px;display:flex;gap:16px;flex-wrap:wrap}
    nav a,nav button{display:inline-block;padding:16px 24px;border-radius:10px;font-size:22px;cursor:pointer;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;text-decoration:none;transition:all 0.2s}
    nav a:hover,nav button:hover,nav a:focus,nav button:focus{background:rgba(99,102,241,0.4);border-color:#6366f1;outline:3px solid #e5b00b;outline-offset:3px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
    .tile-link:focus{outline:none}
    .tile-link:focus .tile{transform:scale(1.04);border-color:#e5b00b;box-shadow:0 0 0 3px #e5b00b,0 12px 32px rgba(229,176,11,0.25)}
    .tile{background:rgba(26,26,30,0.95);border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s}
    .tile-poster{aspect-ratio:2/3;background:#1f1f23;position:relative;overflow:hidden}
    .tile-poster img{width:100%;height:100%;object-fit:cover}
    .tile-placeholder{display:flex;align-items:center;justify-content:center;height:100%;font-size:32px;font-weight:700;color:#555}
    .tile-badge{position:absolute;left:10px;top:10px;background:rgba(0,0,0,0.75);padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600}
    .tile-info{padding:16px}
    .tile-title{font-size:18px;font-weight:600;margin:0 0 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tile-year{font-size:14px;color:#888}
    ${tvLogoutModalCss}
  </style>
</head>
<body>
  <h1>${escapeHtml(list.name)}</h1>
  <p class="sub">${filtered.length} títulos</p>
  <nav>
    <a href="${BASE}/tv-standalone" tabindex="0">Inicio</a>
    <a href="${BASE}/search-standalone" tabindex="0">Buscar</a>
    <a href="${BASE}/lists-standalone" tabindex="0">Listas</a>
    <a href="${BASE}/lists-all-standalone" tabindex="0">Ver todo</a>
    <a href="${BASE}/settings-standalone" tabindex="0">Configuración</a>
    <form action="${BASE}/auth/signout" method="POST" style="display:inline"><input type="hidden" name="redirect" value="/tv-standalone" /><button type="submit" tabindex="0" style="padding:16px 24px;border-radius:10px;font-size:22px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;cursor:pointer">Cerrar sesión</button></form>
  </nav>
  <div class="grid" id="grid">${tiles || "<p style='color:#888;font-size:22px'>No hay títulos en esta lista.</p>"}</div>
  ${tvLogoutModalHtml}
  <script>
    (function(){
      var f=document.querySelectorAll('nav a, nav button, .tile-link');
      function i(el){for(var j=0;j<f.length;j++)if(f[j]===el)return j;return -1}
      f[0]?.focus();
      document.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){
          var el=document.activeElement;
          if(el&&el.tagName==='A'&&el.href){el.click();e.preventDefault();}
          return;
        }
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
        var idx=i(document.activeElement);
        if(idx<0)return;
        e.preventDefault();
        var next=-1,cols=4;
        if(e.key==='ArrowRight')next=idx+1;
        else if(e.key==='ArrowLeft')next=idx-1;
        else if(e.key==='ArrowDown')next=idx+cols;
        else if(e.key==='ArrowUp')next=idx-cols;
        if(next>=0&&next<f.length)f[next].focus();
      });
    })();
  </script>
  <script>${tvLogoutScript()}</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
