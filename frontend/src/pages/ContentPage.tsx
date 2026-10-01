import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Page, Post } from "@/lib/types";
import ErrorModal from "@/components/ErrorModal";
import FilterPanel, { POST_STATUSES, useFilters } from "@/components/FilterPanel";
import PlatformIcon from "@/components/PlatformIcon";
import Pagination from "@/components/Pagination";
import { Badge, Button, Card, LoadingSpinner, Modal } from "@/components/ui";

const PAGE_SIZE = 15;

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "danger" | "warning"> = {
  DRAFT: "default",
  SCHEDULED: "info",
  PUBLISHING: "warning",
  PUBLISHED: "success",
  PARTIALLY_PUBLISHED: "warning",
  FAILED: "danger",
  CANCELLED: "default",
};

export default function ContentPage() {
  const [page, setPage] = useState(1);
  const filters = useFilters(() => setPage(1), "status");
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["posts", filters.params, page],
    queryFn: async () => (await api.get<Page<Post>>("/posts", { params: { ...filters.params, page, page_size: PAGE_SIZE } })).data,
  });
  const posts = data?.items;

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => api.delete(`/posts/${postId}`),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err: any) => {
      setDeleteTarget(null);
      setModalError(err?.response?.data?.error?.message ?? "Failed to delete post");
    },
  });

  return (
    <div>
      {modalError && <ErrorModal message={modalError} onClose={() => setModalError(null)} />}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">All Posts</h1>
      </div>

      <FilterPanel filters={filters} statuses={POST_STATUSES} searchPlaceholder="Search posts by content..." reportEndpoint="/reports/posts" />

      <Card padding={false} className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Idea</th>
              <th className="px-4 py-3">Platforms</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-primary-500" colSpan={5}>
                  <LoadingSpinner />
                </td>
              </tr>
            )}
            {!isLoading && posts?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-400" colSpan={5}>
                  No posts yet. Create your first one.
                </td>
              </tr>
            )}
            {posts?.map((post) => (
              <tr key={post.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="max-w-md truncate px-4 py-3">
                  <Link to={`/compose/${post.id}`} className="font-medium text-gray-900 hover:text-primary-700">
                    {post.idea}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  <div className="flex items-center gap-1.5">
                    {post.platforms.map((p) => (
                      <PlatformIcon key={p.id} platform={p.platform} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[post.status] ?? "default"}>{post.status.replace(/_/g, " ")}</Badge>
                  {post.status === "PARTIALLY_PUBLISHED" && (
                    <div className="mt-1 text-xs text-red-600">
                      Failed: {post.platforms.filter((p) => p.status === "FAILED").map((p) => p.platform).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(post.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="!p-1.5" onClick={() => navigate(`/compose/${post.id}`)} aria-label="View" title="View">
                      <Eye size={16} />
                    </Button>
                    {post.status !== "PUBLISHED" && (
                      <Button variant="ghost" size="sm" className="!p-1.5" onClick={() => navigate(`/compose/${post.id}`)} aria-label="Edit" title="Edit">
                        <Pencil size={16} />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="!p-1.5 hover:!bg-red-50 hover:!text-red-600" onClick={() => setDeleteTarget(post)} aria-label="Delete" title="Delete">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />}
      </Card>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete post?" size="sm">
        <p className="text-sm text-gray-500">
          "{deleteTarget?.idea}" will be permanently removed. This can't be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
