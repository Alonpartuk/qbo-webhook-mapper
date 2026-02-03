/**
 * Documentation Sidebar Component
 *
 * Navigation sidebar for API documentation.
 * Groups endpoints by category with visual method badges.
 */

import { ChevronRight } from 'lucide-react';
import type { ApiEndpoint } from '../../pages/DeveloperHub';

interface DocsSidebarProps {
  categories: Record<string, ApiEndpoint[]>;
  selectedEndpoint: ApiEndpoint;
  onSelectEndpoint: (endpoint: ApiEndpoint) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function DocsSidebar({
  categories,
  selectedEndpoint,
  onSelectEndpoint,
}: DocsSidebarProps) {
  // Smooth scroll to element by ID
  const scrollToSection = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="space-y-6">
      {/* Introduction */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Getting Started</h3>
        <ul className="space-y-1 text-sm">
          <li>
            <button
              onClick={() => scrollToSection('authentication')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-left"
            >
              <ChevronRight className="w-3 h-3" />
              Authentication
            </button>
          </li>
          <li>
            <button
              onClick={() => scrollToSection('rate-limits')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-left"
            >
              <ChevronRight className="w-3 h-3" />
              Rate Limits
            </button>
          </li>
          <li>
            <button
              onClick={() => scrollToSection('error-codes')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-left"
            >
              <ChevronRight className="w-3 h-3" />
              Error Codes
            </button>
          </li>
        </ul>
      </div>

      {/* Endpoint Categories */}
      {Object.entries(categories).map(([category, endpoints]) => (
        <div key={category} className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{category}</h3>
          <ul className="space-y-1">
            {endpoints.map((endpoint) => {
              const isSelected = selectedEndpoint.id === endpoint.id;
              return (
                <li key={endpoint.id}>
                  <button
                    onClick={() => onSelectEndpoint(endpoint)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                        METHOD_COLORS[endpoint.method]
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="text-sm truncate">{endpoint.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Help Box */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
        <h3 className="text-sm font-semibold text-indigo-900 mb-2">Need Help?</h3>
        <p className="text-xs text-indigo-700 mb-3">
          Having trouble with the API? Check our documentation or contact support.
        </p>
        <a
          href="https://github.com/anthropics/claude-code/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Get Support
          <ChevronRight className="w-3 h-3 ml-1" />
        </a>
      </div>
    </nav>
  );
}
