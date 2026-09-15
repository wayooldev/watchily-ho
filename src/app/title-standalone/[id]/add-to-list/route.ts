import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTitleDetails } from "@/lib/streaming/unified";
import {
  tvNavHtml,
  tvNavCss,
  tvLogoutScript,
  tvLogoutModalCheck,
  tvLogoutModalCheckKeydown,
} from "@/lib/tv-shared";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BASE = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: titleId } = await params;
  const title = await getTitleDetails(titleId);
  const titleType = title?.type ?? "movie";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${BASE}/login-standalone`, 302);

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  const { data: items } = await supabase
    .from("list_items")
    .select("list_id")
    .eq("title_id", titleId);

  const listIds = new Set((items ?? []).map((i) => i.list_id));

  const listRows = (lists ?? []).map((list) => {
    const inList = listIds.has(list.id);
    return { ...list, inList };
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Añadir a lista</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:0}
    .page{padding:32px 48px 48px}
    ${tvNavCss}
    h1{font-size:36px;margin-bottom:24px;color:#e5b00b}
    .btn-back{display:inline-block;padding:16px 24px;margin-bottom:24px;border-radius:10px;font-size:22px;cursor:pointer;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;text-decoration:none}
    .btn-back:hover,.btn-back:focus{background:rgba(99,102,241,0.4);outline:3px solid #e5b00b;outline-offset:2px}
    .list-row{display:flex;align-items:center;justify-content:space-between;padding:24px;margin-bottom:16px;background:rgba(26,26,30,0.95);border-radius:12px;border:1px solid rgba(255,255,255,0.12)}
    .list-name{font-size:28px;font-weight:600}
    .list-row button,.list-row a{padding:12px 24px;border-radius:8px;font-size:20px;cursor:pointer;border:none;text-decoration:none;display:inline-block}
    .list-row button:focus,.list-row a:focus{outline:3px solid #e5b00b;outline-offset:2px}
    .btn-add{background:#6366f1;color:#fff}
    .btn-remove{background:#ef4444;color:#fff}
    .create-hint{font-size:24px;color:#888;margin-top:32px}
    .create-hint a{color:#60a5fa;text-decoration:underline;tabindex:0}
    .create-hint a:hover,.create-hint a:focus{outline:2px solid #e5b00b;outline-offset:2px}
  </style>
</head>
<body>
  ${tvNavHtml(BASE, "none")}
  <main class="page">
    <h1>Añadir a lista</h1>
    <a href="${BASE}/title-standalone/${titleId}" tabindex="0" class="btn-back" id="firstFocus">← Volver</a>
    <div style="margin-top:24px">
      ${listRows
        .map((l) =>
          l.inList
            ? `<div class="list-row"><span class="list-name">${escapeHtml(l.name)}</span><form method="POST" action="${BASE}/api/tv/remove-from-list" style="display:inline"><input type="hidden" name="list_id" value="${l.id}" /><input type="hidden" name="title_id" value="${titleId}" /><input type="hidden" name="redirect" value="${BASE}/title-standalone/${titleId}/add-to-list" /><button type="submit" tabindex="0" class="btn-remove">Quitar</button></form></div>`
            : `<div class="list-row"><span class="list-name">${escapeHtml(l.name)}</span><form method="POST" action="${BASE}/api/tv/add-to-list" style="display:inline"><input type="hidden" name="list_id" value="${l.id}" /><input type="hidden" name="title_id" value="${titleId}" /><input type="hidden" name="title_type" value="${titleType}" /><input type="hidden" name="redirect" value="${BASE}/title-standalone/${titleId}/add-to-list" /><button type="submit" tabindex="0" class="btn-add">Añadir</button></form></div>`,
        )
        .join("")}
    </div>
    ${listRows.length === 0 ? "<p class='create-hint'>No tienes listas. <a href='" + BASE + "/lists' tabindex='0'>Crea una en la web</a></p>" : ""}
    <p class="create-hint">Para crear listas nuevas, usa la <a href="${BASE}/lists" tabindex="0">web</a> o la app móvil.</p>
  </main>
  <script>
    /* Flujo control remoto: .cursor/skills/tv-remote-control-flow */
    (function(){
      var f=document.querySelectorAll('.tv-nav a, .tv-nav button, .btn-back, .list-row button, .create-hint a');
      function i(el){for(var j=0;j<f.length;j++)if(f[j]===el)return j;return -1}
      var navCount=6;

      function getFirstFocus(){
        var el=document.getElementById('firstFocus');
        if(el)return el;
        return f[navCount]||f[0];
      }
      function focusFirst(){
        ${tvLogoutModalCheck}
        var active=document.activeElement;
        if(active&&active!==document.body){var idx=i(active);if(idx>=0)return}
        var btn=getFirstFocus();
        if(btn&&btn.focus)btn.focus();
      }
      [0,100,400,800,1500,3000].forEach(function(ms){setTimeout(focusFirst,ms)});
      if(document.readyState!=='complete')window.addEventListener('load',function(){[0,100,400].forEach(function(ms){setTimeout(focusFirst,ms)})});

      document.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.keyCode===13||e.keyCode===28){
          var el=document.activeElement;
          if(el&&(el.tagName==='A'||el.tagName==='BUTTON')){
            if(el.tagName==='A'&&el.href){el.click();}
            else if(el.tagName==='BUTTON'){el.click();}
            e.preventDefault();
          }
          return;
        }
        var idx=i(document.activeElement);
        if(idx<0){${tvLogoutModalCheckKeydown}focusFirst();e.preventDefault();return;}
        var k=e.key||(e.keyCode===40?'ArrowDown':e.keyCode===38?'ArrowUp':e.keyCode===37?'ArrowLeft':e.keyCode===39?'ArrowRight':'');
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k))return;
        e.preventDefault();
        var next=-1;
        if(k==='ArrowDown'){
          if(idx<navCount)next=navCount;
          else next=idx+1;
        }else if(k==='ArrowUp'){
          if(idx>navCount)next=idx-1;
          else if(idx===navCount)next=navCount-1;
          else next=idx>0?idx-1:0;
        }else if(k==='ArrowRight')next=idx+1;
        else if(k==='ArrowLeft')next=idx-1;
        if(next>=0&&next<f.length){var n=f[next];if(n&&n.focus)n.focus()}
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
