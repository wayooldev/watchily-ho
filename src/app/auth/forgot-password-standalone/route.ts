import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BASE = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${BASE}/tv-standalone`, 302);
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>Watchily - Configurar contraseña</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      background:linear-gradient(180deg,#0b1120 0%,#080c18 30%,#060810 65%,#05070d 100%);
      color:#fff;font-family:Arial,sans-serif;
      min-height:100vh;
      display:flex;align-items:center;justify-content:center;
      padding:24px
    }
    .card{
      width:100%;max-width:384px;
      background:rgba(26,26,30,0.95);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:12px;
      padding:24px;
      box-shadow:0 4px 24px rgba(0,0,0,0.4)
    }
    .card h1{font-size:24px;font-weight:700;text-align:center;margin-bottom:8px;color:#fff}
    .card .sub{font-size:14px;color:#a1a1aa;text-align:center;margin-bottom:24px}
    form{display:flex;flex-direction:column;gap:16px}
    label{display:block;font-size:14px;color:#a1a1aa;margin-bottom:4px}
    input{
      background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.2);
      border-radius:8px;
      padding:12px 14px;
      font-size:16px;color:#fff;
      width:100%
    }
    input:focus{outline:2px solid #6366f1;outline-offset:2px}
    .btn{display:block;padding:12px 16px;font-size:16px;font-weight:600;border-radius:8px;cursor:pointer;text-align:center;text-decoration:none;border:none;width:100%}
    .btn-primary{background:#6366f1;color:#fff}
    .msg{font-size:14px;padding:8px;border-radius:8px;text-align:center}
    .ok{background:rgba(34,197,94,0.2);color:#4ade80}
    .err{background:rgba(248,113,113,0.2);color:#f87171}
    .footer{text-align:center;margin-top:20px;font-size:12px;color:#71717a}
    .footer a{color:#60a5fa;text-decoration:underline}
  </style>
</head>
<body>
  <div class="card">
    <h1>Configurar contraseña</h1>
    <p class="sub">¿Usaste Google para registrarte? Introduce tu email y te enviamos un enlace para crear una contraseña. As&iacute; podr&aacute;s entrar en la TV.</p>
    <form id="form">
      <label for="email">Email (el de tu cuenta Google)</label>
      <input id="email" name="email" type="email" required placeholder="tu@email.com" />
      <button type="submit" class="btn btn-primary">Enviar enlace</button>
    </form>
    <div id="msg"></div>
    <p class="footer"><a href="${BASE}/login-standalone">Volver al login</a></p>
  </div>
  <script>
    document.getElementById("form").onsubmit = async function(e) {
      e.preventDefault();
      var btn = e.target.querySelector("button");
      var msg = document.getElementById("msg");
      btn.disabled = true;
      msg.innerHTML = "";
      try {
        var r = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: document.getElementById("email").value })
        });
        var d = await r.json();
        if (r.ok) {
          msg.className = "msg ok";
          msg.textContent = "Revisa tu correo. Abre el enlace en tu m\u00f3vil o computadora para crear la contrase\u00f1a.";
        } else {
          msg.className = "msg err";
          msg.textContent = d.error || "Error al enviar";
        }
      } catch (err) {
        msg.className = "msg err";
        msg.textContent = "Error de conexi\u00f3n";
      }
      btn.disabled = false;
    };
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
