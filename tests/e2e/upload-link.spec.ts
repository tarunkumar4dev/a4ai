// Student upload link (/s/:token) end to end, Supabase mocked (mockSupabase.ts). Phone viewport (Pixel 5).
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { CODE, MockSupabase, TOKEN } from "./mockSupabase";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function enterCode(page: Page) {
  await page.goto(`/s/${TOKEN}`);
  await page.getByLabel("Enter your access code").fill(CODE.toLowerCase());     // auto upper-case
  await page.getByTestId("code-submit").click();
  await expect(page.getByTestId("confirm-step")).toContainText("Are you Asha Verma, Class 12");
  await page.getByRole("button", { name: "Yes, that's me" }).click();
  await expect(page.getByTestId("upload-panel")).toBeVisible();
}

test("happy path: code → confirm → 2 images (one HEIC) → submit → being checked → published marks", async ({ page }) => {
  const db = new MockSupabase();
  await db.install(page);
  await enterCode(page);
  await expect(page.getByTestId("link-header")).toContainText("Physics Unit Test 2");
  await expect(page.getByTestId("deadline-countdown")).toContainText(/\d+ days? \d+ hours? left/);

  await page.getByTestId("gallery-input").setInputFiles([path.join(FIX, "page1.jpg"), path.join(FIX, "page2.heic")]);
  await expect(page.getByTestId("thumb")).toHaveCount(2, { timeout: 60_000 });
  await expect(page.getByTestId("page-counter")).toHaveText("2/30 pages");

  await page.getByTestId("submit-btn").click();
  const attempt = page.getByTestId("attempt").first();
  await expect(attempt).toContainText("Upload-1");
  await expect(attempt.getByTestId("attempt-status")).toHaveText("Being checked ⏳");

  // both pages went straight to Storage under the student's folder; the HEIC was sent as JPEG
  expect(db.okUploads).toHaveLength(2);
  for (const u of db.okUploads) expect(u.path).toMatch(/^inst-1\/asg-1\/stu-1\/[0-9a-f-]{36}\.jpg$/);
  expect(db.createCalls).toHaveLength(1);
  expect(db.createCalls[0].files.map(f => f.page_order)).toEqual([1, 2]);

  db.publish(7, 10);                                     // worker checked it, teacher published it
  await expect(page.getByTestId("result-marks")).toHaveText("7 / 10", { timeout: 25_000 });   // 10 s polling
  await expect(attempt.getByTestId("attempt-status")).toHaveText("Result ready");
  await page.getByTestId("result-toggle").click();
  await expect(page.getByTestId("result-view")).toContainText("Unit missing");
});

test("expired link shows a friendly page, not a 404", async ({ page }) => {
  const db = new MockSupabase();
  db.linkState = "closed";
  await db.install(page);
  await page.goto(`/s/${TOKEN}`);
  await expect(page.getByTestId("link-state")).toContainText("Uploads closed");
  await expect(page.getByTestId("link-state")).toContainText("talk to your teacher");
  await expect(page.getByTestId("code-step")).toHaveCount(0);
});

test("locked access code: message, countdown, button disabled", async ({ page }) => {
  const db = new MockSupabase();
  db.verifyLocked = true;
  await db.install(page);
  await page.goto(`/s/${TOKEN}`);
  await page.getByLabel("Enter your access code").fill(CODE);
  await page.getByTestId("code-submit").click();
  await expect(page.getByTestId("code-message")).toContainText("Too many wrong codes");
  await expect(page.getByTestId("code-message")).toContainText(/1[45] min/);
  await expect(page.getByTestId("code-submit")).toBeDisabled();
  await expect(page.getByTestId("code-submit")).toContainText("Wait");
});

test("double-tap on submit makes one submission", async ({ page }) => {
  const db = new MockSupabase();
  db.createDelayMs = 1500;
  await db.install(page);
  await enterCode(page);
  await page.getByTestId("gallery-input").setInputFiles(path.join(FIX, "page1.jpg"));
  await expect(page.getByTestId("thumb")).toHaveCount(1);
  const btn = page.getByTestId("submit-btn");
  await btn.click();
  await btn.click({ force: true });
  await btn.dispatchEvent("click");
  await expect(page.getByTestId("attempt")).toHaveCount(1);
  expect(db.attempts).toHaveLength(1);
  expect(new Set(db.createCalls.map(c => c.key)).size).toBe(1);
});

test("refresh in the middle of an upload resumes: only the missing file goes up again", async ({ page }) => {
  const db = new MockSupabase();
  db.failUploadsAfter = 1;                               // network drops after the first file
  await db.install(page);
  await enterCode(page);
  await page.getByTestId("gallery-input").setInputFiles([path.join(FIX, "page1.jpg"), path.join(FIX, "page2.heic")]);
  await expect(page.getByTestId("thumb")).toHaveCount(2, { timeout: 60_000 });
  await page.getByTestId("submit-btn").click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(db.okUploads).toHaveLength(1);
  expect(db.createCalls).toHaveLength(0);

  await page.reload();                                   // code is remembered for this link
  await expect(page.getByTestId("upload-panel")).toBeVisible();
  await expect(page.getByTestId("thumb")).toHaveCount(2);
  await expect(page.getByTestId("notice")).toContainText("1 of 2 pages uploaded");

  db.failUploadsAfter = null;
  await page.getByTestId("submit-btn").click();
  await expect(page.getByTestId("attempt")).toHaveCount(1);
  expect(db.okUploads).toHaveLength(2);                  // 1 before the drop + only the missing one after
  expect(db.createCalls).toHaveLength(1);
  expect(db.createCalls[0].files).toHaveLength(2);
});

test("an 11 MB file is refused with a clear message", async ({ page }) => {
  const db = new MockSupabase();
  await db.install(page);
  await enterCode(page);
  await page.getByTestId("gallery-input").setInputFiles({
    name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(11 * 1024 * 1024, 1),
  });
  await expect(page.getByTestId("pick-errors")).toContainText("big.pdf is 11 MB. Max 10 MB.");
  await expect(page.getByTestId("thumb")).toHaveCount(0);
});

test("after the deadline (accept_flag) the student is warned it will be late", async ({ page }) => {
  const db = new MockSupabase();
  db.linkState = "open_late";
  await db.install(page);
  await enterCode(page);
  await expect(page.getByTestId("late-warning")).toContainText("marked late");
});
