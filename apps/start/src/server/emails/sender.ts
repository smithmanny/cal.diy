export type EmailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
};

export type EmailSender = (message: EmailMessage) => Promise<void>;

/** Resend's HTTP API works on Workers (no SMTP sockets there) and on Node. */
export function createResendSender(apiKey: string, fetchImpl: typeof fetch = fetch): EmailSender {
  return async (message) => {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        reply_to: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: btoa(unescape(encodeURIComponent(a.content))),
          content_type: a.contentType,
        })),
      }),
    });
    if (!response.ok)
      throw new Error(`Resend rejected the email with ${response.status}: ${await response.text()}`);
  };
}
