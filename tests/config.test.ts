import { expect, it } from "vitest";
import { readConfig } from "@/server/config";
it("works without credentials and fails closed on unimplemented providers", () => {
  expect(readConfig({}).TEACHER_PROVIDER).toBe("demo");
  expect(() => readConfig({ TEACHER_PROVIDER: "live" })).toThrow(
    "TEACHER_PROVIDER",
  );
  expect(() => readConfig({ DAILY_DEMO_UNIT_LIMIT: "NaN" })).toThrow(
    "DAILY_DEMO_UNIT_LIMIT",
  );
});
it("requires exact origins and secure cookies for HTTPS", () => {
  expect(() => readConfig({ APP_ORIGIN: "https://melissa.example" })).toThrow(
    "COOKIE_SECURE",
  );
  expect(() => readConfig({ APP_ORIGIN: "http://melissa.example" })).toThrow(
    "HTTPS",
  );
  expect(() =>
    readConfig({ APP_ORIGIN: "http://127.0.0.1:3000/path" }),
  ).toThrow("origin");
  expect(
    readConfig({ APP_ORIGIN: "https://melissa.example", COOKIE_SECURE: "true" })
      .COOKIE_SECURE,
  ).toBe("true");
});
