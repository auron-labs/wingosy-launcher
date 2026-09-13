import { describe, it, expect } from "vitest";

import normalizeUrl from "./normalize-url.js";

describe(normalizeUrl, () => {
  it("returns falsy input unchanged", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl()).toBeUndefined();
  });

  it("trims and strips trailing slashes", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
    expect(normalizeUrl("example.com///")).toBe("https://example.com");
  });

  it("preserves existing http/https", () => {
    expect(normalizeUrl("http://localhost:8080")).toBe("http://localhost:8080");
    expect(normalizeUrl("https://romm.example/api")).toBe(
      "https://romm.example/api"
    );
  });

  it("uses http for localhost and loopback", () => {
    expect(normalizeUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeUrl("127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(normalizeUrl("0.0.0.0")).toBe("http://0.0.0.0");
  });

  it("uses http for RFC1918-style hosts", () => {
    expect(normalizeUrl("192.168.1.50")).toBe("http://192.168.1.50");
    expect(normalizeUrl("10.0.0.1:9090")).toBe("http://10.0.0.1:9090");
    expect(normalizeUrl("172.16.0.1")).toBe("http://172.16.0.1");
    expect(normalizeUrl("172.31.255.1")).toBe("http://172.31.255.1");
  });

  it("uses http for .local and .lan", () => {
    expect(normalizeUrl("nas.local")).toBe("http://nas.local");
    expect(normalizeUrl("server.lan:8080")).toBe("http://server.lan:8080");
  });

  it("uses https for public hostnames", () => {
    expect(normalizeUrl("romm.io")).toBe("https://romm.io");
    expect(normalizeUrl("cloud.example.com")).toBe("https://cloud.example.com");
  });
});
