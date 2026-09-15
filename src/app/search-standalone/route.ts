import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchTitles, getTitleDetails } from "@/lib/streaming/unified";
import {
  PROVIDER_TO_SOURCE_ID,
  filterTitlesByUserProviders,
} from "@/lib/streaming/providers";
import { getPopularTitles } from "@/lib/streaming/unified";
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tileHtml(
  t: {
    id: string;
    name: string;
    poster?: string | null;
    type: string;
    year?: number | null;
    sources?: { providerName: string }[];
  },
  base: string,
) {
  const platform = t.sources?.[0]?.providerName ?? "";
  return `
    <a href="${base}/title-standalone/${t.id}" tabindex="0" class="tile-link">
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

export async function GET(request: NextRequest) {
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
  const userProviderIds = (providerRows ?? []).map((r) => r.provider_id);
  const country = profile?.country_code ?? "MX";

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  let tiles = "";
  let heading = "Películas y series populares";

  if (q) {
    try {
      const result = await searchTitles(q, { country });
      const toEnrich = result.titles.slice(0, 8);
      const enriched = await Promise.allSettled(
        toEnrich.map((t) =>
          getTitleDetails(t.id, { country, region: country }),
        ),
      );
      const enrichedTitles = toEnrich.map((original, i) => {
        const settled = enriched[i];
        if (settled.status === "fulfilled" && settled.value) {
          const d = settled.value;
          return { ...d, poster: d.poster ?? original.poster };
        }
        return original;
      });
      const filtered = filterTitlesByUserProviders(
        [...enrichedTitles, ...result.titles.slice(8)],
        userProviderIds,
      ).filter((t) => t.poster?.startsWith("http"));
      tiles = filtered.map((t) => tileHtml(t, BASE)).join("");
      heading = `Resultados para "${escapeHtml(q)}"`;
    } catch {
      heading = "Error al buscar";
    }
  } else {
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
    tiles = combined.map((t) => tileHtml(t, BASE)).join("");
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily - Buscar</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:0}
    .page{padding:32px 48px 48px}
    ${tvNavCss}
    .search-wrap{margin-bottom:32px;display:flex;gap:32px;align-items:center}
    .search-wrap input{padding:20px 24px;font-size:28px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;min-width:400px}
    .search-wrap input:focus{outline:3px solid #e5b00b;outline-offset:2px}
    .search-wrap button{padding:20px 32px;font-size:24px;font-weight:600;border-radius:12px;border:none;background:#6366f1;color:#fff;cursor:pointer}
    h2{font-size:32px;margin-bottom:24px;color:#fff}
    ${tvTileCss}
  </style>
</head>
<body>
  ${tvNavHtml(BASE, "buscar")}
  <main class="page">
    <form method="GET" action="${BASE}/search-standalone" class="search-wrap">
      <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Película o serie..." id="searchInput" tabindex="0" />
      <button type="submit">Buscar</button>
    </form>
    <h2>${heading}</h2>
    <div class="grid" id="grid">${tiles || "<p style='color:#888;font-size:22px'>No hay resultados.</p>"}</div>
  </main>
  <script>
    (function(){
      var f=document.querySelectorAll('.tv-nav a, .tv-nav button, #searchInput, .search-wrap button, .tile-link');
      var searchInput=document.getElementById('searchInput');
      function idxOf(el){for(var j=0;j<f.length;j++)if(f[j]===el)return j;return -1}
      function focusSearch(){${tvLogoutModalCheck}if(searchInput)searchInput.focus()}
      setTimeout(focusSearch,1200);
      document.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){
          var el=document.activeElement;
          if(el&&el.tagName==='A'&&el.href){el.click();e.preventDefault();}
          return;
        }
        var idx=idxOf(document.activeElement);
        if(idx<0){${tvLogoutModalCheckKeydown}focusSearch();e.preventDefault();return;}
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
        e.preventDefault();
        var next=-1,navCount=6,searchCount=2,cols=4;
        if(e.key==='ArrowRight')next=idx+1;
        else if(e.key==='ArrowLeft')next=idx-1;
        else if(e.key==='ArrowDown'){
          if(idx<navCount)next=navCount;
          else if(idx<navCount+searchCount)next=navCount+searchCount;
          else next=idx+cols;
        }else if(e.key==='ArrowUp'){
          if(idx>=navCount+searchCount)next=6+Math.min((idx-navCount-searchCount)%cols,1);
          else if(idx>=navCount)next=idx-navCount;
          else next=Math.max(0,idx-cols);
        }
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
