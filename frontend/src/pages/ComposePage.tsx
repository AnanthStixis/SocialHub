import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "@/lib/toast";
import { Calendar, Copy, Lock, Save, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { MediaAsset, Platform, Post } from "@/lib/types";
import { PLATFORM_META, apiErrorMessage } from "@/lib/platforms";
import { htmlToPlain, textToHtml } from "@/lib/richText";
import { Button, Card, LoadingSpinner, Tabs } from "@/components/ui";
import PlatformPreview from "@/components/PlatformPreview";
import PlatformIcon from "@/components/PlatformIcon";
import PlatformSelector from "@/components/compose/PlatformSelector";
import PostEditor from "@/components/compose/PostEditor";
import MediaUploader, { type LinkedMedia } from "@/components/compose/MediaUploader";
import SchedulePicker, { ScheduleMode } from "@/components/compose/SchedulePicker";
import AIAssistant from "@/components/compose/AIAssistant";

const RIGHT_TABS = [
  { id: "preview", label: "Preview" },
  { id: "ai", label: "AI Assistant" },
];

type Contents = Partial<Record<Platform, string>>;

const deriveIdea = (html: string) => {
  const line = htmlToPlain(html, { styled: false }).trim().split("\n")[0] ?? "";
  return (line.length > 80 ? line.slice(0, 77) + "..." : line) || "New post";
};

// Compose doubles as the editor: /compose creates a post, /compose/:postId edits one.
export default function ComposePage() {
  const { postId } = useParams<{ postId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Each platform keeps its own text (HTML); `editing` is the platform whose text is in the editor.
  const [contents, setContents] = useState<Contents>({});
  const [editingPick, setEditingPick] = useState<Platform | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [linkedMedia, setLinkedMedia] = useState<LinkedMedia[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaAsset[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ScheduleMode>("now");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [usedAI, setUsedAI] = useState(false);
  const [rightTab, setRightTab] = useState("preview");
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);

  const { data: post, isLoading: loadingPost, error: loadError } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () => (await api.get<Post>(`/posts/${postId}`)).data,
    enabled: !!postId,
  });

  // Fill the form once per loaded post (not on every background refetch).
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!post || hydratedFor.current === post.id) return;
    hydratedFor.current = post.id;
    const rows = post.platforms;
    setPlatforms([...new Set(rows.map((r) => r.platform))]);
    const loaded: Contents = {};
    for (const r of rows) if (!(r.platform in loaded)) loaded[r.platform] = r.content ?? "";
    setContents(loaded);
    setEditingPick(null);
    setExistingMedia(post.media);
    setRemovedMediaIds([]);
    if (post.status === "SCHEDULED" && post.scheduled_at) {
      setMode("schedule");
      setScheduledAt(new Date(post.scheduled_at));
    }
    setUsedAI(post.creation_mode === "AI");
  }, [post, navigate]);

  // Published posts can be viewed but not changed.
  const readOnly = post?.status === "PUBLISHED";
  const lock = readOnly ? ({ inert: "" } as Record<string, string>) : {};

  const failedPlatforms = post?.platforms.filter((p) => p.status === "FAILED").map((p) => p.platform) ?? [];
  // Once some platforms are live, only the failed ones can still be changed.
  const partiallyPublished = post?.status === "PARTIALLY_PUBLISHED" && failedPlatforms.length > 0;

  const firstNewImage = useMemo(() => files.find((f) => f.type.startsWith("image/")), [files]);
  const [newImageUrl, setNewImageUrl] = useState<string>();
  useEffect(() => {
    if (!firstNewImage) return setNewImageUrl(undefined);
    const url = URL.createObjectURL(firstNewImage);
    setNewImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [firstNewImage]);
  const existingImage = existingMedia.find((m) => m.media_type === "image")?.file_url;
  const linkedImage = linkedMedia.find((m) => m.media_type === "image")?.url;
  const previewImage = newImageUrl ?? linkedImage ?? existingImage;

  const editing = editingPick && platforms.includes(editingPick) ? editingPick : platforms[0];
  const content = (editing && contents[editing]) || "";
  const plainOf = (p: Platform) => htmlToPlain(contents[p] ?? "");
  const setContent = (html: string) => {
    if (editing) setContents((prev) => ({ ...prev, [editing]: html }));
  };

  // A newly selected platform starts from the text currently in the editor; edit it independently afterwards.
  function handlePlatformsChange(next: Platform[]) {
    const added = next.filter((p) => !platforms.includes(p));
    if (added.length && content) {
      setContents((prev) => {
        const copy = { ...prev };
        for (const p of added) if (!htmlToPlain(copy[p] ?? "").trim()) copy[p] = content;
        return copy;
      });
    }
    setPlatforms(next);
  }

  function copyToAll() {
    setContents((prev) => ({ ...prev, ...Object.fromEntries(platforms.map((p) => [p, content])) }));
    toast.success("Your text has been applied to all selected platforms.");
  }

  function invalidateAll(id?: string) {
    for (const key of ["posts", "calendar", "dashboard", "dashboard-upcoming"]) queryClient.invalidateQueries({ queryKey: [key] });
    if (id) queryClient.invalidateQueries({ queryKey: ["post", id] });
  }

  async function uploadFiles(id: string) {
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/posts/${id}/media`, form, { headers: { "Content-Type": "multipart/form-data" } });
    }
    for (const link of linkedMedia) await api.post(`/posts/${id}/media/url`, link);
  }

  // Targets every connected Page/account of each platform (null = "all connected").
  async function bindAllAccounts(id: string, list: Platform[]) {
    for (const p of list) await api.put(`/posts/${id}/platforms/${p}/accounts`, { social_account_ids: null });
  }

  // Create or update the post so the server matches the form. Returns the post id.
  async function persist(): Promise<string> {
    if (!postId || !post) {
      const { data: created } = await api.post<Post>("/posts", {
        idea: deriveIdea(contents[platforms[0]] ?? ""),
        creation_mode: usedAI ? "AI" : "MANUAL",
        platforms,
        manual_content: Object.fromEntries(platforms.map((p) => [p, contents[p] ?? ""])),
      });
      await bindAllAccounts(created.id, platforms);
      await uploadFiles(created.id);
      return created.id;
    }

    const existing = [...new Set(post.platforms.map((r) => r.platform))];
    if (!partiallyPublished) {
      for (const p of platforms.filter((p) => !existing.includes(p))) await api.post(`/posts/${postId}/platforms/${p}`);
      for (const p of existing.filter((p) => !platforms.includes(p))) await api.delete(`/posts/${postId}/platforms/${p}`);
    }
    const editable = partiallyPublished ? failedPlatforms : platforms;
    for (const p of editable) {
      const hashtags = post.platforms.find((r) => r.platform === p)?.hashtags ?? [];
      await api.put(`/posts/${postId}/platforms/${p}`, { content: contents[p] ?? "", hashtags });
    }
    // Rows not yet tied to a specific Page/account (new or legacy) publish to every connected account.
    const unbound = platforms.filter((p) => !existing.includes(p) || post.platforms.some((r) => r.platform === p && !r.social_account_id));
    await bindAllAccounts(postId, unbound);
    await api.put(`/posts/${postId}`, { idea: deriveIdea(contents[platforms[0]] ?? "") });
    for (const id of removedMediaIds) await api.delete(`/posts/${postId}/media/${id}`);
    await uploadFiles(postId);
    return postId;
  }

  async function handleSave() {
    if (platforms.length === 0) return toast.error("Please select at least one platform before saving.");
    setBusy("save");
    try {
      const id = await persist();
      invalidateAll(id);
      toast.success(postId ? "Your changes have been saved." : "Draft saved successfully.");
      if (postId) {
        // Reset transient edit state; the refetch below re-syncs media from the server.
        setFiles([]);
        setLinkedMedia([]);
        setRemovedMediaIds([]);
        hydratedFor.current = null;
      } else {
        navigate(`/compose/${id}`, { replace: true });
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "We couldn't save your post. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  async function handlePublishOrSchedule() {
    if (platforms.length === 0) return toast.error("Please select at least one platform to continue.");
    const empty = platforms.find((p) => !plainOf(p).trim());
    if (empty) {
      setEditingPick(empty);
      return toast.error(`Please add content for ${PLATFORM_META[empty].name} before continuing.`);
    }
    if (mode === "schedule" && !scheduledAt) return toast.error("Please choose a date and time to schedule this post.");
    if (mode === "schedule" && scheduledAt && scheduledAt.getTime() <= Date.now()) return toast.error("The scheduled time must be in the future.");
    const over = platforms.find((p) => plainOf(p).length > PLATFORM_META[p].maxChars);
    if (over) return toast.error(`Your ${PLATFORM_META[over].name} post exceeds the platform's character limit.`);

    setBusy("publish");
    let id: string | null = null;
    try {
      id = await persist();
      if (mode === "schedule" && scheduledAt) {
        await api.post(`/posts/${id}/schedule`, {
          scheduled_at: scheduledAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        invalidateAll(id);
        toast.success("Your post has been scheduled successfully.");
        navigate("/calendar");
      } else {
        const { data } = await api.post<Post>(`/posts/${id}/publish`, { platforms: partiallyPublished ? failedPlatforms : null });
        invalidateAll(id);
        if (data.status === "PUBLISHED") {
          toast.success("Your post is now live.");
          navigate("/calendar");
        } else {
          toast.error("Publishing was not fully successful. Review the Publishing page for details.");
          navigate(`/compose/${id}`, { replace: true });
          hydratedFor.current = null;
        }
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, mode === "schedule" ? "We couldn't schedule your post. Please try again." : "We couldn't publish your post. Please try again."));
      // The post now exists server-side; move to its edit URL so a retry updates it instead of duplicating it.
      if (id && !postId) navigate(`/compose/${id}`, { replace: true });
    } finally {
      setBusy(null);
    }
  }

  // Apply AI text only to the platform it was written for (or the one being edited).
  function handleUseAI(text: string, platform?: Platform) {
    const target = platform ?? editing;
    if (!target) return toast.error("Please select a platform first.");
    setContents((prev) => ({ ...prev, [target]: textToHtml(text) }));
    if (!platforms.includes(target)) setPlatforms((prev) => [...prev, target]);
    setEditingPick(target);
    setUsedAI(true);
    toast.success(`AI content applied to ${PLATFORM_META[target].name}.`);
  }

  if (postId && loadingPost) return <LoadingSpinner size="lg" className="text-primary-500" />;
  if (postId && loadError) return <p className="text-sm text-red-600">Could not load this post.</p>;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{readOnly ? "View Post" : postId ? "Edit Post" : "Create Post"}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {readOnly ? "This post has been published, so it is read-only." : postId ? "Update your post, then save, reschedule or publish it" : "Create and schedule posts across your connected platforms"}
        </p>
      </div>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="w-full min-w-0 space-y-5 lg:flex-[65]">
          {readOnly && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <Lock size={16} /> Published — editing and publishing are disabled.
            </div>
          )}
          <div className={readOnly ? "space-y-5 opacity-70" : "space-y-5"} {...lock}>
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-gray-900">Select Platforms</h2>
            </Card.Header>
            <div className={partiallyPublished ? "pointer-events-none opacity-60" : undefined}>
              <PlatformSelector selected={platforms} onChange={handlePlatformsChange} />
            </div>
            {partiallyPublished && (
              <p className="mt-2 text-xs text-gray-500">
                Already published to some platforms. Only the failed ones ({failedPlatforms.map((p) => PLATFORM_META[p].name).join(", ")}) can be changed.
              </p>
            )}
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-gray-900">Post Content</h2>
            </Card.Header>
            {platforms.length > 0 ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
                    {platforms.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditingPick(p)}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          editing === p ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <PlatformIcon platform={p} size={12} />
                        {PLATFORM_META[p].name}
                        {!plainOf(p).trim() && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="No content yet" />}
                      </button>
                    ))}
                  </div>
                  {platforms.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={copyToAll} title="Copy this text to every selected platform">
                      <Copy size={14} /> Apply to all
                    </Button>
                  )}
                </div>
                <PostEditor content={content} onChange={setContent} />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">Select a platform to start writing</p>
            )}
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-gray-900">Media</h2>
            </Card.Header>
            {existingMedia.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {existingMedia.map((m) => (
                  <div key={m.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
                    {m.media_type === "image" ? (
                      <img src={m.file_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video src={m.file_url} className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      aria-label="Remove media"
                      onClick={() => {
                        setExistingMedia((prev) => prev.filter((x) => x.id !== m.id));
                        setRemovedMediaIds((prev) => [...prev, m.id]);
                      }}
                      className="absolute right-0.5 top-0.5 cursor-pointer rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <MediaUploader files={files} onChange={setFiles} links={linkedMedia} onLinksChange={setLinkedMedia} onReject={(m) => toast.error(m)} />
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-gray-900">Timing</h2>
            </Card.Header>
            <SchedulePicker mode={mode} onModeChange={setMode} scheduledAt={scheduledAt} onChange={setScheduledAt} />
          </Card>

          </div>

          <div className="flex items-center gap-3 pb-6">
            <Button variant="outline" onClick={handleSave} loading={busy === "save"} disabled={busy !== null || readOnly}>
              <Save size={16} /> {postId ? "Save Changes" : "Save Draft"}
            </Button>
            <Button onClick={handlePublishOrSchedule} loading={busy === "publish"} disabled={busy !== null || readOnly} className="flex-1 sm:flex-none">
              {mode === "schedule" ? (
                <>
                  <Calendar size={16} /> {post?.status === "SCHEDULED" ? "Reschedule Post" : "Schedule Post"}
                </>
              ) : (
                <>
                  <Send size={16} /> {readOnly ? "Published" : "Publish Now"}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="w-full min-w-0 lg:sticky lg:top-0 lg:flex-[35]">
          <Card>
            <Tabs tabs={readOnly ? RIGHT_TABS.filter((t) => t.id === "preview") : RIGHT_TABS} activeTab={readOnly ? "preview" : rightTab} onChange={setRightTab} />
            <div className="mt-4">
              {rightTab === "preview" &&
                (editing ? (
                  <div className="space-y-4">
                    {platforms.length > 1 && (
                      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                        {platforms.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setEditingPick(p)}
                            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                              editing === p ? "bg-white text-primary-700 shadow-sm" : "text-gray-500"
                            }`}
                          >
                            <PlatformIcon platform={p} size={12} />
                            {PLATFORM_META[p].name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-center">
                      <PlatformPreview
                        platform={editing}
                        content={htmlToPlain(content) || "Your content will appear here..."}
                        hashtags={[]}
                        mediaUrl={previewImage}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">Select a platform to see a live preview</p>
                ))}
              {/* Stay mounted while hidden so generated results survive switching to Preview and back. */}
              <div hidden={rightTab !== "ai"}>
                <AIAssistant
                  content={htmlToPlain(content, { styled: false })}
                  activePlatform={editing}
                  selectedPlatforms={platforms}
                  onUseContent={handleUseAI}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
