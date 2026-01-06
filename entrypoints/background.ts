import logger from '../utils/logger';

export default defineBackground(() => {
  logger.info('Hello background!', { id: browser.runtime.id });
});
