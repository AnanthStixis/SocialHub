import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Page, Platform, PublishingJob } from "@/lib/types";
import FilterPanel, { JOB_STATUSES, useFilters } from "@/components/FilterPanel";
import PlatformIcon from "@/components/PlatformIcon";
import Pagination from "@/components/Pagination";
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui";

const PAGE_SIZE = 15;

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "danger" | "warning"> = {
  PENDING: "default",
  IN_PROGRESS: "info",
  SUCCESS: "success",
  FAILED: "danger",
  RETRYING: "warning",
};

export default function PublishingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const filters = useFilters(() => setPage(1));

  const { data, isLoading } = useQuery({
    queryKey: ["publishing-jobs", filters.params, page],
    queryFn: async () => (await api.get<Page<PublishingJob>>("/publishing/jobs", { params: { ...filters.params, page, page_size: PAGE_SIZE } })).data,
  });
  const jobs = data?.items;

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => api.post(`/publishing/jobs/${jobId}/retry`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["publishing-jobs"] }),
  });

  return (
    <div>
      <PageHeader title="Publishing" />

      <FilterPanel filters={filters} statuses={JOB_STATUSES} searchPlaceholder="Search by post content..." reportEndpoint="/reports/publishing" />

      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Post</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Last Result</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-primary-500" colSpan={7}>
                  <LoadingSpinner />
                </td>
              </tr>
            )}
            {!isLoading && jobs?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-400" colSpan={7}>
                  No publishing jobs yet.
                </td>
              </tr>
            )}
            {jobs?.map((job) => {
              const lastAttempt = job.attempts[job.attempts.length - 1];
              return (
                <tr key={job.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="max-w-xs truncate px-4 py-3">
                    <Link to={`/compose/${job.post_id}`} className="font-medium text-gray-900 hover:text-primary-700">
                      {job.post_idea ?? job.post_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <PlatformIcon platform={job.platform as Platform} />
                      {job.platform.charAt(0) + job.platform.slice(1).toLowerCase()}
                      {job.page_name && <span className="text-gray-400"> - {job.page_name}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[job.status] ?? "default"} className="whitespace-nowrap">{job.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {job.attempt_count} / {job.max_attempts}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-gray-500">
                    {lastAttempt
                      ? lastAttempt.success
                        ? `Published (${lastAttempt.external_post_id})`
                        : lastAttempt.error_message ?? "Failed"
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(job.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {(job.status === "FAILED" || job.status === "RETRYING") && (
                      <Button variant="outline" size="sm" onClick={() => retryMutation.mutate(job.id)} disabled={retryMutation.isPending}>
                        <RefreshCw size={12} /> Retry
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {data && <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
