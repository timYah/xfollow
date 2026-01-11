import { DetectedUser, detectPremiumUsers, DetectService } from "../utils/detector";
import { FollowQueue } from "../utils/followQueue";
import { getSettings, isFollowed, markAsFollowed, getRateLimitState, clearRateLimitState, checkAndResetDailyStats, getDailyLimitState, clearDailyLimitState, resetDailyStats as storageResetDailyStats } from "../utils/storage";
import logger from "../utils/logger";
import {
  findGlobalVisibleFollow,
  hoverUser,
  looksLikeFollow,
  monitorRateLimits,
  safeSendMessage,
  preventNav,
  findFollowButton,
  removeHover,
  sleepRandom
} from "../utils";

async function processUser(user: DetectedUser, queue: FollowQueue) {
  const settings = await getSettings();

  if (
    settings.skipFollowed &&
    (await isFollowed(user.handle))
  ) {
    logger.info(
      `[xfollow] Skipping ${user.handle} (already followed)`,
    );
    
    return;
  }

  queue.add({
    handle: user.handle,
    onExecute: async () => {
      logger.info(
        `[xfollow] Attempting to follow ${user.handle}...`,
      );

      if (!user.hoverElement || !user.element) {
        return false;
      }

      // Scroll into view to reduce chance of hitting nearby floating items
      try {
        (
          user.element as HTMLElement
        ).scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "auto",
        });
      } catch { }

      logger.debug('hover user: ', user.displayName);
      const { cx, cy, target } = await hoverUser(user);

      await sleepRandom(1000, 2000);

      const followButton = findFollowButton(user);

      logger.debug('follow button: ', followButton);

      if (followButton == null) {

        await removeHover(cx, cy, target);

        return false;
      }

      await sleepRandom(1000, 3000);

      // 4) Diagnostic log the chosen element and ensure visibility
      try {
        try {
          const rect = followButton.getBoundingClientRect();
          logger.info(
            "[xfollow] Clicking element",
            {
              tag: followButton.tagName,
              aria: followButton.getAttribute &&
                followButton.getAttribute(
                  "aria-label",
                ),
              testid: followButton.getAttribute &&
                followButton.getAttribute(
                  "data-testid",
                ),
              rect: {
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height,
              },
              outer: (
                followButton.outerHTML ||
                ""
              ).slice(0, 500),
            },
          );
        } catch (logErr) { }

        followButton.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
          } as any),
        );
        followButton.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
          } as any),
        );
        followButton.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );

        logger.debug('clicked follow button: ', followButton);

        await removeHover(cx, cy, target);
        logger.debug('remove hover');
      } catch (err) {
        logger.error(
          "[xfollow] click error",
          err,
        );
      }

      await sleepRandom(500, 1500);

      const newTxt = (
        followButton.textContent || ""
      )
        .trim()
        .toLowerCase();
      const newAria = (
        followButton.getAttribute &&
        (followButton.getAttribute(
          "aria-label",
        ) ||
          "")
      ).toLowerCase() || "";
      if (
        newTxt === "following" ||
        newAria.startsWith("following")
      ) {
        await markAsFollowed(user.handle);
        return true;
      }

      console.warn(
        `[xfollow] Follow attempt may have failed for ${user.handle}; button text:`,
        newTxt || newAria,
      );
      return false;
    },
  });
}

export default defineContentScript({
  matches: ["*://*.x.com/*"],
  async main() {
    logger.info("[xfollow] Content script initialized.");
    const settings = await getSettings();
    let detectedHandles = new Set<string>();
    let detectedUsers = new Array<DetectedUser>();

    let queue: FollowQueue = new FollowQueue({
      minDelay: settings.minDelay,
      maxDelay: settings.maxDelay,
      rateLimitThreshold: settings.rateLimitThreshold,
      rateLimitDuration: settings.rateLimitDuration,
      dailyFollowLimit: settings.dailyFollowLimit,
    });

    // Check for existing rate limit on startup
    const rateLimitState = await getRateLimitState();
    if (rateLimitState && rateLimitState.pauseUntil > Date.now()) {
      queue.updateRateLimitConfig(settings.rateLimitThreshold, settings.rateLimitDuration);
      // Enter rate limit state with the saved values
      queue.enterRateLimitState(rateLimitState.pauseUntil, rateLimitState.successSinceLastPause);
    } else if (rateLimitState) {
      // Rate limit expired, clear it
      await clearRateLimitState();
    }

    // Check for daily limit state on startup
    await checkAndResetDailyStats();
    const dailyLimitState = await getDailyLimitState();
    if (dailyLimitState && dailyLimitState.isLimited) {
      queue.updateDailyLimit(settings.dailyFollowLimit);
    }

    let detectService = new DetectService((user: DetectedUser) => {
      if (!detectedHandles.has(user.handle)) {
        detectedHandles.add(user.handle);

        detectedUsers.push(user);
        logger.info(
          `[xfollow] Detected premium user: ${user.handle}`,
        );
      }

      return true;
    });

    detectService.initService();
    // Clean up when the page is being unloaded to avoid operations after unload
    window.addEventListener("pagehide", () => { queue?.stop(); }, { capture: true });

    // Messaging
    browser.runtime.onMessage.addListener(
      (message, sender, sendResponse) => {
        if (message.type === "GET_STATUS") {
          const stats = queue?.getStats() || {
            total: 0,
            remaining: 0,
            processed: 0,
            success: 0,
            status: "idle",
          };
          sendResponse({
            ...stats,
            detectedCount: detectedHandles.size,
          });
        }

        if (message.type === "GET_RATE_LIMIT_INFO") {
          const rateLimitInfo = queue?.getRateLimitInfo();
          sendResponse(rateLimitInfo);
        }

        if (message.type === "GET_DAILY_LIMIT_INFO") {
          const dailyLimitInfo = queue?.getDailyLimitInfo();
          sendResponse(dailyLimitInfo);
        }

        if (message.type === "RESET_DAILY_STATS") {
          (async () => {
            await storageResetDailyStats();
            await queue?.resumeFromDailyLimit();
            sendResponse({ status: "ok" });
          })();
          return true;
        }

        if (message.type === "START_FOLLOW") {
          (async () => {
            queue.start();
            sendResponse({ status: "started" });

            while (queue?.getStats().status === "running") {
              if (detectedUsers.length === 0) { 
                await sleepRandom(1000, 3000);
              }

              const user = detectedUsers.shift();

              if (user) { 
                await processUser(user, queue);
              } 
            }
          })();
          return true;
        }

        if (message.type === "STOP_FOLLOW") {
          queue?.stop();
          sendResponse({ status: "stopped" });
        }
        if (message.type === "RESET_HISTORY") {
          sendResponse({ status: "ok" });
        }
        return true;
      },
    );

    // Rate limit monitor
    monitorRateLimits(queue!);
  },
});
