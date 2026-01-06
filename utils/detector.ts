/**
 * Utility to detect verified users and their handles in X (Twitter) threads.
 */
import logger from "../utils/logger";

export interface DetectedUser {
  handle: string;
  displayName: string;
  isVerified: boolean;
  element: HTMLElement;
  // Element that should be hovered to reveal follow controls (e.g. display name span)
  hoverElement?: HTMLElement;
}

export const SELECTORS = {
  ARTICLE: 'article[data-testid="tweet"]',
  VERIFIED_BADGE: '[data-testid="icon-verified"]',
  USER_NAME: '[data-testid="User-Name"]',
  HANDLE: "span", // Starting with @
};

export function detectUsers(): DetectedUser[] {
  const users: DetectedUser[] = [];

  // get all articles in the current view
  const articles = document.querySelectorAll(SELECTORS.ARTICLE);
  // Strategy: For each article, find the User-Name container, then extract handle and display name, isVerified
  articles.forEach((article) => {
    const user: DetectedUser = {} as DetectedUser;

    // 1. fill the article element
    user.element = article as HTMLElement;

    // 2. find the User-Name container
    const userNameContainer = article.querySelector(SELECTORS.USER_NAME);
    if (!userNameContainer) return; // skip if not found

    // 3. get isVerified
    const verifiedBadge = userNameContainer.querySelector(
      SELECTORS.VERIFIED_BADGE
    );
    user.isVerified = !!verifiedBadge;

    // find a tag
    const aElements = userNameContainer.querySelectorAll("a");
    // if text in it starts with @, it's handle
    // else it's display name

    for (const el of aElements) {
      const spanElements = el.querySelectorAll("span");

      for (const span of spanElements) {
        let text = span.textContent || "";
        text = text.trim();

        if (text.startsWith("@")) {
          user.handle = text;
          user.hoverElement = el as HTMLElement;
        } else if (text.length > 0) {
          if (text !== "·") {
            user.displayName = text;
          }
        }
      }
    }

    logger.debug(
      `[xfollow] Detected user: handle=${user.handle}, displayName=${user.displayName}, isVerified=${user.isVerified}`
    );

    users.push(user);
  });

  return users;
}

/**
 * Finds all verified users in the current view of a thread.
 */
export function detectPremiumUsers(): DetectedUser[] {
  const users = detectUsers().filter((u) => u.isVerified);

  logger.debug("[xfollow] detectPremiumUsers...: ", users.length);
  return Array.from(new Map(users.map((u) => [u.handle, u])).values());
}

export type UserHandler = (user: DetectedUser) => boolean;
export class DetectService {
  private _newUserHandler: UserHandler;
  private _observer: MutationObserver;

  public constructor(newUserHandler: UserHandler) {
    this._newUserHandler = newUserHandler;
    this._observer = new MutationObserver(() => { });
  }

  private process() {
    const users = detectPremiumUsers();

    users.forEach((user) => {
      if (this._newUserHandler) {
        this._newUserHandler(user);
      }
    });

    safeSendMessage({
      type: "USERS_UPDATED",
      data: { count: users.length },
    });
  }

  public initService() {
    this._observer = new MutationObserver(() => this.process());
    this._observer.observe(document.body, { childList: true, subtree: true });
    this.process();

    window.addEventListener("pagehide", this.cleanup, { capture: true });
  }

  public cleanup() {
    try {
      this._observer.disconnect();
    } catch (e) { }
  }
}