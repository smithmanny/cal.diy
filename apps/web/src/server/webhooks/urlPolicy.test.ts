import { describe, expect, it } from "vitest";
import { isAllowedWebhookUrl, isPrivateHost } from "./urlPolicy";

describe("webhook URL policy", () => {
  it("refuses this server's own network", () => {
    for (const url of [
      "http://localhost:5678/hook",
      "http://app.localhost/",
      "http://127.0.0.1/",
      "http://2130706433/",
      "http://0.0.0.0/",
      "http://10.0.0.5/",
      "http://172.20.1.1/",
      "http://192.168.1.10/",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.64.0.1/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://[fd00::1]/",
      "http://[fe80::1]/",
      "http://n8n:5678/webhook",
      "http://printer.local/",
      "http://metadata.google.internal/",
      "ftp://example.com/",
      "not a url",
    ])
      expect(isAllowedWebhookUrl(url, false), url).toBe(false);
  });

  it("allows public hosts, and private ones when the instance opts in", () => {
    for (const url of ["https://hooks.example.com/cal", "http://8.8.8.8/", "https://[2606:4700::1111]/"])
      expect(isAllowedWebhookUrl(url, false), url).toBe(true);
    expect(isAllowedWebhookUrl("http://localhost:5678/hook", true)).toBe(true);
    expect(isAllowedWebhookUrl("ftp://localhost/", true)).toBe(false);
    expect(isPrivateHost("172.32.0.1")).toBe(false);
  });
});
