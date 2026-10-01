import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Upload, X, ChevronDown, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { ALL_PLATFORMS, Platform, Post, SocialAccount } from "@/lib/types";
import PlatformPreview from "@/components/PlatformPreview";
import ErrorModal from "@/components/ErrorModal";
import PublishProgressModal, { PublishProgressItem } from "@/components/PublishProgressModal";
import PlatformIcon from "@/components/PlatformIcon";
import { Badge, Button, Card, Input, LoadingSpinner, Select, Tabs, Textarea, Toggle } from "@/components/ui";

const CHAR_LIMITS: Record<Platform, number> = {
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  LINKEDIN: 3000,
};

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "danger" | "warning"> = {
  DRAFT: "default",
  SCHEDULED: "info",
  PUBLISHING: "warning",
  PUBLISHED: "success",
  PARTIALLY_PUBLISHED: "warning",
  FAILED: "danger",
  CANCELLED: "default",
};

const ACCOUNT_SCOPED_PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM"];

function PageSelector({
  accounts,
  selectedIds,
  onChange,
}: {
  accounts: SocialAccount[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = accounts.length > 0 && selectedIds.length === accounts.length;

  const label =
    accounts.length === 0
      ? "No pages connected"
      : allSelected
        ? "All pages"
        : selectedIds.length === 0
          ? "Select a page..."
          : accounts.find((a) => a.id === selectedIds[0])?.account_name +
            (selectedIds.length > 1 ? ` +${selectedIds.length - 1}` : "");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={accounts.length === 0}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm outline-none focus:border-primary-500 disabled:opacity-50"
      >
        <span className={selectedIds.length === 0 ? "text-gray-400" : ""}>{label}</span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>
      {open && accounts.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(allSelected ? [] : accounts.map((a) => a.id))}
            />
            All pages
          </label>
          <div className="my-1 border-t border-gray-100" />
          {accounts.map((a) => (
            <label key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedIds.includes(a.id)}
                onChange={() =>
                  onChange(selectedIds.includes(a.id) ? selectedIds.filter((id) => id !== a.id) : [...selectedIds, a.id])
                }
              />
              {a.account_name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftHashtags, setDraftHashtags] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] = useState<PublishProgressItem[] | null>(null);
  const [mediaTypeChoice, setMediaTypeChoice] = useState<"text" | "image" | "video">("image");
  const [showMediaUrlInput, setShowMediaUrlInput] = useState(false);
  const [mediaUrlDraft, setMediaUrlDraft] = useState("");
  const [selectionMode, setSelectionMode] = useState<"ALL" | "INDIVIDUAL">("ALL");
  const appliedAllOnLoad = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () => (await api.get<Post>(`/posts/${postId}`)).data,
    enabled: !!postId,
  });

  const { data: socialAccounts } = useQuery({
    queryKey: ["social-accounts"],
    queryFn: async () => (await api.get<SocialAccount[]>("/social-accounts")).data,
  });

  const platformTabs = ALL_PLATFORMS.filter((p) => post?.platforms.some((pp) => pp.platform === p));
  const isPartiallyPublished = post?.status === "PARTIALLY_PUBLISHED";
  const failedPlatforms = post?.platforms.filter((p) => p.status === "FAILED").map((p) => p.platform) ?? [];
  const publishedPlatforms = post?.platforms.filter((p) => p.status === "PUBLISHED").map((p) => p.platform) ?? [];
  const editablePlatformTabs = isPartiallyPublished && failedPlatforms.length > 0 ? failedPlatforms : platformTabs;

  useEffect(() => {
    if (post && !activePlatform && editablePlatformTabs.length > 0) {
      setActivePlatform(editablePlatformTabs[0]);
    }
  }, [post, activePlatform, editablePlatformTabs]);

  const rowsForActive = post?.platforms.filter((p) => p.platform === activePlatform) ?? [];
  const current = rowsForActive[0];

  useEffect(() => {
    setDraftContent(current?.content ?? "");
    setDraftHashtags((current?.hashtags ?? []).join(" "));
  }, [current?.id, current?.content]);

  useEffect(() => {
    if (post && post.media.length > 0) {
      setMediaTypeChoice(post.media[0].media_type);
    }
  }, [post?.media.length]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["post", postId] });
  const onActionError = (err: any, fallback: string) => setModalError(err?.response?.data?.error?.message ?? fallback);

  const setAccountsMutation = useMutation({
    mutationFn: async ({ platform, ids }: { platform: Platform; ids: string[] | null }) =>
      api.put(`/posts/${postId}/platforms/${platform}/accounts`, { social_account_ids: ids }),
    onSuccess: invalidate,
    onError: (err: any) => onActionError(err, "Failed to update selected pages"),
  });

  // Default mode is "All Social Media Accounts": make sure every
  // account-scoped platform actually targets every connected account for
  // it, once, when the post first loads.
  useEffect(() => {
    if (appliedAllOnLoad.current || !post || !socialAccounts) return;
    appliedAllOnLoad.current = true;
    if (selectionMode === "ALL") {
      for (const p of platformTabs) {
        if (ACCOUNT_SCOPED_PLATFORMS.includes(p)) {
          setAccountsMutation.mutate({ platform: p, ids: null });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, socialAccounts]);

  function handleSelectionModeChange(mode: "ALL" | "INDIVIDUAL") {
    setSelectionMode(mode);
    if (mode === "ALL") {
      for (const p of platformTabs) {
        if (ACCOUNT_SCOPED_PLATFORMS.includes(p)) {
          setAccountsMutation.mutate({ platform: p, ids: null });
        }
      }
    }
  }

  const titleMutation = useMutation({
    mutationFn: async (idea: string) => api.put(`/posts/${postId}`, { idea }),
    onSuccess: invalidate,
    onError: (err: any) => onActionError(err, "Failed to rename post"),
  });

  // "All" mode generates for every platform on the post in one call — each
  // platform still gets its own genuinely different, platform-styled
  // content (short/casual for Instagram, professional for LinkedIn, etc.).
  // "Individual" mode scopes generation to just the active tab.
  const generateMutation = useMutation({
    mutationFn: async (topic: string) =>
      api.post(`/posts/${postId}/generate`, {
        platforms: selectionMode === "ALL" ? null : [activePlatform],
        topic,
      }),
    onSuccess: invalidate,
    onError: (err: any) => onActionError(err, "Failed to generate content"),
  });

  function handleGenerate() {
    if (!topicDraft.trim()) return;
    generateMutation.mutate(topicDraft.trim());
  }

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.put(`/posts/${postId}/platforms/${activePlatform}`, {
        content: draftContent,
        hashtags: draftHashtags.split(/\s+/).filter(Boolean),
      }),
    onSuccess: invalidate,
    onError: (err: any) => onActionError(err, "Failed to save content"),
  });

  function handleContentBlur() {
    if (draftContent !== (current?.content ?? "")) saveMutation.mutate();
  }

  function handleHashtagsBlur() {
    if (draftHashtags !== (current?.hashtags ?? []).join(" ")) saveMutation.mutate();
  }

  const removePlatformMutation = useMutation({
    mutationFn: async (platform: Platform) => api.delete(`/posts/${postId}/platforms/${platform}`),
    onSuccess: (_data, platform) => {
      if (activePlatform === platform) setActivePlatform(null);
      invalidate();
    },
    onError: (err: any) => onActionError(err, "Failed to remove platform"),
  });

  const addPlatformMutation = useMutation({
    mutationFn: async (platform: Platform) => api.post(`/posts/${postId}/platforms/${platform}`),
    onSuccess: (_data, platform) => {
      setActivePlatform(platform);
      invalidate();
    },
    onError: (err: any) => onActionError(err, "Failed to add platform"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post(`/posts/${postId}/media`, form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: invalidate,
    onError: (err: any) => onActionError(err, "Failed to upload media"),
  });

  const attachUrlMutation = useMutation({
    mutationFn: async ({ url, mediaType }: { url: string; mediaType: "image" | "video" }) =>
      api.post(`/posts/${postId}/media/url`, { url, media_type: mediaType }),
    onSuccess: () => {
      setMediaUrlDraft("");
      setShowMediaUrlInput(false);
      invalidate();
    },
    onError: (err: any) => onActionError(err, "Failed to attach media URL"),
  });

  const removeMediaMutation = useMutation({
    mutationFn: async (mediaId: string) => api.delete(`/posts/${postId}/media/${mediaId}`),
    onSuccess: invalidate,
  });

  const [isPublishing, setIsPublishing] = useState(false);

  async function handlePublish() {
    const targets = isPartiallyPublished && failedPlatforms.length > 0 ? failedPlatforms : platformTabs;
    setPublishProgress(targets.map((platform) => ({ platform, state: "pending" })));
    setIsPublishing(true);
    for (const platform of targets) {
      try {
        const res = await api.post<Post>(`/posts/${postId}/publish`, { platforms: [platform] });
        const row = res.data.platforms.find((p) => p.platform === platform);
        const succeeded = row?.status === "PUBLISHED";
        setPublishProgress((prev) =>
          (prev ?? []).map((item) =>
            item.platform === platform
              ? { platform, state: succeeded ? "done" : "failed", error: succeeded ? undefined : row?.error_message ?? "Publishing failed" }
              : item
          )
        );
      } catch (err: any) {
        setPublishProgress((prev) =>
          (prev ?? []).map((item) =>
            item.platform === platform
              ? { platform, state: "failed", error: err?.response?.data?.error?.message ?? "Publishing failed" }
              : item
          )
        );
      }
    }
    setIsPublishing(false);
    invalidate();
  }

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localIso = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      return api.post(`/posts/${postId}/schedule`, { scheduled_at: localIso, timezone: tz });
    },
    onSuccess: invalidate,
    onError: (err: any) => onActionError(err, "Failed to schedule"),
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: async () => api.post(`/posts/${postId}/cancel`),
    onSuccess: invalidate,
  });

  if (isLoading || !post) return <LoadingSpinner className="text-primary-500" />;

  const accountsForActive = socialAccounts?.filter((a) => a.platform === activePlatform) ?? [];
  const selectedAccountIds = rowsForActive.map((r) => r.social_account_id).filter((id): id is string => !!id);
  const showPageSelector = selectionMode === "INDIVIDUAL" && activePlatform && ACCOUNT_SCOPED_PLATFORMS.includes(activePlatform);
  const firstMedia = post.media[0];
  const previewPlatform = activePlatform ?? editablePlatformTabs[0];

  return (
    <div>
      {modalError && <ErrorModal message={modalError} onClose={() => setModalError(null)} />}
      {publishProgress && (
        <PublishProgressModal
          items={publishProgress}
          publishing={isPublishing}
          onClose={() => setPublishProgress(null)}
        />
      )}

      <div className="mb-4 flex items-start justify-between gap-4">
        <input
          defaultValue={post.idea}
          onBlur={(e) => e.target.value !== post.idea && titleMutation.mutate(e.target.value)}
          className="w-full max-w-xl rounded-lg border border-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:border-gray-200 focus:border-primary-500"
        />
        <Badge variant={STATUS_VARIANT[post.status] ?? "default"} size="md" className="shrink-0">
          {post.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {isPartiallyPublished && failedPlatforms.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {publishedPlatforms.length > 0 && (
            <span>
              Already published to {publishedPlatforms.map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(", ")}.{" "}
            </span>
          )}
          Editing failed platform(s): {failedPlatforms.map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(", ")}.
        </div>
      )}

      <Card className="mb-4 flex items-center gap-4 px-4 py-2.5">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <input
            type="radio"
            name="selection-mode"
            className="accent-primary-600"
            checked={selectionMode === "ALL"}
            onChange={() => handleSelectionModeChange("ALL")}
          />
          All Social Media Accounts
        </label>
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <input
            type="radio"
            name="selection-mode"
            className="accent-primary-600"
            checked={selectionMode === "INDIVIDUAL"}
            onChange={() => handleSelectionModeChange("INDIVIDUAL")}
          />
          Individual
        </label>
      </Card>

      {selectionMode === "INDIVIDUAL" && (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1 overflow-x-auto">
            <Tabs
              activeTab={activePlatform ?? ""}
              onChange={(id) => setActivePlatform(id as Platform)}
              tabs={editablePlatformTabs.map((p) => ({
                id: p,
                label: (
                  <span className="group flex items-center gap-1.5">
                    <PlatformIcon platform={p} size={14} />
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                    {editablePlatformTabs.length > 1 && !isPartiallyPublished && (
                      <span
                        role="button"
                        aria-label={`Remove ${p}`}
                        title={`Remove ${p}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlatformMutation.mutate(p);
                        }}
                        className="hidden text-gray-400 hover:text-red-600 group-hover:block"
                      >
                        <X size={14} />
                      </span>
                    )}
                  </span>
                ),
              }))}
            />
          </div>
          {!isPartiallyPublished && ALL_PLATFORMS.filter((p) => !platformTabs.includes(p)).map((p) => (
            <Button key={p} variant="outline" size="sm" className="border-dashed" onClick={() => addPlatformMutation.mutate(p)}>
              <Plus size={14} /> {p.charAt(0) + p.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      )}

      {activePlatform && rowsForActive.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            {showPageSelector && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {activePlatform === "FACEBOOK" ? "Facebook Page" : "Instagram Account"}
                </label>
                <PageSelector
                  accounts={accountsForActive}
                  selectedIds={selectedAccountIds}
                  onChange={(ids) => activePlatform && setAccountsMutation.mutate({ platform: activePlatform, ids })}
                />
              </div>
            )}

            <div>
              <Select
                label="Media Type"
                value={mediaTypeChoice}
                onChange={(e) => setMediaTypeChoice(e.target.value as "text" | "image" | "video")}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="text">Text (no media)</option>
              </Select>

              {mediaTypeChoice !== "text" && !showMediaUrlInput && (
                <div className="mt-2 space-y-1.5">
                  <Button
                    variant="outline"
                    className="w-full border-dashed py-3 text-gray-500"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploadMutation.isPending}
                  >
                    <Upload size={16} />
                    {uploadMutation.isPending ? "Uploading..." : `Upload ${mediaTypeChoice}`}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowMediaUrlInput(true)}
                    className="text-xs font-medium text-primary-600 hover:underline"
                  >
                    Use a URL instead
                  </button>
                </div>
              )}
              {mediaTypeChoice !== "text" && showMediaUrlInput && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    className="flex-1"
                    value={mediaUrlDraft}
                    onChange={(e) => setMediaUrlDraft(e.target.value)}
                    placeholder={`https://.../${mediaTypeChoice === "video" ? "video.mp4" : "image.jpg"}`}
                  />
                  <Button
                    onClick={() => mediaUrlDraft && attachUrlMutation.mutate({ url: mediaUrlDraft, mediaType: mediaTypeChoice as "image" | "video" })}
                    disabled={!mediaUrlDraft}
                    loading={attachUrlMutation.isPending}
                  >
                    {attachUrlMutation.isPending ? "Adding..." : "Add"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowMediaUrlInput(false)}>
                    Cancel
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={mediaTypeChoice === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                  e.target.value = "";
                }}
              />
              {post.media.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {post.media.map((m) => (
                    <div key={m.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
                      {m.media_type === "image" ? (
                        <img src={m.file_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <video src={m.file_url} className="h-full w-full object-cover" />
                      )}
                      <button
                        onClick={() => removeMediaMutation.mutate(m.id)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Textarea
                label="Post Content"
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                onBlur={handleContentBlur}
                rows={8}
                placeholder="What do you want to share?"
                helperText={`${draftContent.length} / ${(activePlatform ? CHAR_LIMITS[activePlatform] : 0).toLocaleString()}`}
              />

              <label className="mb-1.5 mt-3 block text-sm font-medium text-gray-700">
                Generate content (keyword, topic, or sentence)
              </label>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.target.value)}
                  placeholder="e.g. Benefits of AI in customer support"
                />
                <Button
                  variant="ai"
                  className="shrink-0"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleGenerate}
                  disabled={!topicDraft.trim()}
                  loading={generateMutation.isPending}
                >
                  <Sparkles size={14} /> {generateMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </div>

            <Input
              label="Hashtags"
              value={draftHashtags}
              onChange={(e) => setDraftHashtags(e.target.value)}
              onBlur={handleHashtagsBlur}
              placeholder="#AI #Automation"
            />
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Schedule for later</span>
                <Toggle checked={scheduleEnabled} onChange={setScheduleEnabled} />
              </div>

              {scheduleEnabled ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              ) : (
                post.status === "SCHEDULED" &&
                post.scheduled_at && (
                  <p className="text-sm text-gray-500">
                    Scheduled for {new Date(post.scheduled_at).toLocaleString()} ({post.scheduled_timezone})
                  </p>
                )
              )}
              {post.status === "SCHEDULED" && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => cancelScheduleMutation.mutate()}>
                  Cancel schedule
                </Button>
              )}
              {(post.status === "PUBLISHED" || post.status === "PARTIALLY_PUBLISHED" || post.status === "FAILED") && (
                <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
                  {post.platforms.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="font-medium">{p.platform}</span>
                      <span
                        className={p.status === "PUBLISHED" ? "text-emerald-600" : p.status === "FAILED" ? "text-red-600" : "text-gray-400"}
                      >
                        {p.status === "PUBLISHED"
                          ? `Published${p.published_at ? " · " + new Date(p.published_at).toLocaleTimeString() : ""}`
                          : p.status === "FAILED"
                            ? p.error_message ?? "Failed"
                            : p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="bg-gray-50">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Live Preview</h2>
                <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
                  {editablePlatformTabs.map((p) => (
                    <Button
                      key={p}
                      variant={previewPlatform === p ? "secondary" : "ghost"}
                      size="sm"
                      className={previewPlatform === p ? "!bg-primary-50 !text-primary-700" : ""}
                      onClick={() => setActivePlatform(p)}
                    >
                      <PlatformIcon platform={p} size={13} />
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-center">
                <PlatformPreview
                  platform={previewPlatform}
                  content={draftContent || "Your content will appear here..."}
                  hashtags={draftHashtags.split(/\s+/).filter(Boolean)}
                  mediaUrl={firstMedia?.file_url}
                />
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/content")}>
          Cancel
        </Button>
        <Button variant="outline" onClick={() => navigate("/content")}>
          Save draft
        </Button>
        {post.status !== "PUBLISHED" &&
          (scheduleEnabled ? (
            <Button onClick={() => scheduleMutation.mutate()} disabled={!scheduleDate || !scheduleTime} loading={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule post"}
            </Button>
          ) : (
            <Button onClick={handlePublish} loading={isPublishing}>
              {isPublishing ? "Publishing..." : "Publish now"}
            </Button>
          ))}
      </div>
    </div>
  );
}
