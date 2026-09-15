import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTitleDetails } from "@/lib/streaming/unified";
import { filterTitlesByUserProviders } from "@/lib/streaming/providers";
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

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${BASE}/login-standalone`, 302);
  }

  const { data: providerRows } = await supabase
    .from("user_providers")
    .select("provider_id")
    .eq("user_id", user.id);
  const userProviderIds = (providerRows ?? []).map((r) => r.provider_id);

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (!lists?.length) {
    return NextResponse.redirect(`${BASE}/lists-standalone`, 302);
  }

  const listIds = lists.map((l) => l.id);
  const { data: items } = await supabase
    .from("list_items")
    .select("list_id, title_id")
    .in("list_id", listIds)
    .order("position", { ascending: true });

  const allIds = [...new Set((items ?? []).map((i) => i.title_id))];
  const titles: Awaited<ReturnType<typeof getTitleDetails>>[] = [];
  for (const id of allIds.slice(0, 40)) {
    const t = await getTitleDetails(id);
    if (t) titles.push(t);
  }
  const validTitles = titles.filter(
    (t): t is NonNullable<typeof t> => t != null,
  );
  let filtered = filterTitlesByUserProviders(validTitles, userProviderIds);
  if (q) {
    filtered = filtered.filter((t) => t.name.toLowerCase().includes(q));
  }

  const tileHtml = (t: (typeof filtered)[0]) => {
    const platform = t.sources?.[0]?.providerName ?? "";
    return `<a href="${BASE}/title-standalone/${t.id}" tabindex="0" class="tile-link">
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
  };

  const tiles = filtered.map(tileHtml).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily - Ver todo</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:0}
    .page{padding:32px 48px 48px}
    ${tvNavCss}
    ${tvTileCss}
  </style>
</head>
<body>
  ${tvNavHtml(BASE, "vertodo", "vertodo")}
  <main class="page">
  <h1 style="font-size:36px;color:#e5b00b;margin-bottom:24px">Ver todo</h1>
  <form method="GET" action="${BASE}/lists-all-standalone" class="filter-wrap" style="margin-bottom:24px;display:flex;gap:24px;align-items:center">
    <input type="text" name="q" value="${escapeHtml(q)}" placeholder="Filtrar por nombre..." tabindex="0" id="filterInput" style="padding:18px 22px;font-size:26px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;min-width:350px" />
    <button type="submit" style="padding:18px 28px;font-size:22px;font-weight:600;border-radius:12px;border:none;background:#6366f1;color:#fff;cursor:pointer">Filtrar</button>
  </form>
  <div class="grid" id="grid">${tiles || "<p style='color:#888;font-size:24px'>No hay títulos que coincidan.</p>"}</div>
  </main>
  <script>
    (function(){
      var f=document.querySelectorAll('.tv-nav a, .tv-nav button, .filter-wrap input, .filter-wrap button, .tile-link');
      function i(el){for(var j=0;j<f.length;j++)if(f[j]===el)return j;return -1}
      var navCount=6,filterCount=2,firstTileIdx=navCount+filterCount;
      var vertodoBtn=document.getElementById('firstFocus');
      var firstTile=f[firstTileIdx];
      function focusVertodo(){if(vertodoBtn)vertodoBtn.focus()}
      focusVertodo();
      setTimeout(focusVertodo,600);
      document.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){
          var el=document.activeElement;
          if(el&&el.tagName==='A'&&el.href){el.click();e.preventDefault();}
          return;
        }
        var idx=i(document.activeElement);
        if(idx<0){${tvLogoutModalCheckKeydown}focusVertodo();e.preventDefault();return;}
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
        e.preventDefault();
        var next=-1,cols=4;
        if(e.key==='ArrowRight')next=idx+1;
        else if(e.key==='ArrowLeft')next=idx-1;
        else if(e.key==='ArrowDown'){
          if(idx<navCount)next=navCount;
          else if(idx<navCount+filterCount)next=navCount+filterCount;
          else next=idx+cols;
        }else if(e.key==='ArrowUp'){
          if(idx>=navCount+filterCount)next=navCount+filterCount-1;
          else if(idx>=navCount)next=idx-1;
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
