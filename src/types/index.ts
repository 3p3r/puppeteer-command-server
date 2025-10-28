export interface Config {
  chromePath: string | null;
  port: number;
}

export interface TabInfo {
  id: string;
  url: string;
  title?: string;
  headless: boolean;
}

export interface OpenTabRequest {
  url: string;
  headless?: boolean;
}

export interface NavigateRequest {
  url: string;
}

export interface ClickRequest {
  selector: string;
  waitForNavigation?: boolean;
}

export interface HoverRequest {
  selector: string;
}

export interface FillRequest {
  selector: string;
  value: string;
}

export interface SelectRequest {
  selector: string;
  value: string;
}

export interface EvalRequest {
  script: string;
}

export interface ConfigUpdateRequest {
  chromePath?: string;
  port?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// Error classes
export class BrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserError';
  }
}

export class TabNotFoundError extends Error {
  constructor(tabId: string) {
    super(`Tab with ID ${tabId} not found`);
    this.name = 'TabNotFoundError';
  }
}
