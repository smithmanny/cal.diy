export const htmlEscape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The card every Cal.diy email uses; `body` is already-escaped HTML. */
export function emailLayout(heading: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:system-ui,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px"><h1 style="margin:0 0 24px;font-size:20px">${htmlEscape(heading)}</h1>
${body}
</td></tr></table></td></tr></table></body></html>`;
}

export function emailButton(label: string, url: string): string {
  return `<p style="margin:24px 0 0"><a href="${htmlEscape(url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">${htmlEscape(label)}</a></p>`;
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;white-space:pre-line">${htmlEscape(text)}</p>`;
}
