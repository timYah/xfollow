import { DetectedUser } from "../utils/detector";

/**
 * Pauses execution for a random duration between min and max seconds.
 * @param minSeconds - Minimum wait time (e.g., 2)
 * @param maxSeconds - Maximum wait time (e.g., 5)
 */
export function sleepRandom(minMilliseconds: number, maxMilliseconds: number): Promise<void> {

  // Calculate random duration within the range
  const delay = Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) + minMilliseconds;

  return new Promise((resolve) => setTimeout(resolve, delay));
};

export async function hoverUser(user: DetectedUser) {
  // Also simulate movement at the element's center (client coordinates)
  const target = user.hoverElement!;
  const rect = target.getBoundingClientRect();
  const cx = Math.floor(rect.left + rect.width / 2);
  const cy = Math.floor(rect.top + rect.height / 2);

  const synth = (type: string, opts: any = {}) => {
    try {
      const ev = new PointerEvent(
        type as any,
        Object.assign(
          {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: cx,
            clientY: cy,
          },
          opts
        )
      );
      target.dispatchEvent(ev);
    } catch (e) {
      try {
        const ev2 = new MouseEvent(
          type,
          Object.assign(
            {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: cx,
              clientY: cy,
            },
            opts
          )
        );
        target.dispatchEvent(ev2);
      } catch (err) { }
    }
  };

  const evNames = [
    "pointermove",
    "mousemove",
    "pointerenter",
    "pointerover",
    "mouseenter",
    "mouseover",
  ];
  for (const n of evNames) synth(n);

  // Also dispatch on window to mimic real cursor movement
  try {
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: cx,
        clientY: cy,
      })
    );
  } catch { }

  await new Promise((r) => setTimeout(r, 350));

  return { cx, cy, target };
}

export async function removeHover(cx: number, cy: number, target: HTMLElement) {
  const synth = (type: string, opts: any = {}) => {
    try {
      const ev = new PointerEvent(
        type as any,
        Object.assign(
          {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: cx,
            clientY: cy,
          },
          opts
        )
      );
      target.dispatchEvent(ev);
    } catch (e) {
      try {
        const ev2 = new MouseEvent(
          type,
          Object.assign(
            {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: cx,
              clientY: cy,
            },
            opts
          )
        );
        target.dispatchEvent(ev2);
      } catch (err) { }
    }
  };

  const evNames = [
    "mouseleave",
    "mouseout",
    "pointerout",
    "pointerleave",
  ];
  for (const n of evNames) synth(n);
}

export function findFollowButton(user: DetectedUser) {
  try {
    const exact = document.querySelector(
      `button[aria-label="Follow ${user.handle}"]`,
    ) as HTMLElement | null;

    return exact;
  } catch (e) {
    return null;
  }
}

export function findGlobalVisibleFollow(
  handle?: string,
  cx?: number,
  cy?: number
): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll('button, [role="button"], a')
  ) as HTMLElement[];
  const isVisible = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <=
      (window.innerHeight || document.documentElement.clientHeight)
    );
  };

  const scored: Array<{
    el: HTMLElement;
    tid: string;
    aria: string;
    txt: string;
    cx: number;
    cy: number;
    dist: number;
  }> = [];
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const rect = el.getBoundingClientRect();
    const centerX = Math.floor(rect.left + rect.width / 2);
    const centerY = Math.floor(rect.top + rect.height / 2);
    const tid = (el.getAttribute && el.getAttribute("data-testid")) || "";
    const aria =
      (el.getAttribute && (el.getAttribute("aria-label") || "")) || "";
    const txt = (el.textContent || "").trim();
    const dist =
      typeof cx === "number" && typeof cy === "number"
        ? Math.hypot(centerX - cx, centerY - cy)
        : Infinity;
    scored.push({ el, tid, aria, txt, cx: centerX, cy: centerY, dist });
  }

  // Keep only follow-like candidates (avoid Reply / other controls)
  const followCandidates = scored.filter((s) => {
    if (
      handle &&
      s.aria.trim().toLowerCase() ===
      `follow ${handle}`.trim().toLowerCase()
    )
      return true;
    if (/-follow$/.test(s.tid)) return true;
    if (/\bfollow\b/i.test(s.aria) || /^follow$/i.test(s.txt)) return true;
    return false;
  });

  if (followCandidates.length === 0) return null;

  // Rank candidates by priority and distance
  const prioritize = (s: (typeof followCandidates)[number]) => {
    if (
      handle &&
      s.aria.trim().toLowerCase() ===
      `follow ${handle}`.trim().toLowerCase()
    )
      return 0;
    if (/-follow$/.test(s.tid)) return 1;
    if (/\bfollow\b/i.test(s.aria) || /^follow$/i.test(s.txt)) return 2;
    return 10;
  };

  followCandidates.sort((a, b) => {
    const pa = prioritize(a),
      pb = prioritize(b);
    if (pa !== pb) return pa - pb;
    return (a.dist || Infinity) - (b.dist || Infinity);
  });

  // choose best candidate but enforce reasonable proximity when coords provided
  const best = followCandidates[0];
  if (typeof cx === "number" && typeof cy === "number") {
    const maxDist = 180; // pixels
    if ((best.dist || Infinity) > maxDist) return null;
  }

  // Ensure we return the actual button element if possible
  let chosen = best.el;
  if (chosen.tagName !== "BUTTON") {
    const btn =
      chosen.closest && (chosen.closest("button") as HTMLElement | null);
    if (btn) chosen = btn;
    else {
      const inner =
        chosen.querySelector &&
        (chosen.querySelector("button") as HTMLElement | null);
      if (inner) chosen = inner;
    }
  }

  return chosen as HTMLElement | null;
}

export function looksLikeFollow(el: HTMLElement | null): boolean {
  if (!el) return false;

  const tid = (el.getAttribute && el.getAttribute("data-testid")) || "";
  const aria =
    (el.getAttribute && (el.getAttribute("aria-label") || "")) || "";
  const txt = (el.textContent || "").trim();
  if (/-follow$/.test(tid)) return true;
  if (/^follow(@|\s|$)/i.test(aria) || /\bfollow\b/i.test(txt)) return true;
  logger.info("aria:", aria, "txt:", txt);

  return false;
}

export function safeSendMessage(msg: any) {
  try {
    if (
      typeof browser !== "undefined" &&
      browser.runtime &&
      browser.runtime.sendMessage
    ) {
      return browser.runtime.sendMessage(msg).catch(() => { });
    }
  } catch (e) { }
  return Promise.resolve();
}

export function monitorRateLimits(queue: FollowQueue) {
  const observer = new MutationObserver((mutations) => {
    if (!queue || queue.getStats().status !== "running") return;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const text = node.textContent?.toLowerCase() || "";
          const isToast =
            node.getAttribute("data-testid") === "toast" ||
            node.querySelector('[data-testid="toast"]');
          const isAlert = node.getAttribute("role") === "alert";
          if (
            (isToast || isAlert) &&
            (text.includes("limit") ||
              text.includes("unable to follow"))
          ) {
            console.warn(
              "[xfollow] Rate limit detected! Stopping queue."
            );
            queue.stop();
            safeSendMessage({ type: "RATE_LIMIT_REACHED" });
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

export function preventNav(e: Event, followButton: any) {
  try {
    const me = e as MouseEvent;
    // Prefer composedPath when available
    const path = (me.composedPath &&
      me.composedPath()) ||
      (me as any).path ||
      [];
    if (path && path.length) {
      for (const node of path) {
        if (
          node instanceof
          HTMLAnchorElement
        ) {
          if (
            followButton &&
            (node ===
              followButton ||
              (
                node as HTMLElement
              ).contains(
                followButton as HTMLElement,
              ))
          ) {
            return;
          }
          e.preventDefault();
          return;
        }
      }
    }

    // Fallback: walk up from event target and look for anchors
    let node: Node | null = (me.target as Node) || null;
    while (
      node &&
      node !== (document as any)
    ) {
      if (
        node instanceof
        HTMLAnchorElement
      ) {
        if (
          followButton &&
          ((node as HTMLElement) ===
            followButton ||
            (
              node as HTMLElement
            ).contains(
              followButton as HTMLElement,
            ))
        ) {
          return;
        }
        e.preventDefault();
        return;
      }
      node = (node as any).parentNode ||
        (node as any).host ||
        null;
    }
  } catch (err) {
    // best-effort: do nothing if we can't inspect path
  }
};
