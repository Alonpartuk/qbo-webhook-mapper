import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Title,
  Text,
  Metric,
  Grid,
  Flex,
  Badge,
  List,
  ListItem,
} from '@tremor/react';
import {
  ServerStackIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import * as sourcesApi from '../api/sources';
import * as invoicesApi from '../api/invoices';
import { WebhookSource, SyncLog } from '../types';

export default function Dashboard() {
  const [sources, setSources] = useState<WebhookSource[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sourcesData, logsData] = await Promise.all([
        sourcesApi.getSources(),
        invoicesApi.getSyncLogs(10),
      ]);
      setSources(sourcesData);
      setLogs(logsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const successCount = logs.filter((l) => l.status === 'success').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <Title>Dashboard</Title>
      <Text className="mt-1">Overview of your webhook-to-QBO integration</Text>

      {/* Stats Grid */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mt-6">
        <Card decoration="top" decorationColor="blue">
          <Flex justifyContent="start" className="space-x-4">
            <ServerStackIcon className="w-8 h-8 text-blue-500" />
            <div>
              <Text>Webhook Sources</Text>
              <Metric>{sources.length}</Metric>
            </div>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="green">
          <Flex justifyContent="start" className="space-x-4">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
            <div>
              <Text>Successful Syncs</Text>
              <Metric>{successCount}</Metric>
            </div>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="red">
          <Flex justifyContent="start" className="space-x-4">
            <XCircleIcon className="w-8 h-8 text-red-500" />
            <div>
              <Text>Failed Syncs</Text>
              <Metric>{failedCount}</Metric>
            </div>
          </Flex>
        </Card>

        <Link to="/admin/organizations">
          <Card decoration="top" decorationColor="indigo" className="hover:bg-gray-50 cursor-pointer transition-colors">
            <Flex justifyContent="start" className="space-x-4">
              <BuildingOfficeIcon className="w-8 h-8 text-indigo-500" />
              <div>
                <Text>Organizations</Text>
                <div className="mt-1">
                  <Badge color="indigo">Manage</Badge>
                </div>
              </div>
            </Flex>
          </Card>
        </Link>
      </Grid>

      {/* Quick Actions & Recent Activity */}
      <Grid numItemsSm={1} numItemsLg={2} className="gap-6 mt-6">
        {/* Webhook Sources */}
        <Card>
          <Flex justifyContent="between" alignItems="center">
            <Title>Webhook Sources</Title>
            <Link
              to="/sources"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All
            </Link>
          </Flex>

          {sources.length > 0 ? (
            <List className="mt-4">
              {sources.slice(0, 5).map((source) => (
                <ListItem key={source.source_id}>
                  <Flex justifyContent="between" className="w-full">
                    <div>
                      <Text className="font-medium">{source.name}</Text>
                      <Text className="text-xs text-gray-500">
                        ID: {source.source_id.slice(0, 8)}...
                      </Text>
                    </div>
                    <Badge color={source.is_active ? 'green' : 'gray'}>
                      {source.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Flex>
                </ListItem>
              ))}
            </List>
          ) : (
            <div className="mt-4 text-center py-8 text-gray-500">
              No sources yet.{' '}
              <Link to="/sources" className="text-blue-600 hover:underline">
                Create one
              </Link>
            </div>
          )}
        </Card>

        {/* Recent Sync Logs */}
        <Card>
          <Flex justifyContent="between" alignItems="center">
            <Title>Recent Syncs</Title>
            <Link
              to="/logs"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All
            </Link>
          </Flex>

          {logs.length > 0 ? (
            <List className="mt-4">
              {logs.slice(0, 5).map((log) => (
                <ListItem key={log.log_id}>
                  <Flex justifyContent="between" className="w-full">
                    <div>
                      <Text className="font-medium">
                        {log.qbo_doc_number || log.payload_id.slice(0, 8)}...
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </Text>
                    </div>
                    <Badge
                      color={
                        log.status === 'success'
                          ? 'green'
                          : log.status === 'failed'
                          ? 'red'
                          : 'yellow'
                      }
                    >
                      {log.status}
                    </Badge>
                  </Flex>
                </ListItem>
              ))}
            </List>
          ) : (
            <div className="mt-4 text-center py-8 text-gray-500">
              No sync activity yet.
            </div>
          )}
        </Card>
      </Grid>

    </div>
  );
}
