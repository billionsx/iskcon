/**
 * Минимальная декларация модуля воркера "cloudflare:email" для tsc внутри src/.
 * worker.ts живёт ВНЕ include:["src"] и этим tsc не проверяется, а
 * account/mail.ts — внутри. Реализацию даёт рантайм Cloudflare (send_email
 * биндинг SEB в wrangler.toml); типы повторяют официальные workers-types.
 */
declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string | ReadableStream);
    readonly from: string;
    readonly to: string;
  }
}
