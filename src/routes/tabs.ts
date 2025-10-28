import { Router, Request, Response } from 'express';
import { BrowserManager } from '../browser/BrowserManager.js';
import { 
  OpenTabRequest, 
  NavigateRequest, 
  ClickRequest, 
  HoverRequest, 
  FillRequest, 
  SelectRequest, 
  EvalRequest,
  ApiResponse,
  TabNotFoundError 
} from '../types/index.js';

const router = Router();

// Initialize browser manager
let browserManager: BrowserManager;

export function initializeTabsRoutes(chromePath?: string | null): void {
  browserManager = new BrowserManager(chromePath);
}

/**
 * @swagger
 * /api/tabs/open:
 *   post:
 *     summary: Open a new browser tab
 *     tags: [Tabs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL to navigate to
 *               headless:
 *                 type: boolean
 *                 description: Whether to run in headless mode
 *     responses:
 *       200:
 *         description: Tab opened successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tabId:
 *                       type: string
 */
router.post('/open', async (req: Request, res: Response) => {
  try {
    const request: OpenTabRequest = req.body;
    
    if (!request.url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const tabId = await browserManager.openTab(request);
    
    const response: ApiResponse<{ tabId: string }> = {
      success: true,
      data: { tabId }
    };
    
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/list:
 *   get:
 *     summary: List all open tabs
 *     tags: [Tabs]
 *     responses:
 *       200:
 *         description: List of tabs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       url:
 *                         type: string
 *                       title:
 *                         type: string
 *                       headless:
 *                         type: boolean
 */
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const tabs = await browserManager.getTabs();
    
    const response: ApiResponse<typeof tabs> = {
      success: true,
      data: tabs
    };
    
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/goto/{tabId}:
 *   post:
 *     summary: Navigate tab to URL
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Navigation successful
 */
router.post('/goto/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    const request: NavigateRequest = req.body;
    
    if (!request.url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }

    await browserManager.navigateTab(tabId, request.url);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/screenshot/{tabId}:
 *   get:
 *     summary: Take screenshot of tab
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: fullPage
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Screenshot taken successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     screenshot:
 *                       type: string
 *                       format: base64
 */
router.get('/screenshot/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    const fullPage = req.query['fullPage'] === 'true';
    
    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }
    
    const screenshot = await browserManager.screenshotTab(tabId, fullPage);
    
    const response: ApiResponse<{ screenshot: string }> = {
      success: true,
      data: { screenshot }
    };
    
    return res.json(response);
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/click/{tabId}:
 *   post:
 *     summary: Click element in tab
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *               waitForNavigation:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Click successful
 */
router.post('/click/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    const request: ClickRequest = req.body;
    
    if (!request.selector) {
      return res.status(400).json({
        success: false,
        error: 'Selector is required'
      });
    }

    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }

    await browserManager.clickElement(tabId, request.selector, request.waitForNavigation);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/hover/{tabId}:
 *   post:
 *     summary: Hover over element in tab
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *     responses:
 *       200:
 *         description: Hover successful
 */
router.post('/hover/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    const request: HoverRequest = req.body;
    
    if (!request.selector) {
      return res.status(400).json({
        success: false,
        error: 'Selector is required'
      });
    }

    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }

    await browserManager.hoverElement(tabId, request.selector);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/fill/{tabId}:
 *   post:
 *     summary: Fill form field in tab
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fill successful
 */
router.post('/fill/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    const request: FillRequest = req.body;
    
    if (!request.selector || !request.value) {
      return res.status(400).json({
        success: false,
        error: 'Selector and value are required'
      });
    }

    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }

    await browserManager.fillField(tabId, request.selector, request.value);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/select/{tabId}:
 *   post:
 *     summary: Select dropdown option in tab
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Select successful
 */
router.post('/select/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    const request: SelectRequest = req.body;
    
    if (!request.selector || !request.value) {
      return res.status(400).json({
        success: false,
        error: 'Selector and value are required'
      });
    }

    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }

    await browserManager.selectOption(tabId, request.selector, request.value);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/eval/{tabId}:
 *   post:
 *     summary: Execute JavaScript in tab
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               script:
 *                 type: string
 *     responses:
 *       200:
 *         description: Script executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     result:
 *                       type: any
 */
router.post('/eval/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    const request: EvalRequest = req.body;
    
    if (!request.script) {
      return res.status(400).json({
        success: false,
        error: 'Script is required'
      });
    }

    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }

    const result = await browserManager.evaluateScript(tabId, request.script);
    
    const response: ApiResponse<{ result: any }> = {
      success: true,
      data: { result }
    };
    
    return res.json(response);
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/tabs/close/{tabId}:
 *   delete:
 *     summary: Close tab
 *     tags: [Tabs]
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tab closed successfully
 */
router.delete('/close/:tabId', async (req: Request, res: Response) => {
  try {
    const { tabId } = req.params;
    
    if (!tabId) {
      return res.status(400).json({
        success: false,
        error: 'Tab ID is required'
      });
    }
    
    await browserManager.closeTab(tabId);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof TabNotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as tabsRouter };
