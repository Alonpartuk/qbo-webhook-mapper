/**
 * QBO Proxy Service - Unified Data Fetching
 *
 * Provides a unified interface for querying QuickBooks Online entities
 * with support for:
 * - Multiple entity types (customers, items, invoices, accounts, vendors)
 * - Search and filtering
 * - Pagination (limit/offset)
 * - Full object retrieval with sanitized output
 *
 * Uses executeWithTokenRefresh for automatic token handling and retry on 401.
 */

import { executeWithTokenRefresh, TokenErrorCodes } from './tokenManager';

// QBO API base URLs
const QBO_BASE_URL = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
};

// Supported entity types
export type QboEntityType = 'customers' | 'items' | 'invoices' | 'accounts' | 'vendors';

// Entity type to QBO API entity name mapping
const ENTITY_MAP: Record<QboEntityType, string> = {
  customers: 'Customer',
  items: 'Item',
  invoices: 'Invoice',
  accounts: 'Account',
  vendors: 'Vendor',
};

// Fields to search by for each entity type
const SEARCH_FIELDS: Record<QboEntityType, string> = {
  customers: 'DisplayName',
  items: 'Name',
  invoices: 'DocNumber',
  accounts: 'Name',
  vendors: 'DisplayName',
};

// Status field mapping (if applicable)
const STATUS_FIELDS: Record<QboEntityType, string | null> = {
  customers: 'Active',
  items: 'Active',
  invoices: null, // Invoices don't have Active field
  accounts: 'Active',
  vendors: 'Active',
};

// Custom error codes for proxy API
export const ProxyErrorCodes = {
  QBO_UNAVAILABLE: 'ERR_QBO_UNAVAILABLE',
  TOKEN_EXPIRED: 'ERR_TOKEN_EXPIRED',
  TOKEN_REVOKED: 'ERR_TOKEN_REVOKED',
  INVALID_TYPE: 'ERR_INVALID_TYPE',
  INVALID_QUERY: 'ERR_INVALID_QUERY',
  NOT_FOUND: 'ERR_NOT_FOUND',
  RATE_LIMITED: 'ERR_RATE_LIMITED',
} as const;

// Query options interface
export interface ProxyQueryOptions {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  offset?: number;
}

// Result interface
export interface ProxyResult<T> {
  success: boolean;
  data?: T[];
  error?: string;
  errorCode?: string;
  needsReconnect?: boolean;
  meta?: {
    type: QboEntityType;
    count: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Single entity result
export interface ProxySingleResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  needsReconnect?: boolean;
}

// QBO Fault type
interface QBOFault {
  Error?: Array<{ Message?: string; Detail?: string; code?: string }>;
}

// QBO API response types
interface QBOQueryResponse<T> {
  QueryResponse?: T & {
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
  Fault?: QBOFault;
}

// Single response wrapper - specific entity key plus optional Fault
interface QBOSingleResponseBase {
  Fault?: QBOFault;
  _notFound?: boolean;
}

type QBOSingleResponse<T> = QBOSingleResponseBase & {
  [key: string]: T | QBOFault | boolean | undefined;
};

/**
 * Get base URL based on environment
 */
function getBaseUrl(): string {
  const env = process.env.QBO_ENVIRONMENT || 'sandbox';
  return QBO_BASE_URL[env as keyof typeof QBO_BASE_URL] || QBO_BASE_URL.sandbox;
}

/**
 * Build QBO SQL-like query string
 */
function buildQuery(
  entityType: QboEntityType,
  options: ProxyQueryOptions
): string {
  const entity = ENTITY_MAP[entityType];
  const searchField = SEARCH_FIELDS[entityType];
  const statusField = STATUS_FIELDS[entityType];
  const { search, status = 'active', limit = 100, offset = 0 } = options;

  let query = `SELECT * FROM ${entity}`;
  const conditions: string[] = [];

  // Add status filter (for entities that support it)
  if (statusField && status !== 'all') {
    const isActive = status === 'active';
    conditions.push(`${statusField} = ${isActive}`);
  }

  // Add search filter (case-insensitive LIKE)
  if (search && search.trim()) {
    const escapedSearch = search.replace(/'/g, "\\'");
    conditions.push(`${searchField} LIKE '%${escapedSearch}%'`);
  }

  // Build WHERE clause
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  // Add pagination
  // QBO uses STARTPOSITION (1-indexed) and MAXRESULTS
  const startPosition = offset + 1;
  query += ` STARTPOSITION ${startPosition} MAXRESULTS ${limit}`;

  return query;
}

/**
 * Parse QBO error response
 */
function parseQboError(fault: QBOQueryResponse<unknown>['Fault']): {
  message: string;
  code: string;
} {
  if (!fault?.Error || fault.Error.length === 0) {
    return { message: 'Unknown QBO error', code: 'UNKNOWN' };
  }

  const error = fault.Error[0];
  return {
    message: error.Message || error.Detail || 'QBO API error',
    code: error.code || 'QBO_ERROR',
  };
}

/**
 * Sanitize and flatten QBO entity for API response
 * Removes internal metadata, keeps business-relevant fields
 */
function sanitizeEntity<T extends Record<string, unknown>>(entity: T): T {
  // Fields to exclude from response (QBO metadata)
  const excludeFields = ['domain', 'sparse', 'SyncToken'];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(entity)) {
    if (!excludeFields.includes(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Fetch multiple entities with filtering and pagination
 */
export async function fetchEntities<T = Record<string, unknown>>(
  organizationId: string,
  entityType: QboEntityType,
  options: ProxyQueryOptions = {}
): Promise<ProxyResult<T>> {
  // Validate entity type
  if (!ENTITY_MAP[entityType]) {
    return {
      success: false,
      error: `Invalid entity type: ${entityType}`,
      errorCode: ProxyErrorCodes.INVALID_TYPE,
    };
  }

  const baseUrl = getBaseUrl();
  const query = buildQuery(entityType, options);
  const entityName = ENTITY_MAP[entityType];
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  console.log(`[QboProxy] Fetching ${entityType} for org ${organizationId}`);
  console.log(`[QboProxy] Query: ${query}`);

  type ResponseType = QBOQueryResponse<{ [K in typeof entityName]?: T[] }>;

  const result = await executeWithTokenRefresh<ResponseType>(
    organizationId,
    async (accessToken, realmId) => {
      const url = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`;
      return fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
    },
    async (response) => response.json() as Promise<ResponseType>
  );

  // Handle token/connection errors
  if (!result.success) {
    console.error(`[QboProxy] Token error for ${entityType}:`, result.error);

    let errorCode: string = ProxyErrorCodes.QBO_UNAVAILABLE;
    if (result.errorCode === TokenErrorCodes.TOKEN_EXPIRED) {
      errorCode = ProxyErrorCodes.TOKEN_EXPIRED;
    } else if (result.errorCode === TokenErrorCodes.TOKEN_REVOKED) {
      errorCode = ProxyErrorCodes.TOKEN_REVOKED;
    }

    return {
      success: false,
      error: result.error || 'Failed to connect to QuickBooks',
      errorCode,
      needsReconnect: result.needsReconnect,
    };
  }

  const data = result.data!;

  // Handle QBO API errors
  if (data.Fault) {
    const errorInfo = parseQboError(data.Fault);
    console.error(`[QboProxy] QBO API error:`, errorInfo);
    return {
      success: false,
      error: errorInfo.message,
      errorCode: ProxyErrorCodes.INVALID_QUERY,
    };
  }

  // Extract entities from response
  const entities = (data.QueryResponse?.[entityName] || []) as T[];
  const sanitizedEntities = entities.map(e => sanitizeEntity(e as Record<string, unknown>)) as T[];

  // Determine if there might be more results
  const hasMore = entities.length === limit;

  console.log(`[QboProxy] Fetched ${sanitizedEntities.length} ${entityType}`);

  return {
    success: true,
    data: sanitizedEntities,
    meta: {
      type: entityType,
      count: sanitizedEntities.length,
      limit,
      offset,
      hasMore,
    },
  };
}

/**
 * Fetch a single entity by ID
 */
export async function fetchEntityById<T = Record<string, unknown>>(
  organizationId: string,
  entityType: QboEntityType,
  entityId: string
): Promise<ProxySingleResult<T>> {
  // Validate entity type
  if (!ENTITY_MAP[entityType]) {
    return {
      success: false,
      error: `Invalid entity type: ${entityType}`,
      errorCode: ProxyErrorCodes.INVALID_TYPE,
    };
  }

  const baseUrl = getBaseUrl();
  const entityName = ENTITY_MAP[entityType];

  console.log(`[QboProxy] Fetching ${entityType}/${entityId} for org ${organizationId}`);

  type ResponseType = QBOSingleResponse<T>;

  const result = await executeWithTokenRefresh<ResponseType>(
    organizationId,
    async (accessToken, realmId) => {
      const url = `${baseUrl}/v3/company/${realmId}/${entityName.toLowerCase()}/${entityId}`;
      return fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
    },
    async (response) => {
      if (response.status === 404) {
        return { _notFound: true } as unknown as ResponseType;
      }
      return response.json() as Promise<ResponseType>;
    }
  );

  // Handle token/connection errors
  if (!result.success) {
    console.error(`[QboProxy] Token error for ${entityType}/${entityId}:`, result.error);

    let errorCode: string = ProxyErrorCodes.QBO_UNAVAILABLE;
    if (result.errorCode === TokenErrorCodes.TOKEN_EXPIRED) {
      errorCode = ProxyErrorCodes.TOKEN_EXPIRED;
    } else if (result.errorCode === TokenErrorCodes.TOKEN_REVOKED) {
      errorCode = ProxyErrorCodes.TOKEN_REVOKED;
    }

    return {
      success: false,
      error: result.error || 'Failed to connect to QuickBooks',
      errorCode,
      needsReconnect: result.needsReconnect,
    };
  }

  const data = result.data!;

  // Handle not found
  if ('_notFound' in data && data._notFound) {
    return {
      success: false,
      error: `${entityName} with ID ${entityId} not found`,
      errorCode: ProxyErrorCodes.NOT_FOUND,
    };
  }

  // Handle QBO API errors
  if (data.Fault) {
    const errorInfo = parseQboError(data.Fault);
    console.error(`[QboProxy] QBO API error:`, errorInfo);
    return {
      success: false,
      error: errorInfo.message,
      errorCode: ProxyErrorCodes.INVALID_QUERY,
    };
  }

  // Extract entity from response
  const entity = data[entityName] as T | undefined;
  if (!entity) {
    return {
      success: false,
      error: `${entityName} with ID ${entityId} not found`,
      errorCode: ProxyErrorCodes.NOT_FOUND,
    };
  }

  const sanitizedEntity = sanitizeEntity(entity as Record<string, unknown>) as T;

  console.log(`[QboProxy] Fetched ${entityType}/${entityId}`);

  return {
    success: true,
    data: sanitizedEntity,
  };
}

/**
 * Get supported entity types
 */
export function getSupportedTypes(): QboEntityType[] {
  return Object.keys(ENTITY_MAP) as QboEntityType[];
}

/**
 * Validate if a type is supported
 */
export function isValidType(type: string): type is QboEntityType {
  return type in ENTITY_MAP;
}
