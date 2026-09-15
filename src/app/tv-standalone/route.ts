import { NextResponse } from "next/server";
import { getPopularTitles } from "@/lib/streaming/unified";
import { createClient } from "@/lib/supabase/server";
import {
  PROVIDER_TO_SOURCE_ID,
  filterTitlesByUserProviders,
} from "@/lib/streaming/providers";
import {
  tvNavHtml,
  tvNavCss,
  tvTileCss,
  tvLogoutScript,
  tvLogoutModalCheck,
  tvLogoutModalCheckKeydown,
} from "@/lib/tv-shared";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BASE = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";

function tileHtml(t: {
  id: string;
  name: string;
  poster?: string | null;
  type: string;
  year?: number | null;
  sources?: { providerName: string }[];
}) {
  const platform = t.sources?.[0]?.providerName ?? "";
  return `
    <a href="${BASE}/title-standalone/${t.id}" tabindex="0" class="tile-link">
      <div class="tile">
        <div class="tile-poster">
          ${t.poster?.startsWith("http") ? `<img src="${t.poster}" alt="${escapeHtml(t.name)}" loading="lazy" />` : `<div class="tile-placeholder">${escapeHtml(t.name.slice(0, 2))}</div>`}
          <span class="tile-badge">${t.type === "series" ? "SERIE" : "PELÍCULA"}</span>
          ${platform ? `<span class="tile-platform">${escapeHtml(platform)}</span>` : ""}
        </div>
        <div class="tile-info">
          <p class="tile-title">${escapeHtml(t.name)}</p>
          ${t.year ? `<span class="tile-year">${t.year}</span>` : ""}
        </div>
      </div>
    </a>`;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${BASE}/login-standalone`, 302);
    }

    const { data: providerRows } = user
      ? await supabase
          .from("user_providers")
          .select("provider_id")
          .eq("user_id", user.id)
      : { data: [] as { provider_id: string }[] };

    const userProviderIds = (providerRows ?? []).map((r) => r.provider_id);
    const sourceIds = userProviderIds
      .map((id) => PROVIDER_TO_SOURCE_ID[id])
      .filter(Boolean) as number[];

    const [movies, series] = await Promise.all([
      getPopularTitles({ type: "movie", enrich: true, sourceIds }),
      getPopularTitles({ type: "series", enrich: true, sourceIds }),
    ]);

    const combined = filterTitlesByUserProviders(
      [...movies, ...series],
      userProviderIds,
    ).slice(0, 20);

    const tiles = combined.map((t) => tileHtml(t)).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 30%,#060810 65%,#05070d 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:0}
    .page{padding:32px 48px 48px}
    ${tvNavCss}
    ${tvTileCss}
  </style>
</head>
<body>
  ${tvNavHtml(BASE, "inicio", "inicio")}
  <main class="page">
    <div class="grid" id="grid">${tiles}</div>
  <script>
    (function(){
      var focusables=document.querySelectorAll('.tv-nav a, .tv-nav button, .tile-link');
      var inicio=document.getElementById("firstFocus");
      function idxOf(el){for(var i=0;i<focusables.length;i++)if(focusables[i]===el)return i;return -1}
      function focusInicio(){${tvLogoutModalCheck}if(inicio)inicio.focus()}
      focusInicio();
      document.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){
          var el=document.activeElement;
          if(el&&el.tagName==='A'&&el.href){el.click();e.preventDefault();}
          return;
        }
        var idx=idxOf(document.activeElement);
        if(idx<0){${tvLogoutModalCheckKeydown}focusInicio();e.preventDefault();return;}
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
        e.preventDefault();
        var next=-1,navCount=6,cols=4;
        if(e.key==='ArrowRight')next=idx+1;
        else if(e.key==='ArrowLeft')next=idx-1;
        else if(e.key==='ArrowDown'){
          if(idx<navCount)next=navCount;
          else next=idx+cols;
        }else if(e.key==='ArrowUp'){
          if(idx>=navCount)next=idx>=navCount+cols?idx-cols:navCount-1;
          else next=Math.max(0,idx-cols);
        }
        if(next>=0&&next<focusables.length)focusables[next].focus();
      },true);
    })();
  </script>
  <script>${tvLogoutScript()}</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("tv-standalone error:", e);
    const fallback = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Watchily</title></head><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:48px"><h1>Watchily</h1><p>Error al cargar. <a href="https://watchily.wayool.com" style="color:#60a5fa">Ir a la web</a></p></body></html>`;
    return new NextResponse(fallback, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
