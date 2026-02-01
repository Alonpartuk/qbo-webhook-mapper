/**
 * Endpoint Documentation Component
 *
 * Displays detailed documentation for a single API endpoint.
 * Includes parameters, request/response examples, and error codes.
 */

import { Copy, Check, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { ApiEndpoint } from '../../pages/DeveloperHub';
import CodeSnippetGenerator from './CodeSnippetGenerator';

interface EndpointDocProps {
  endpoint: ApiEndpoint;
  orgSlug?: string;
  apiKey?: string;
  baseUrl?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-yellow-500',
  DELETE: 'bg-red-500',
};

const PARAM_LOCATION_COLORS: Record<string, string> = {
  path: 'bg-purple-100 text-purple-700',
  query: 'bg-blue-100 text-blue-700',
  header: 'bg-yellow-100 text-yellow-700',
  body: 'bg-green-100 text-green-700',
};

export default function EndpointDoc({ endpoint, orgSlug, apiKey, baseUrl }: EndpointDocProps) {
  const [copiedResponse, setCopiedResponse] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedResponse(index);
    setTimeout(() => setCopiedResponse(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`px-2 py-1 text-xs font-bold text-white rounded ${
              METHOD_COLORS[endpoint.method]
            }`}
          >
            {endpoint.method}
          </span>
          <code className="text-lg font-mono text-gray-900">{endpoint.path}</code>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">{endpoint.title}</h2>
        <p className="text-gray-600">{endpoint.description}</p>
      </div>

      {/* Code Snippets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Code Examples</h3>
        <CodeSnippetGenerator
          endpoint={endpoint}
          orgSlug={orgSlug}
          apiKey={apiKey}
          baseUrl={baseUrl}
        />
      </div>

      {/* Parameters */}
      {endpoint.parameters && endpoint.parameters.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Parameters</h3>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {endpoint.parameters.map((param) => (
                  <tr key={param.name}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="text-sm font-mono text-gray-900">
                        {param.name}
                        {param.required && (
                          <span className="text-red-500 ml-0.5">*</span>
                        )}
                      </code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          PARAM_LOCATION_COLORS[param.location]
                        }`}
                      >
                        {param.location}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {param.type}
                      {param.enum && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({param.enum.join(' | ')})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {param.description}
                      {param.default && (
                        <span className="text-xs text-gray-400 ml-2">
                          Default: {param.default}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Body */}
      {endpoint.requestBody && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Body</h3>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
              <span className="text-xs text-gray-400">{endpoint.requestBody.contentType}</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(endpoint.requestBody!.example, null, 2),
                    -1
                  )
                }
                className="text-gray-400 hover:text-white transition-colors"
              >
                {copiedResponse === -1 ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
              {JSON.stringify(endpoint.requestBody.example, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Responses */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Responses</h3>
        <div className="space-y-4">
          {endpoint.responses.map((response, index) => (
            <div key={index} className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      response.status >= 200 && response.status < 300
                        ? 'bg-green-100 text-green-700'
                        : response.status >= 400 && response.status < 500
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {response.status}
                  </span>
                  <span className="text-sm text-gray-600">{response.description}</span>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(response.example, null, 2), index)
                  }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {copiedResponse === index ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="bg-gray-900">
                <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(response.example, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Codes */}
      {endpoint.errorCodes && endpoint.errorCodes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Codes</h3>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                The following error codes may be returned in the <code className="bg-yellow-100 px-1 rounded">code</code> field of error responses.
              </p>
            </div>
            <div className="space-y-2">
              {endpoint.errorCodes.map((error) => (
                <div
                  key={error.code}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg"
                >
                  <code className="text-sm font-mono text-red-600 flex-shrink-0">
                    {error.code}
                  </code>
                  <span className="text-sm text-gray-600">{error.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
