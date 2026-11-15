// This page fetches only the in-memory catalog on load. Business requests are
// made exclusively by the submit handler; no polling, retries, or SSE listeners.
const $ = (id) => document.getElementById(id);
const state = {
  catalog: null,
  group: "all",
  method: "all",
  search: "",
  selected: null,
  controller: null,
};
let toastTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function notify(text) {
  clearTimeout(toastTimer);
  $("toast").textContent = text;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 2500);
}

function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

function renderGroups() {
  const fragment = document.createDocumentFragment();
  for (const group of [
    { id: "all", name: "Tất cả API", count: state.catalog.routes.length },
    ...state.catalog.groups,
  ]) {
    const button = element("button", "group-button");
    button.type = "button";
    button.setAttribute("aria-current", String(state.group === group.id));
    button.append(
      element("span", "", group.name),
      element("span", "group-count", group.count),
    );
    button.addEventListener("click", () => {
      state.group = group.id;
      $("group-title").textContent = group.name;
      renderGroups();
      renderRoutes();
      $("group-nav")
        .querySelector('[aria-current="true"]')
        ?.focus({ preventScroll: true });
    });
    fragment.append(button);
  }
  const scroll = $("group-nav").scrollLeft;
  $("group-nav").replaceChildren(fragment);
  $("group-nav").scrollLeft = scroll;
}

function matches(route) {
  return (
    (state.group === "all" || route.group === state.group) &&
    (state.method === "all" || state.method === route.method) &&
    normalize(`${route.title} ${route.path} ${route.method}`).includes(
      normalize(state.search.trim()),
    )
  );
}

function renderRoutes() {
  const routes = state.catalog.routes.filter(matches);
  $("result-count").textContent = `${routes.length} kết quả`;
  const fragment = document.createDocumentFragment();
  for (const group of state.catalog.groups) {
    const members = routes.filter((route) => route.group === group.id);
    if (!members.length) continue;
    fragment.append(element("h3", "route-section-label", group.name));
    for (const route of members) {
      const button = element("button", "route-button");
      button.type = "button";
      button.dataset.routeId = route.id;
      button.setAttribute(
        "aria-pressed",
        String(state.selected?.id === route.id),
      );
      button.setAttribute("aria-controls", "inspector");
      const summary = element("span", "route-summary");
      summary.append(
        element("span", "route-title", route.title),
        element("code", "route-path", route.path),
      );
      const chevron = element("span", "route-chevron", "›");
      chevron.setAttribute("aria-hidden", "true");
      button.append(
        element("span", `method ${route.method.toLowerCase()}`, route.method),
        summary,
        chevron,
      );
      button.addEventListener("click", () => {
        selectRoute(route);
        if (matchMedia("(max-width: 680px)").matches) {
          $("inspector").scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "start",
          });
          $("detail-title").focus({ preventScroll: true });
        }
      });
      fragment.append(button);
    }
  }
  if (!routes.length)
    fragment.append(
      element(
        "p",
        "empty-list",
        "Không tìm thấy API phù hợp. Thử tên hoặc đường dẫn khác.",
      ),
    );
  $("route-list").replaceChildren(fragment);
  // Keep the selected endpoint visible in the current filter without any fetch.
  if (routes.length && !routes.some((route) => route.id === state.selected?.id))
    selectRoute(routes[0]);
  if (!routes.length) {
    cancelRequest();
    state.selected = null;
    $("inspector").hidden = true;
  }
}

function cancelRequest() {
  state.controller?.abort();
  state.controller = null;
  $("send").disabled = false;
  $("cancel").hidden = true;
}

function resetResponse() {
  $("response-meta").textContent = "";
  $("response-meta").className = "";
  $("response-body").hidden = true;
  $("response-body").textContent = "";
  $("response-empty").hidden = false;
  $("request-error").hidden = true;
  $("request-id").hidden = true;
  $("request-id").textContent = "";
}

function selectRoute(route) {
  if (state.selected?.id === route.id) return;
  cancelRequest();
  state.selected = route;
  $("inspector").hidden = false;
  $("detail-title").textContent = route.title;
  $("detail-title").tabIndex = -1;
  $("detail-group").textContent = state.catalog.groups.find(
    (group) => group.id === route.group,
  ).name;
  $("detail-access").textContent =
    route.authentication === "public" ? "Không cần token" : "Yêu cầu xác thực";
  $("detail-permission").textContent = route.access;
  $("detail-method").textContent = route.method;
  $("detail-method").className = `method ${route.method.toLowerCase()}`;
  $("detail-path").textContent = route.path;
  $("detail-response").textContent = route.response;
  $("effect-note").textContent = route.note;
  $("effect-note").className =
    `notice ${route.effect === "none" ? "safe" : "warning"}`;
  $("query").value = "";
  $("query-field").hidden = !route.testable || !route.queryParameters.length;
  $("query").placeholder = route.path.endsWith("/messages")
    ? "after=0"
    : route.queryParameters.includes("page")
      ? "page=1&pageSize=20"
      : "startDate=2026-01-01&endDate=2026-01-31";
  $("query-hint").textContent = route.queryParameters.join(" · ");
  $("auth-field").hidden = !route.testable || route.authentication === "public";
  $("token").required = route.testable && route.authentication === "bearer";
  $("token").disabled = !route.testable || route.authentication === "public";
  $("send").hidden = !route.testable;
  $("copy-curl").hidden = !route.testable;
  $("request-actions").hidden = !route.testable;
  $("write-headers").hidden = !route.idempotency;
  $("write-headers").textContent = route.idempotency
    ? `Headers: Authorization: Bearer <ID_TOKEN> · Idempotency-Key: <UUID> · Content-Type: ${route.bodyType}${route.bodyType === "application/pdf" ? " · X-Record-Version · X-File-Name" : ""}`
    : "";
  $("path-fields").replaceChildren();
  if (route.testable)
    for (const [, name] of route.path.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)) {
      const field = element("div", "field");
      const label = element("label", "", `${name} *`);
      const input = element("input");
      input.id = `param-${name}`;
      label.htmlFor = input.id;
      input.name = name;
      input.dataset.pathParam = name;
      input.required = true;
      input.autocomplete = "off";
      input.placeholder = `Nhập ${name}`;
      field.append(label, input);
      $("path-fields").append(field);
    }
  document
    .querySelectorAll(".route-button")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.routeId === route.id),
      ),
    );
  resetResponse();
}

function requestUrl(route) {
  let path = route.path;
  for (const input of $("path-fields").querySelectorAll("input")) {
    const value = input.value.trim();
    // Reject path traversal and slash injection even when percent-encoded.
    if (!value || value === "." || value === ".." || /[/\\%?#]/.test(value))
      throw new Error(`Kiểm tra giá trị ${input.name}.`);
    path = path.replace(`:${input.name}`, encodeURIComponent(value));
  }
  const url = new URL(path, location.origin);
  url.search = new URLSearchParams(
    $("query").value.trim().replace(/^\?/, ""),
  ).toString();
  if (url.origin !== location.origin)
    throw new Error("Chỉ kiểm tra API trên máy chủ hiện tại.");
  return url;
}

async function readText(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0,
    result = "";
  const limit = 256 * 1024;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = limit - size;
      result += decoder.decode(value.subarray(0, remaining), { stream: true });
      size += value.length;
      if (size >= limit) {
        await reader.cancel();
        return result + "\n… Chỉ hiển thị 256 KB đầu tiên.";
      }
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

$("request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const route = state.selected;
  if (
    !route?.testable ||
    state.controller ||
    !$("request-form").reportValidity()
  )
    return;
  resetResponse();
  let controller,
    timer,
    timedOut = false;
  try {
    const url = requestUrl(route);
    const headers = { Accept: route.response };
    const token = $("token")
      .value.trim()
      .replace(/^Bearer\s+/i, "");
    if (route.authentication === "bearer") {
      if (!token)
        throw new Error("Nhập Firebase ID token để kiểm tra API này.");
      headers.Authorization = `Bearer ${token}`;
    }
    controller = new AbortController();
    state.controller = controller;
    $("send").disabled = true;
    $("cancel").hidden = false;
    $("response-meta").textContent = "Đang gửi…";
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    const start = performance.now();
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    let body;
    if (contentType.includes("application/pdf")) {
      body = `Tệp PDF · ${response.headers.get("content-length") ?? "Không rõ"} byte\nXem nội dung CV trong ứng dụng HooSoo.`;
      await response.body?.cancel();
    } else {
      body = await readText(response);
      if (contentType.includes("json")) {
        try {
          body = JSON.stringify(JSON.parse(body), null, 2);
        } catch {
          /* Show bounded response as text. */
        }
      }
    }
    if (state.controller !== controller) return;
    $("response-meta").textContent =
      `${response.status} ${response.statusText} · ${Math.round(performance.now() - start)} ms`;
    $("response-meta").className = response.ok ? "success" : "error";
    $("response-empty").hidden = true;
    $("response-body").hidden = false;
    $("response-body").textContent = body || "Không có nội dung phản hồi.";
    const id = response.headers.get("x-request-id");
    $("request-id").hidden = !id;
    $("request-id").textContent = id ? `Request ID: ${id}` : "";
  } catch (error) {
    if (controller && state.controller !== controller) return;
    $("response-meta").textContent = "";
    $("request-error").hidden = false;
    $("request-error").textContent =
      error.name === "AbortError"
        ? timedOut
          ? "Hết thời gian chờ (15 giây). Không tự gửi lại."
          : "Đã dừng yêu cầu."
        : error instanceof TypeError
          ? "Không nhận được phản hồi. Kiểm tra kết nối API."
          : error.message;
  } finally {
    clearTimeout(timer);
    if (state.controller === controller) {
      state.controller = null;
      $("send").disabled = false;
      $("cancel").hidden = true;
    }
  }
});

$("cancel").addEventListener("click", () => state.controller?.abort());
$("clear-token").addEventListener("click", () => {
  $("token").value = "";
  notify("Đã xóa token khỏi tab.");
});
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Đã sao chép.");
  } catch {
    notify("Không thể sao chép. Vui lòng chọn và sao chép nội dung.");
  }
}
$("copy-path").addEventListener("click", () => {
  if (state.selected) void copy(location.origin + state.selected.path);
});
$("copy-curl").addEventListener("click", () => {
  try {
    const url = requestUrl(state.selected).href.replace(/'/g, "'\\''");
    void copy(
      `curl --request GET '${url}'${state.selected.authentication === "bearer" ? ' \\\n  --header "Authorization: Bearer $FIREBASE_ID_TOKEN"' : ""}`,
    );
  } catch (error) {
    notify(error.message);
  }
});
$("search").addEventListener("input", () => {
  if (state.catalog) {
    state.search = $("search").value;
    renderRoutes();
  }
});
document.querySelectorAll('input[name="method"]').forEach((input) =>
  input.addEventListener("change", () => {
    if (state.catalog) {
      state.method = input.value;
      renderRoutes();
    }
  }),
);
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    $("search").focus();
  }
});
$("origin").textContent = location.host;
try {
  const theme = localStorage.getItem("hoosoo-api-theme");
  if (["light", "dark"].includes(theme))
    document.documentElement.dataset.theme = theme;
} catch {
  /* Storage can be disabled. */
}
$("theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = dark ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("hoosoo-api-theme", theme);
  } catch {
    /* Theme remains tab-local. */
  }
});
window.addEventListener("pagehide", () => {
  cancelRequest();
  $("token").value = "";
  $("response-body").textContent = "";
});

async function init() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("/api-explorer/catalog.json", {
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Catalog unavailable");
    state.catalog = await response.json();
    $("total-count").textContent =
      `${state.catalog.routes.length} endpoints · ${state.catalog.groups.length} nhóm`;
    renderGroups();
    renderRoutes();
  } catch {
    $("group-nav").replaceChildren();
    $("load-error").hidden = false;
    $("load-error").textContent =
      "Không tải được danh mục API. Tải lại trang để thử lại.";
  } finally {
    clearTimeout(timeout);
  }
}
void init();
