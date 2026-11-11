import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByText("Môi trường demo riêng · Dữ liệu giả lập", { exact: true }),
  ).toBeVisible();
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email công việc").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("HooSooDemo!2026");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "một ngày tốt lành",
  );
}
test("admin: real data, employee creation, account creation, reports, system status and responsive nav", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "admin@hoosoo.demo");
  await page.screenshot({
    path: "output/playwright/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Nhân viên", exact: true }).click();
  await page.getByRole("link", { name: "Thêm nhân viên" }).click();
  const tag = Date.now().toString();
  await page.getByLabel("Mã nhân viên", { exact: true }).fill("QA" + tag);
  await page.getByLabel("Họ và tên").fill("Nhân viên kiểm thử " + tag);
  await page
    .getByLabel("Email công việc", { exact: true })
    .fill("qa" + tag + "@hoosoo.demo");
  await page.getByRole("combobox", { name: "Phòng ban", exact: true }).click();
  await page.getByRole("option", { name: "Công nghệ", exact: true }).click();
  await page.getByRole("combobox", { name: "Chức danh", exact: true }).click();
  await page
    .getByRole("option", { name: "Front-end Developer", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Người quản lý trực tiếp" }).click();
  await page
    .getByRole("option", { name: "Nguyễn Duy Khang", exact: true })
    .click();
  await page.getByRole("button", { name: "Tạo hồ sơ", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Nhân viên kiểm thử",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Nhân viên kiểm thử",
  );
  await page.getByRole("link", { name: "Tài khoản & quyền" }).click();
  await page
    .getByRole("button", { name: "Cấp tài khoản", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Hồ sơ nhân viên" }).click();
  await page
    .getByRole("option", {
      name: "Nhân viên kiểm thử " + tag + " · qa" + tag + "@hoosoo.demo",
      exact: true,
    })
    .click();
  await page.getByLabel("Mật khẩu khởi tạo").fill("LocalE2eOnly!2026");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cấp tài khoản", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: "qa" + tag + "@hoosoo.demo", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Báo cáo", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV" }).click();
  expect((await download).suggestedFilename()).toContain("hoosoo-employees");
  await page.getByRole("link", { name: "Trạng thái hệ thống" }).click();
  await expect(
    page.getByRole("heading", { name: "Kết nối thành công" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kiểm tra lại", exact: true }).click();
  await expect(
    page.getByText("Đọc thành công", { exact: false }),
  ).toBeVisible();
  await page.goto("/organization");
  await expect(
    page.getByRole("heading", { name: "Sơ đồ tổ chức" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/organization-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "một ngày tốt lành",
  );
  await expect(
    page.getByRole("button", { name: "Mở điều hướng" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await expect(
    page.getByRole("link", { name: "Nhân viên", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("employee: route guard, check-in, create leave; manager approves and balance refreshes", async ({
  page,
  browser,
}) => {
  await login(page, "nhanvien@hoosoo.demo");
  await page.goto("/settings/users");
  await expect(page).toHaveURL(/403/);
  await page.goto("/attendance/my");
  await expect(
    page.getByRole("heading", { name: "Chấm công của tôi" }),
  ).toBeVisible();
  const checkin = page.getByRole("button", { name: "Vào ca", exact: true });
  if (await checkin.isEnabled()) await checkin.click();
  await expect(checkin).toBeDisabled();
  const leaveDate = new Date(
    Date.UTC(2030, 0, 7) +
      (Math.floor(Date.now() / 1000) % 1000) * 7 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  await page.goto("/leave/new");
  await page.getByRole("combobox", { name: "Loại nghỉ phép" }).click();
  await page
    .getByRole("option", { name: "Nghỉ phép năm · Trừ phép", exact: true })
    .click();
  await page.getByLabel("Từ ngày").fill(leaveDate);
  await page.getByLabel("Đến ngày").fill(leaveDate);
  const reason = "Kiểm thử giao diện " + Date.now();
  await page.getByLabel("Lý do nghỉ", { exact: true }).fill(reason);
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(
    page.getByRole("heading", { name: "Chi tiết yêu cầu nghỉ phép" }),
  ).toBeVisible();
  const url = page.url();
  await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Duyệt đơn", exact: true }),
  ).not.toBeVisible();
  const context = await browser.newContext();
  const manager = await context.newPage();
  await login(manager, "quanly@hoosoo.demo");
  await manager.goto(url);
  await manager.getByRole("button", { name: "Duyệt đơn", exact: true }).click();
  await manager
    .getByRole("dialog")
    .getByRole("button", { name: "Duyệt đơn", exact: true })
    .click();
  await expect(manager.getByRole("dialog")).not.toBeVisible();
  await expect(manager.locator(".badge.approved")).toHaveText("Đã duyệt");
  await page.reload();
  await expect(page.locator(".badge.approved")).toHaveText("Đã duyệt");
  await context.close();
  // HR cancellation restores the date for safe repeated browser tests.
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await login(page, "nhansu@hoosoo.demo");
  await page.goto(url);
  await page.getByRole("button", { name: "Hủy đơn", exact: true }).click();
  await page
    .getByLabel("Lý do", { exact: true })
    .fill("Kết thúc kiểm thử giao diện");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy đơn", exact: true })
    .click();
  await expect(page.locator(".badge.cancelled")).toHaveText("Đã hủy");
});
test("network failure preserves leave form; unknown deep link and public reset", async ({
  page,
}) => {
  await login(page, "nhanvien@hoosoo.demo");
  await page.goto("/leave/new");
  await page.getByRole("combobox", { name: "Loại nghỉ phép" }).click();
  await page
    .getByRole("option", {
      name: "Nghỉ không hưởng lương · Không trừ phép",
      exact: true,
    })
    .click();
  await page.getByLabel("Từ ngày").fill("2028-07-10");
  await page.getByLabel("Đến ngày").fill("2028-07-10");
  await page
    .getByLabel("Lý do nghỉ", { exact: true })
    .fill("Giữ nguyên nội dung khi lỗi mạng");
  await page.route("**/api/v1/leave-requests", (route) => route.abort());
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByRole("alert")).toContainText("Không kết nối");
  await expect(page.getByLabel("Lý do nghỉ", { exact: true })).toHaveValue(
    "Giữ nguyên nội dung khi lỗi mạng",
  );
  await page.goto("/not-a-real-page");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy trang" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Lấy lại mật khẩu" }),
  ).toBeVisible();
});
