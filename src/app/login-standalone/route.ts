import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BASE = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";
const PAIR_URL = `${BASE}/tv/pair`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${BASE}/tv-standalone`, 302);
  }

  const errorParam = new URL(request.url).searchParams.get("error");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily - Iniciar sesión</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      background:linear-gradient(180deg,#0b1120 0%,#080c18 30%,#060810 65%,#05070d 100%);
      color:#fff;font-family:Arial,sans-serif;
      min-height:100vh;
      display:flex;align-items:center;justify-content:center;
      padding:48px
    }
    .card{
      display:flex;
      align-items:stretch;
      background:rgba(26,26,30,0.95);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:20px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
      overflow:hidden;
      max-width:1400px;
      width:100%
    }
    .left{flex:1;padding:48px 56px;display:flex;flex-direction:column;justify-content:center;min-width:0}
    .right{flex:1;padding:48px 56px;display:flex;flex-direction:column;justify-content:center;border-left:1px solid rgba(255,255,255,0.1);min-width:380px}
    .left h1{font-size:56px;font-weight:700;margin-bottom:20px;color:#e5b00b}
    .left .sub{font-size:32px;color:#a1a1aa;margin-bottom:28px;line-height:1.4}
    .pair-section .sub{margin-bottom:12px}
    .pair-code{font-size:80px;font-weight:700;letter-spacing:0.4em;margin:28px 0;color:#fff;font-family:monospace}
    .pair-url{font-size:28px;color:#60a5fa;word-break:break-all;margin-bottom:16px;line-height:1.4}
    .pair-hint{font-size:30px;color:#a1a1aa}
    .pair-loading{font-size:32px;color:#a1a1aa;margin:28px 0}
    .right .sub{font-size:28px;color:#a1a1aa;margin-bottom:32px}
    form{display:flex;flex-direction:column;gap:24px}
    form .field-group{margin-bottom:4px}
    label{display:block;font-size:28px;color:#a1a1aa;margin-bottom:10px}
    input{
      background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.2);
      border-radius:12px;
      padding:24px 20px;
      font-size:28px;color:#fff;
      width:100%
    }
    input:focus{outline:3px solid #6366f1;outline-offset:2px}
    .btn-wrap{margin-top:28px}
    .btn{display:block;padding:28px 24px;font-size:30px;font-weight:600;border-radius:12px;cursor:pointer;text-align:center;text-decoration:none;border:none;width:100%}
    .btn-primary{background:#6366f1;color:#fff}
    .err{color:#f87171;font-size:28px;margin-bottom:20px}
    .footer{font-size:24px;color:#71717a;margin-top:28px;line-height:1.5}
    .footer a{color:#60a5fa;text-decoration:underline;font-size:26px}
  </style>
</head>
<body>
  <div class="card">
    <div class="left">
      <h1>Watchily</h1>
      <p class="sub">Vincular con el m&oacute;vil (Google, etc.)</p>
      ${errorParam ? `<p class="err">${escapeHtml(errorParam)}</p>` : ""}
      <div class="pair-section" id="pairSection">
        <p class="sub">1. Abre en tu m&oacute;vil o PC:</p>
        <p class="pair-url">${PAIR_URL}</p>
        <p class="sub">2. Introduce este c&oacute;digo:</p>
        <div class="pair-loading" id="pairLoading">Obteniendo c&oacute;digo…</div>
        <div class="pair-code" id="pairCode" style="display:none"></div>
        <p class="pair-hint" id="pairHint" style="display:none">Esperando que vincules…</p>
      </div>
    </div>
    <div class="right">
      <p class="sub">Entra con email y contrase&ntilde;a</p>
      <form method="POST" action="/api/auth/signin-standalone">
        <input type="hidden" name="redirect" value="/tv-standalone" />
        <div class="field-group">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="tu@email.com" />
        </div>
        <div class="field-group">
          <label for="password">Contrase&ntilde;a</label>
          <input id="password" name="password" type="password" required />
        </div>
        <div class="btn-wrap">
          <button type="submit" class="btn btn-primary">Entrar</button>
        </div>
      </form>
      <p class="footer">
        <a href="${BASE}/auth/forgot-password-standalone">¿Usaste Google? Configura contrase&ntilde;a</a>
      </p>
      <p class="footer">
        ¿No tienes cuenta? Cr&eacute;ala en tu m&oacute;vil o computadora en watchily.wayool.com
      </p>
    </div>
  </div>
  <script>
    (function(){
      var loading=document.getElementById("pairLoading");
      var codeEl=document.getElementById("pairCode");
      var hint=document.getElementById("pairHint");
      var codeVal=null;
      var pollTimer=null;

      function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}

      function doExchange(exchangeToken){
        stopPoll();
        fetch("/api/auth/pair/exchange",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({code:codeVal,exchange_token:exchangeToken})
        }).then(function(r){return r.json()}).then(function(d){
          if(d.ok) window.location.href="/tv-standalone";
          else {hint.textContent=d.error||"Error";hint.style.display="block"}
        }).catch(function(){hint.textContent="Error de conexi\u00f3n";hint.style.display="block"});
      }

      function poll(){
        if(!codeVal)return;
        fetch("/api/auth/pair/status?code="+codeVal).then(function(r){return r.json()}).then(function(d){
          if(d.status==="paired"&&d.exchange_token){doExchange(d.exchange_token);return}
          if(d.status==="expired"||d.status==="invalid"){stopPoll();hint.textContent="C\u00f3digo expirado. Recarga la p\u00e1gina.";hint.style.display="block";return}
        });
      }

      fetch("/api/auth/pair/start",{method:"POST"}).then(function(r){return r.json()}).then(function(d){
        loading.style.display="none";
        if(d.code){
          codeVal=d.code;
          codeEl.textContent=d.code;
          codeEl.style.display="block";
          hint.style.display="block";
          pollTimer=setInterval(poll,2000);
          poll();
        }else{
          hint.textContent=d.error||"Error al obtener c\u00f3digo";
          hint.style.display="block";
        }
      }).catch(function(){
        loading.style.display="none";
        hint.textContent="Error de conexi\u00f3n";
        hint.style.display="block";
      });
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
