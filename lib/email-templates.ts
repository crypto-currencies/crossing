/**
 * Shared branded email layout for crossing.dev transactional emails.
 * Dark background, purple accent — matches site design tokens.
 */

export function emailLayout(opts: {
  title: string;
  heading: string;
  body: string;
  footer?: string;
}): string {
  const footer =
    opts.footer ??
    "If you didn't request this, you can safely ignore this email.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${opts.title}</title>
</head>
<body style="background:#08080f;margin:0;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:520px;margin:0 auto;">

    <!-- Wordmark -->
    <div style="margin-bottom:28px;padding-bottom:22px;border-bottom:1px solid #15152a;">
      <span style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:-0.5px;text-transform:lowercase;">crossing<span style="color:#a78bfa;">.dev</span></span>
    </div>

    <!-- Card -->
    <div style="background:#0e0e18;border:1px solid #1c1c32;border-radius:16px;padding:36px 32px;margin-bottom:20px;">
      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 12px;letter-spacing:-0.4px;">${opts.heading}</h1>
      ${opts.body}
    </div>

    <!-- Footer -->
    <p style="color:#3a3a54;font-size:12px;text-align:center;margin:0;line-height:1.6;">${footer}</p>

  </div>
</body>
</html>`;
}

export function emailCtaButton(label: string, url: string): string {
  return `<a href="${url}" style="display:block;background:#a78bfa;color:#09090e;text-decoration:none;text-align:center;padding:14px 24px;border-radius:9px;font-size:15px;font-weight:700;letter-spacing:-0.1px;margin-bottom:24px;">${label}</a>`;
}

export function emailFallbackUrl(url: string): string {
  return `<p style="color:#4a4a60;font-size:12px;margin:0 0 6px;">Or copy and paste this link:</p>
    <p style="color:#5a5a75;font-size:11px;word-break:break-all;margin:0;background:#06060f;padding:10px 12px;border-radius:6px;border:1px solid #161628;font-family:'Courier New',Courier,monospace;">${url}</p>`;
}

export function emailBodyText(text: string): string {
  return `<p style="color:#9191a4;font-size:14px;line-height:1.7;margin:0 0 24px;">${text}</p>`;
}
