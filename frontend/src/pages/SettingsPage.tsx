import {
  Card,
  Title,
  Text,
  Badge,
  Divider,
  Callout,
} from '@tremor/react';
import {
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
  return (
    <div>
      <Title>Settings</Title>
      <Text className="mt-1">Application settings and configuration</Text>

      {/* QuickBooks Connection - Multi-Tenant Notice */}
      <Card className="mt-6">
        <Title>QuickBooks Online Connection</Title>
        <Text className="mt-1">
          QuickBooks connections are managed per-organization
        </Text>

        <Divider className="my-4" />

        <Callout
          title="Per-Organization Connections"
          icon={InformationCircleIcon}
          color="blue"
        >
          <Text>
            QuickBooks connections are now configured at the organization level.
            To connect an organization to QuickBooks, go to the organization's settings page.
          </Text>
          <div className="mt-3">
            <a
              href="/admin/organizations"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              View Organizations
            </a>
          </div>
        </Callout>
      </Card>

      {/* Environment Info */}
      <Card className="mt-6">
        <Title>Environment</Title>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <Text>QBO Environment</Text>
            <Badge color={import.meta.env.MODE === 'production' ? 'green' : 'yellow'}>
              Sandbox
            </Badge>
          </div>
          <div className="flex justify-between">
            <Text>API Endpoint</Text>
            <Text className="font-mono text-sm">{window.location.origin}/api</Text>
          </div>
        </div>
      </Card>

      {/* Help */}
      <Card className="mt-6">
        <Title>Need Help?</Title>
        <Text className="mt-2">
          To use this integration, you'll need:
        </Text>
        <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
          <li>A QuickBooks Online account (sandbox or production)</li>
          <li>QuickBooks API credentials (Client ID and Secret)</li>
          <li>Webhook sources configured to send data</li>
          <li>Field mappings to transform data to QBO invoice format</li>
        </ul>

        <div className="mt-4">
          <a
            href="https://developer.intuit.com/app/developer/qbo/docs/develop"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm"
          >
            QuickBooks Online API Documentation
          </a>
        </div>
      </Card>
    </div>
  );
}
