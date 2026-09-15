"use client";

import { createClient } from "@/lib/supabase/client";
import { env } from "@/env";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const BASE = env.NEXT_PUBLIC_APP_URL ?? "https://watchily.wayool.com";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"form" | "loading" | "ok" | "error">(
    "form",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !window.location.hash) {
        setStatus("error");
        setMessage("Enlace inválido o expirado. Solicita uno nuevo.");
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement)
      .value;

    if (password.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres");
      setStatus("error");
      return;
    }
    if (password !== confirm) {
      setMessage("Las contraseñas no coinciden");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("ok");
    setMessage("Contraseña guardada. Redirigiendo.");
    setTimeout(() => router.push("/login-standalone"), 1500);
  }

  if (status === "ok") {
    return (
      <div className="rounded-lg bg-green-500/20 p-4 text-center text-green-400">
        {message}
      </div>
    );
  }

  if (status === "error" && !message.includes("Enlace")) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-lg bg-red-500/20 p-3 text-red-400 text-sm">
          {message}
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm text-zinc-400 mb-1"
          >
            Nueva contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm text-zinc-400 mb-1">
            Repetir contraseña
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Repite la contraseña"
          />
        </div>
        <button
          type="submit"
          disabled={false}
          className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Guardar contraseña
        </button>
      </form>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-500/20 p-4 text-center text-red-400">
          {message}
        </div>
        <a
          href={`${BASE}/auth/forgot-password-standalone`}
          className="block text-center text-indigo-400 hover:underline"
        >
          Solicitar nuevo enlace
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="block text-sm text-zinc-400 mb-1">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm text-zinc-400 mb-1">
          Repetir contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Repite la contraseña"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {status === "loading" ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
