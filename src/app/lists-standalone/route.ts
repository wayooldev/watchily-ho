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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

    const { data: lists } = await supabase
      .from("lists")
      .select("id, name, is_public, created_at")
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    const listIds = (lists ?? []).map((l) => l.id);
    const { data: itemRows } = listIds.length
      ? await supabase
          .from("list_items")
          .select("list_id")
          .in("list_id", listIds)
      : { data: [] };

    const countByList: Record<string, number> = {};
    for (const row of itemRows ?? []) {
      countByList[row.list_id] = (countByList[row.list_id] ?? 0) + 1;
    }

    const listCards = (lists ?? [])
      .map(
        (list) => `
    <a href="${BASE}/lists-standalone/${list.id}" tabindex="0" class="list-card-link">
      <div class="list-card">
        <p class="list-name">${escapeHtml(list.name)}</p>
        <span class="list-count">${countByList[list.id] ?? 0} títulos</span>
      </div>
    </a>`,
      )
      .join("");

    const newListCard = `<a href="${BASE}/lists-standalone/create" tabindex="0" class="list-card-link list-card-new">
    <div class="list-card">
      <p class="list-name">+ Nueva lista</p>
      <span class="list-count">Crear lista</span>
    </div>
  </a>`;

    const gridContent = listCards
      ? listCards + newListCard
      : newListCard +
        '<p class="empty">Aún no tienes listas. Pulsa en + Nueva lista para crear una.</p>';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily - Mis listas</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:0}
    .page{padding:32px 48px 48px}
    ${tvNavCss}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
    .list-card-link{display:block;text-decoration:none;color:inherit;outline:none}
    .list-card-link:focus{outline:none}
    .list-card-link:focus .list-card{transform:scale(1.03);border-color:#e5b00b;box-shadow:0 0 0 3px #e5b00b}
    .list-card{background:rgba(26,26,30,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:24px;min-height:100px;transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s}
    .list-card-new .list-card{border-style:dashed}
    .list-name{font-size:26px;font-weight:600;margin:0 0 8px 0}
    .list-count{font-size:20px;color:#888}
    .empty{color:#888;font-size:24px;padding:40px 0;grid-column:1/-1}
  </style>
</head>
<body>
  ${tvNavHtml(BASE, "listas", "listas")}
  <main class="page">
    <h1 style="font-size:36px;color:#e5b00b;margin-bottom:24px">Mis listas</h1>
    <div class="grid" id="grid">${gridContent}</div>
  </main>
  <script>
    (function(){
      var f=document.querySelectorAll('.tv-nav a, .tv-nav button, .list-card-link');
      function i(el){for(var j=0;j<f.length;j++)if(f[j]===el)return j;return -1}
      var firstEl=document.getElementById('firstFocus')||f[0];
      if(firstEl)firstEl.focus();
      document.addEventListener('keydown',function(e){
        var idx=i(document.activeElement);
        if(idx<0){${tvLogoutModalCheckKeydown}if(firstEl)firstEl.focus();e.preventDefault();return;}
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
        e.preventDefault();
        var next=-1,navCount=6,cols=3;
        if(e.key==='ArrowRight')next=idx+1;
        else if(e.key==='ArrowLeft')next=idx-1;
        else if(e.key==='ArrowDown'){
          if(idx<navCount)next=navCount;
          else next=idx+cols;
        }else if(e.key==='ArrowUp'){
          if(idx>=navCount)next=idx>=navCount+cols?idx-cols:navCount-1;
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
  } catch (e) {
    console.error("lists-standalone error:", e);
    const fallback = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Watchily</title></head><body style="background:#0d0d12;color:#fff;font-family:sans-serif;padding:48px"><h1>Error</h1><p>No se pudo cargar. <a href="https://watchily.wayool.com/tv-standalone" style="color:#60a5fa">Volver</a></p></body></html>`;
    return new NextResponse(fallback, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
