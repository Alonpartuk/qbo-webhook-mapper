/**
 * Code Snippet Generator Component
 *
 * Generates code snippets in multiple languages for API endpoints.
 * Supports Curl, Node.js (fetch), and Python (requests).
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { ApiEndpoint } from '../../pages/DeveloperHub';

interface CodeSnippetGeneratorProps {
  endpoint: ApiEndpoint;
  apiKey?: string;
  baseUrl?: string;
  orgSlug?: string;
}

type Language = 'curl' | 'node' | 'python';

const LANGUAGE_LABELS: Record<Language, string> = {
  curl: 'cURL',
  node: 'Node.js',
  python: 'Python',
};

export default function CodeSnippetGenerator({
  endpoint,
  apiKey,
  baseUrl,
  orgSlug,
}: CodeSnippetGeneratorProps) {
  // Use provided values or smart defaults
  const effectiveBaseUrl = baseUrl || import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
  const effectiveOrgSlug = orgSlug || 'your-org-slug';
  const effectiveApiKey = apiKey || 'qbo_live_YOUR_API_KEY_HERE';
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('curl');
  const [copied, setCopied] = useState(false);

  // Build the full URL with path parameters replaced
  const buildUrl = () => {
    let path = endpoint.path;
    path = path.replace(':clientSlug', effectiveOrgSlug);
    path = path.replace(':type', 'customers');
    path = path.replace(':id', '1');

    // Add query parameters for GET requests
    if (endpoint.method === 'GET' && endpoint.parameters) {
      const queryParams = endpoint.parameters
        .filter((p) => p.location === 'query' && p.default)
        .map((p) => `${p.name}=${p.default}`)
        .join('&');

      // Add type parameter if it exists
      const typeParam = endpoint.parameters.find(
        (p) => p.name === 'type' && p.location === 'query'
      );
      if (typeParam) {
        const params = queryParams ? `type=customers&${queryParams}` : 'type=customers';
        return `${effectiveBaseUrl}${path}?${params}`;
      }

      if (queryParams) {
        return `${effectiveBaseUrl}${path}?${queryParams}`;
      }
    }

    return `${effectiveBaseUrl}${path}`;
  };

  // Generate Curl snippet
  const generateCurl = (): string => {
    const url = buildUrl();
    let curl = `curl -X ${endpoint.method} "${url}"`;

    // Add headers
    curl += ` \\\n  -H "X-API-Key: ${effectiveApiKey}"`;
    curl += ` \\\n  -H "Accept: application/json"`;

    // Add body for POST/PUT
    if (endpoint.requestBody) {
      curl += ` \\\n  -H "Content-Type: ${endpoint.requestBody.contentType}"`;
      curl += ` \\\n  -d '${JSON.stringify(endpoint.requestBody.example)}'`;
    }

    return curl;
  };

  // Generate Node.js snippet
  const generateNode = (): string => {
    const url = buildUrl();
    const hasBody = endpoint.requestBody;

    let code = `const response = await fetch("${url}", {
  method: "${endpoint.method}",
  headers: {
    "X-API-Key": "${effectiveApiKey}",
    "Accept": "application/json"`;

    if (hasBody) {
      code += `,
    "Content-Type": "${endpoint.requestBody!.contentType}"`;
    }

    code += `
  }`;

    if (hasBody) {
      code += `,
  body: JSON.stringify(${JSON.stringify(endpoint.requestBody!.example, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : '  ' + line))
        .join('\n')})`;
    }

    code += `
});

const data = await response.json();
console.log(data);`;

    return code;
  };

  // Generate Python snippet
  const generatePython = (): string => {
    const url = buildUrl();
    const hasBody = endpoint.requestBody;

    let code = `import requests

url = "${url}"
headers = {
    "X-API-Key": "${effectiveApiKey}",
    "Accept": "application/json"`;

    if (hasBody) {
      code += `,
    "Content-Type": "${endpoint.requestBody!.contentType}"`;
    }

    code += `
}`;

    if (hasBody) {
      code += `

payload = ${JSON.stringify(endpoint.requestBody!.example, null, 4)
        .split('\n')
        .map((line, i) => (i === 0 ? line : line))
        .join('\n')}

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=payload)`;
    } else {
      code += `

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)`;
    }

    code += `
data = response.json()
print(data)`;

    return code;
  };

  const getSnippet = (): string => {
    switch (selectedLanguage) {
      case 'curl':
        return generateCurl();
      case 'node':
        return generateNode();
      case 'python':
        return generatePython();
      default:
        return generateCurl();
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Language Tabs */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
        <div className="flex gap-1">
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                selectedLanguage === lang
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code Display */}
      <div className="bg-gray-900 p-4 overflow-x-auto">
        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
          {getSnippet()}
        </pre>
      </div>
    </div>
  );
}
