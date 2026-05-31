const express = require('express');
const path = require('path');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 9000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MAX_CONCURRENT_BROWSERS = 3;
const PAGE_TIMEOUT = 10000;

class BrowserPool {
  constructor() {
    this.activeCount = 0;
    this.queue = [];
    this.browsers = new Map();
  }

  async getBrowser() {
    if (this.activeCount < MAX_CONCURRENT_BROWSERS) {
      this.activeCount++;
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote'
        ]
      });
      
      const browserId = this._generateId();
      this.browsers.set(browserId, {
        browser,
        inUse: true,
        createdAt: Date.now()
      });
      
      browser.on('disconnected', () => {
        this.browsers.delete(browserId);
      });
      
      return { browser, browserId };
    }
    
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  releaseBrowser(browserId) {
    const browserInfo = this.browsers.get(browserId);
    if (!browserInfo) return;

    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve({ browser: browserInfo.browser, browserId });
    } else {
      this.activeCount--;
      browserInfo.inUse = false;
      this._closeBrowser(browserId);
    }
  }

  async _closeBrowser(browserId) {
    const browserInfo = this.browsers.get(browserId);
    if (!browserInfo) return;

    try {
      const { browser } = browserInfo;
      if (browser.isConnected()) {
        const contexts = browser.contexts();
        for (const context of contexts) {
          try {
            await context.close();
          } catch (e) {}
        }
        await browser.close();
      }
    } catch (e) {
    } finally {
      this.browsers.delete(browserId);
    }
  }

  async forceCleanupBrowser(browserId) {
    const browserInfo = this.browsers.get(browserId);
    if (!browserInfo) return;

    try {
      const { browser } = browserInfo;
      if (browser.isConnected()) {
        const contexts = browser.contexts();
        for (const context of contexts) {
          try {
            const pages = context.pages();
            for (const page of pages) {
              try {
                await page.close({ runBeforeUnload: false });
              } catch (e) {}
            }
            await context.close();
          } catch (e) {}
        }
        await browser.close();
      }
    } catch (e) {
    } finally {
      this.browsers.delete(browserId);
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
  }

  async closeAll() {
    const browserIds = Array.from(this.browsers.keys());
    for (const browserId of browserIds) {
      await this.forceCleanupBrowser(browserId);
    }
    this.activeCount = 0;
    this.queue = [];
  }

  _generateId() {
    return `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

const browserPool = new BrowserPool();

async function cleanupContext(context) {
  if (!context) return;
  
  try {
    const pages = context.pages();
    for (const page of pages) {
      try {
        page.removeAllListeners();
        await page.close({ runBeforeUnload: false }).catch(() => {});
      } catch (e) {}
    }
    await context.close().catch(() => {});
  } catch (e) {}
}

const MOBILE_UAS = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function takeScreenshot(options) {
  const {
    url,
    width = 1920,
    height = 1080,
    waitForNetworkIdle = false,
    format = 'png',
    quality = 80,
    customCss = '',
    customJs = '',
    fullPage = false,
    autoFullPage = false,
    device = 'desktop'
  } = options;

  let browserInfo = null;
  let context = null;
  let page = null;
  let timeoutId = null;
  let isTimedOut = false;

  try {
    browserInfo = await browserPool.getBrowser();
    const { browser, browserId } = browserInfo;

    if (!browser.isConnected()) {
      await browserPool.forceCleanupBrowser(browserId);
      throw new Error('Browser disconnected');
    }

    const userAgent = MOBILE_UAS[device] || MOBILE_UAS.desktop;

    context = await browser.newContext({
      viewport: { width: parseInt(width), height: parseInt(height) },
      userAgent: userAgent,
      isMobile: device === 'iphone' || device === 'android',
      hasTouch: device === 'iphone' || device === 'android',
      deviceScaleFactor: device === 'desktop' ? 1 : 3
    });

    page = await context.newPage();

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        reject(new Error('TIMEOUT'));
      }, PAGE_TIMEOUT);
    });

    const screenshotPromise = (async () => {
      try {
        if (customJs) {
          await page.addInitScript(customJs);
        }

        await page.goto(url, {
          waitUntil: waitForNetworkIdle ? 'networkidle' : 'load',
          timeout: PAGE_TIMEOUT
        });

        if (isTimedOut) return null;

        if (customCss) {
          await page.addStyleTag({ content: customCss });
        }

        if (isTimedOut) return null;

        let screenshotOptions = {
          type: format === 'jpeg' ? 'jpeg' : 'png',
          fullPage: fullPage,
          timeout: PAGE_TIMEOUT
        };

        if (autoFullPage && !fullPage) {
          const scrollHeight = await page.evaluate(() => {
            return Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight,
              document.body.offsetHeight,
              document.documentElement.offsetHeight,
              document.body.clientHeight,
              document.documentElement.clientHeight
            );
          });

          const viewportWidth = parseInt(width);
          await page.setViewportSize({ width: viewportWidth, height: Math.max(scrollHeight, parseInt(height)) });

          await page.waitForTimeout(500);

          screenshotOptions = {
            type: format === 'jpeg' ? 'jpeg' : 'png',
            fullPage: false,
            timeout: PAGE_TIMEOUT,
            clip: {
              x: 0,
              y: 0,
              width: viewportWidth,
              height: scrollHeight
            }
          };
        }

        if (format === 'jpeg') {
          screenshotOptions.quality = parseInt(quality);
        }

        const buffer = await page.screenshot(screenshotOptions);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        return buffer;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
      }
    })();

    return await Promise.race([screenshotPromise, timeoutPromise]);

  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    if (browserInfo && (isTimedOut || error.message === 'TIMEOUT')) {
      await browserPool.forceCleanupBrowser(browserInfo.browserId);
      browserInfo = null;
    }
    
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    
    if (context) {
      await cleanupContext(context);
      context = null;
    }
    
    if (browserInfo) {
      browserPool.releaseBrowser(browserInfo.browserId);
    }
    
    page = null;
  }
}

app.get('/screenshot', async (req, res) => {
  try {
    const buffer = await takeScreenshot(req.query);
    const format = req.query.format === 'jpeg' ? 'jpeg' : 'png';
    res.set('Content-Type', `image/${format}`);
    res.send(buffer);
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      res.status(408).json({ error: 'Request timeout', code: 'TIMEOUT' });
    } else {
      res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
    }
  }
});

app.post('/screenshot', async (req, res) => {
  try {
    const options = { ...req.query, ...req.body };
    const buffer = await takeScreenshot(options);
    const format = options.format === 'jpeg' ? 'jpeg' : 'png';
    res.set('Content-Type', `image/${format}`);
    res.send(buffer);
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      res.status(408).json({ error: 'Request timeout', code: 'TIMEOUT' });
    } else {
      res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
    }
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeBrowsers: browserPool.activeCount,
    queuedRequests: browserPool.queue.length,
    maxConcurrent: MAX_CONCURRENT_BROWSERS,
    trackedBrowsers: browserPool.browsers.size
  });
});

const server = app.listen(PORT, () => {
  console.log(`Screenshot service running on port ${PORT}`);
  console.log(`Max concurrent browsers: ${MAX_CONCURRENT_BROWSERS}`);
  console.log(`Page timeout: ${PAGE_TIMEOUT}ms`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await browserPool.closeAll();
  server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await browserPool.closeAll();
  server.close();
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  await browserPool.closeAll();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
