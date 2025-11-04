import { type Request, type Response, Router } from 'express';
import type { ApiResponse } from '../types/index.js';

const router = Router();

// Store references to resources (will be populated by MCP server)
export const ALL_IMAGES = new Map<string, { list: any; read: any }>();

/**
 * @swagger
 * /api/resources/clean:
 *   delete:
 *     summary: Remove a specific screenshot resource by URI
 *     tags: [Resources]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               uri:
 *                 type: string
 *                 description: Resource URI to remove
 *     responses:
 *       200:
 *         description: Resource removed successfully
 *       400:
 *         description: URI is required
 */
router.delete('/clean', (req: Request, res: Response) => {
  try {
    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({
        success: false,
        error: 'URI is required'
      });
    }

    const existed = ALL_IMAGES.has(uri);
    ALL_IMAGES.delete(uri);

    const response: ApiResponse<{ removed: boolean }> = {
      success: true,
      data: { removed: existed }
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
 * /api/resources/cleanAll:
 *   delete:
 *     summary: Remove all screenshot resources
 *     tags: [Resources]
 *     responses:
 *       200:
 *         description: All resources removed successfully
 */
router.delete('/cleanAll', (_req: Request, res: Response) => {
  try {
    const count = ALL_IMAGES.size;
    ALL_IMAGES.clear();

    const response: ApiResponse<{ count: number }> = {
      success: true,
      data: { count }
    };

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as resourcesRouter };

