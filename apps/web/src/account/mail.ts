/**
 * Почта кабинета: одноразовые коды (сброс пароля · подтверждение e-mail).
 *
 * Каскад доставки — тот же, что у /api/report в worker.ts, но с ВАЖНЫМ отличием:
 * письмо уходит на ПРОИЗВОЛЬНЫЙ адрес пользователя, а Cloudflare Email Routing
 * (биндинг SEB) умеет отправлять ТОЛЬКО на верифицированные destination-адреса
 * аккаунта. Поэтому:
 *
 *   1) Resend (секрет RESEND_API_KEY, домен gaurangers.com верифицирован в
 *      Resend) — ОСНОВНОЙ путь для писем пользователям.
 *   2) SEB — резерв: сработает лишь если адресат совпал с верифицированным
 *      destination (наши собственные ящики) — полезно для проверки без ключа.
 *
 * Ни один сбой почты не валит вызвавший эндпойнт: возвращаем boolean, решение
 * «что сказать пользователю» остаётся за server.ts (и оно всегда «ok», чтобы
 * не раскрывать существование аккаунта).
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext/browser";

export interface MailEnv {
  RESEND_API_KEY?: string;
  REPORT_FROM_ADDR?: string;
  SEB?: { send: (m: EmailMessage) => Promise<void> };
}

const FROM_NAME = "ISKCON ONE LOVE";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Письмо с кодом — тихий стиль Apple: одна мысль, крупный код, ничего лишнего. */
function codeLetter(code: string, purpose: "reset" | "verify"): { subject: string; text: string; html: string } {
  const title = purpose === "reset" ? "Восстановление пароля" : "Подтверждение почты";
  const lead =
    purpose === "reset"
      ? "Вы запросили восстановление пароля в ISKCON ONE LOVE. Введите этот код в приложении:"
      : "Подтвердите, что этот адрес принадлежит вам. Введите код в приложении:";
  const tail =
    purpose === "reset"
      ? "Код действует 15 минут. Если вы не запрашивали восстановление — просто проигнорируйте это письмо, пароль не изменится."
      : "Код действует 15 минут. Если это были не вы — проигнорируйте письмо.";
  const subject = `${code} — ${purpose === "reset" ? "код восстановления" : "код подтверждения"} · ISKCON ONE LOVE`;
  const text = [title, "", lead, "", code, "", tail].join("\n");
  const html =
    `<div style="font-family:-apple-system,'SF Pro Text',Segoe UI,Roboto,sans-serif;max-width:440px;margin:0 auto;padding:8px 4px;color:#1c1c1e">` +
    `<p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#a08214;font-weight:700;margin:0 0 14px">ISKCON ONE LOVE</p>` +
    `<h1 style="font-size:21px;letter-spacing:-0.3px;margin:0 0 10px">${escapeHtml(title)}</h1>` +
    `<p style="font-size:15px;line-height:1.5;color:#48484a;margin:0 0 18px">${escapeHtml(lead)}</p>` +
    `<div style="font-size:34px;font-weight:700;letter-spacing:10px;font-variant-numeric:tabular-nums;padding:16px 0 16px 10px;background:#f6f6f7;border-radius:14px;text-align:center;margin:0 0 18px">${escapeHtml(code)}</div>` +
    `<p style="font-size:13px;line-height:1.5;color:#8e8e93;margin:0">${escapeHtml(tail)}</p>` +
    `</div>`;
  return { subject, text, html };
}

/** Отправка кода. true — письмо принято хотя бы одним транспортом. */
export async function sendCodeMail(env: MailEnv, to: string, code: string, purpose: "reset" | "verify"): Promise<boolean> {
  const { subject, text, html } = codeLetter(code, purpose);
  const fromAddr = env.REPORT_FROM_ADDR || "noreply@gaurangers.com";

  // 1) Resend — произвольные адресаты.
  if (env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${FROM_NAME} <${fromAddr}>`, to: [to], subject, text, html }),
      });
      if (r.ok) return true;
    } catch {
      /* ниже — резерв */
    }
  }

  // 2) SEB — дойдёт только до верифицированных destination-адресов аккаунта.
  if (env.SEB) {
    try {
      const mm = createMimeMessage();
      mm.setSender({ name: FROM_NAME, addr: fromAddr });
      mm.setRecipient(to);
      mm.setSubject(subject);
      mm.addMessage({ contentType: "text/plain", data: text });
      await env.SEB.send(new EmailMessage(fromAddr, to, mm.asRaw()));
      return true;
    } catch {
      /* глушим — вызвавший решает сам */
    }
  }
  return false;
}
