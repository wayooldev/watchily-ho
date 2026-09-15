import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${BASE}/login-standalone`, 302);
  }

  const error = request.nextUrl.searchParams.get("error");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Nueva lista</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(180deg,#0b1120 0%,#080c18 100%);color:#fff;font-family:Arial,sans-serif;min-height:100vh;padding:0}
    .page{padding:32px 48px 48px}
    ${tvNavCss}
    .form-wrap{max-width:600px;margin-top:32px}
    .form-wrap label{display:block;font-size:28px;color:#a1a1aa;margin-bottom:12px}
    .form-wrap input{padding:24px 20px;font-size:28px;width:100%;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff}
    .form-wrap input:focus{outline:3px solid #e5b00b;outline-offset:2px}
    .form-wrap button{margin-top:24px;padding:20px 32px;font-size:24px;font-weight:600;border-radius:12px;border:none;background:#6366f1;color:#fff;cursor:pointer}
    .form-wrap button:focus{outline:3px solid #e5b00b;outline-offset:2px}
    .err{color:#f87171;font-size:24px;margin-bottom:16px}
    .back{margin-top:24px;font-size:24px}
    .back a{color:#60a5fa;text-decoration:none}
  </style>
</head>
<body>
  ${tvNavHtml(BASE, "listas")}
  <main class="page">
    <h1 style="font-size:36px;color:#e5b00b;margin-bottom:24px">Nueva lista</h1>
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
    <form method="POST" action="${BASE}/api/tv/create-list" class="form-wrap">
      <input type="hidden" name="redirect" value="${BASE}/lists-standalone" />
      <label for="name">Nombre de la lista</label>
      <input type="text" id="name" name="name" placeholder="Nombre" required tabindex="0" />
      <button type="submit">Crear lista</button>
    </form>
    <p class="back"><a href="${BASE}/lists-standalone" tabindex="0">← Volver a listas</a></p>
  </main>
  <script>
    (function(){
      var f=document.querySelectorAll('.tv-nav a, .tv-nav button, #name, .form-wrap button, .back a');
      function i(el){for(var j=0;j<f.length;j++)if(f[j]===el)return j;return -1}
      var nameInput=document.getElementById('name');
      function focusInput(){${tvLogoutModalCheck}nameInput&&nameInput.focus()}
      setTimeout(focusInput,800);
      setTimeout(focusInput,1800);
      setTimeout(focusInput,2800);
      document.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){
          var el=document.activeElement;
          if(el&&el.tagName==='A'&&el.href){el.click();e.preventDefault();}
          return;
        }
        var idx=i(document.activeElement);
        if(idx<0){${tvLogoutModalCheckKeydown}focusInput();e.preventDefault();return;}
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
        e.preventDefault();
        var next=-1,navCount=6;
        if(e.key==='ArrowRight')next=idx+1;
        else if(e.key==='ArrowLeft')next=idx-1;
        else if(e.key==='ArrowDown'){
          if(idx<navCount)next=navCount;
          else next=idx+1;
        }else if(e.key==='ArrowUp'){
          if(idx>navCount)next=idx-1;
          else next=Math.max(0,idx-1);
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
