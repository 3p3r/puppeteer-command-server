import { Router, Request, Response } from 'express';
import { loadConfig, updateConfig } from '../config/index.js';
import { ConfigUpdateRequest, ApiResponse, Config } from '../types/index.js';

const router = Router();

/**
 * @swagger
 * /api/config/get:
 *   get:
 *     summary: Get current configuration
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
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
 *                     chromePath:
 *                       type: string
 *                       nullable: true
 *                     port:
 *                       type: number
 */
router.get('/get', async (_req: Request, res: Response) => {
  try {
    const config = loadConfig();

    const response: ApiResponse<Config> = {
      success: true,
      data: config
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
 * /api/config/set:
 *   post:
 *     summary: Update configuration
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chromePath:
 *                 type: string
 *                 nullable: true
 *               port:
 *                 type: number
 *     responses:
 *       200:
 *         description: Configuration updated successfully
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
 *                     chromePath:
 *                       type: string
 *                       nullable: true
 *                     port:
 *                       type: number
 */
router.post('/set', async (req: Request, res: Response) => {
  try {
    const request: ConfigUpdateRequest = req.body;

    // Validate port if provided
    if (request.port !== undefined && (request.port < 1 || request.port > 65535)) {
      return res.status(400).json({
        success: false,
        error: 'Port must be between 1 and 65535'
      });
    }

    const updatedConfig = updateConfig(request);

    const response: ApiResponse<Config> = {
      success: true,
      data: updatedConfig
    };

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as configRouter };
