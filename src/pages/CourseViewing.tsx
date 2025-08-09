import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import LiquidBackground from "@/components/LiquidBackground";
import GlassCard from "@/components/GlassCard";
import LiquidButton from "@/components/LiquidButton";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, AlertTriangle, Play, Download } from "lucide-react";

type Course = {
  id: string;
  name: string;
  description: string | null;
  instructor_name: string | null;
  level: string | null;
  category: string | null;
  thumbnail_url: string | null;
  rate: number | null;
  students_enrolled: number | null;
  is_paid: boolean | null;
};

type DpVideo = {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  video_no: number | null;
  stream: string | null;
  subject: string | null;
  course_id: string;
};

type Video = {
  id: string;
  title: string;
  instructor: string | null;
  video_url: string | null;
  duration: number | null;
  thumbnail_url: string | null;
  order_index: number | null;
  is_free: boolean | null;
};

type TopicWithVideos = {
  id: string;
  title: string;
  order_index: number | null;
  videos: Video[];
};

type Resource = {
  id: string;
  name: string | null;
  file_url: string | null;
  type: string | null; // 'pdf' | 'zip' | 'link'
};

const CourseViewing: React.FC = () => {
  const params = useParams();
  const id = params.id as string | undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const deepTopicId = searchParams.get("topic") || undefined;
  const deepVideoId = searchParams.get("video") || undefined;

  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<DpVideo[]>([]);
  const [topics, setTopics] = useState<TopicWithVideos[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeTab, setActiveTab] = useState<"videos" | "resources">(
    (searchParams.get("tab") as "videos" | "resources") || "videos"
  );
  const [topicSearch, setTopicSearch] = useState<string>("");
  const [resourceSearch, setResourceSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string; url: string | null } | null>(null);

  // Normalize various YouTube URL formats into embeddable form
  const normalizeVideoUrl = (raw: string | null | undefined) => {
    if (!raw) return null;
    try {
      const u = new URL(raw);

      // youtu.be/VIDEO_ID
      if (u.hostname === "youtu.be") {
        const id = u.pathname.replace("/", "");
        if (id) {
          return `https://www.youtube.com/embed/${id}?modestbranding=1&rel=0&playsinline=1`;
        }
      }

      // www.youtube.com/watch?v=VIDEO_ID
      if (u.hostname.includes("youtube.com")) {
        // shorts
        if (u.pathname.startsWith("/shorts/")) {
          const id = u.pathname.split("/shorts/")[1]?.split("?")[0];
          if (id) {
            return `https://www.youtube.com/embed/${id}?modestbranding=1&rel=0&playsinline=1`;
          }
        }
        // watch with v param
        const vid = u.searchParams.get("v");
        if (vid) {
          return `https://www.youtube.com/embed/${vid}?modestbranding=1&rel=0&playsinline=1`;
        }
        // already embed
        if (u.pathname.startsWith("/embed/")) {
          return raw;
        }
      }

      // default: return as-is (Vimeo or direct mp4 etc.)
      return raw;
    } catch {
      return raw;
    }
  };

  useEffect(() => {
    // keep local tab state in sync if URL changes externally (back/forward)
    const qpTab = searchParams.get("tab");
    if (qpTab === "videos" || qpTab === "resources") {
      if (qpTab !== activeTab) setActiveTab(qpTab);
    }

    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);

        // Fetch course details by route id
        const { data: courseData, error: courseErr } = await supabase
          .from("courses")
          .select(
            "id,name,description,instructor_name,level,category,thumbnail_url,rate,students_enrolled,is_paid"
          )
          .eq("id", id)
          .single();

        if (courseErr) {
          throw new Error(courseErr.message);
        }
        setCourse(courseData as Course);

        // Fetch topics with nested videos (ordered)
        const { data: topicsData, error: topicsErr } = await supabase
          .from("topics")
          .select(
            `
            id,
            title,
            order_index,
            videos:videos (
              id,
              title,
              instructor,
              video_url,
              duration,
              thumbnail_url,
              order_index,
              is_free
            )
          `
          )
          .eq("course_id", id)
          .order("order_index", { ascending: true });

        if (topicsErr) {
          throw new Error(topicsErr.message);
        }

        // Sort videos inside each topic by order_index ascending (fallback nulls last)
        const normalized = (topicsData ?? []).map((t: TopicWithVideos) => ({
          ...t,
          videos: (t.videos ?? [])
            .slice()
            .sort((a: Video, b: Video) => {
              const av = a.order_index ?? Number.MAX_SAFE_INTEGER;
              const bv = b.order_index ?? Number.MAX_SAFE_INTEGER;
              return av - bv;
            }),
        })) as TopicWithVideos[];

        // Default: open first topic or honor deep link topic; if only video specified, open its parent when found
        const initialOpen: Record<string, boolean> = {};
        if (deepTopicId && normalized.some((t) => t.id === deepTopicId)) {
          initialOpen[deepTopicId] = true;
        } else if (normalized.length > 0) {
          initialOpen[normalized[0].id] = true;
        }
        setOpenTopics(initialOpen);
        setTopics(normalized);

        // Initialize inline player from deep link if available
        let initialized = false;
        if (deepVideoId) {
          for (const tp of normalized) {
            const found = tp.videos.find((v: Video) => v.id === deepVideoId);
            if (found) {
              setSelectedVideo({ id: found.id, title: found.title, url: found.video_url ?? null });
              initialized = true;
              break;
            }
          }
        }

        // Also keep dpeducationvideos list (ordered by video_no)
        const { data: vids, error: vidsErr } = await supabase
          .from("dpeducationvideos")
          .select("id,thumbnail_url,video_url,video_no,stream,subject,course_id")
          .eq("course_id", id)
          .order("video_no", { ascending: true });

        const dpList = (!vidsErr ? (vids ?? []) : []) as DpVideo[];
        if (!vidsErr) setVideos(dpList);

        // Auto-select first available video if none selected via deep link:
        // Priority 1: first topic's first video by order_index
        // Priority 2: first dpEducationVideos entry by video_no
        if (!initialized) {
          const firstTopicWithVideo = normalized.find((t) => (t.videos ?? []).length > 0);
          const firstTopicVideo = firstTopicWithVideo?.videos?.[0];
          if (firstTopicVideo) {
            setSelectedVideo({
              id: firstTopicVideo.id,
              title: firstTopicVideo.title,
              url: firstTopicVideo.video_url ?? null,
            });
            // reflect in URL: set tab=videos and topic/video ids
            setSearchParams((prev) => {
              const sp = new URLSearchParams(prev);
              sp.set("tab", "videos");
              sp.set("topic", firstTopicWithVideo!.id);
              sp.set("video", firstTopicVideo.id);
              return sp;
            });
          } else if (dpList.length > 0) {
            const firstDp = dpList[0];
            setSelectedVideo({
              id: firstDp.id,
              title: firstDp.subject ? `${firstDp.subject} #${firstDp.video_no ?? ""}` : "Video",
              url: firstDp.video_url ?? null,
            });
            // reflect in URL: ensure tab=videos; no topic/video from topics, but keep tab for consistency
            setSearchParams((prev) => {
              const sp = new URLSearchParams(prev);
              sp.set("tab", "videos");
              sp.delete("topic");
              sp.set("video", firstDp.id);
              return sp;
            });
          }
        }

        // Fetch related resources via topics -> resources
        const topicIds = normalized.map((t) => t.id);
        if (topicIds.length > 0) {
          const { data: res, error: resErr } = await supabase
            .from("resources")
            .select("id,name,file_url,type,topic_id")
            .in("topic_id", topicIds);
          if (resErr) {
            throw new Error(resErr.message);
          }
          setResources(
            (res ?? []).map((r: Resource) => ({
              id: r.id,
              name: r.name,
              file_url: r.file_url,
              type: r.type,
            }))
          );
        } else {
          setResources([]);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message ?? "Failed to load course");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, deepTopicId, searchParams, activeTab, setSearchParams, deepVideoId]);

  // After topics render, scroll the highlighted video into view smoothly (once)
  useEffect(() => {
    if (deepVideoId && highlightedRef.current) {
      // Small timeout to ensure layout is ready
      const t = setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [deepVideoId, topics, activeTab, topicSearch]);

  return (
    <div className="min-h-screen pt-24">
      <LiquidBackground />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link to="/courses">
            <LiquidButton variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Courses
            </LiquidButton>
          </Link>
        </div>

        {loading && (
          <div className="space-y-6">
            {/* Header skeleton */}
            <div className="p-6 rounded-xl border border-ocean-100 bg-white/70">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-72 h-44 rounded-xl bg-ocean-100/60 animate-pulse" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 w-40 bg-ocean-100 rounded animate-pulse" />
                  <div className="h-8 w-2/3 bg-ocean-100 rounded animate-pulse" />
                  <div className="h-4 w-full bg-ocean-100 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-ocean-100 rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Now Playing skeleton */}
            <div className="p-6 rounded-xl border border-ocean-100 bg-white/70">
              <div className="h-6 w-56 bg-ocean-100 rounded mb-4 animate-pulse" />
              <div className="relative w-full rounded-xl overflow-hidden bg-ocean-100/60" style={{ aspectRatio: "16 / 9" }}>
                <div className="absolute inset-0 animate-pulse" />
              </div>
            </div>

            {/* Tabs + search skeleton */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <div className="h-10 w-28 bg-ocean-100 rounded-full animate-pulse" />
                <div className="h-10 w-32 bg-ocean-100 rounded-full animate-pulse" />
              </div>
              <div className="h-12 w-[28rem] max-w-full bg-ocean-100 rounded-full animate-pulse" />
            </div>

            {/* Topics grid skeleton */}
            <div className="space-y-6 pt-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="border border-ocean-100 rounded-xl overflow-hidden">
                  <div className="w-full px-4 py-3 bg-white/70">
                    <div className="h-6 w-40 bg-ocean-100 rounded animate-pulse" />
                  </div>
                  <div className="p-4">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="rounded-xl bg-white/70 border border-ocean-100 overflow-hidden">
                          <div className="h-40 bg-ocean-100/60 animate-pulse" />
                          <div className="p-4 space-y-2">
                            <div className="h-4 w-24 bg-ocean-100 rounded animate-pulse" />
                            <div className="h-5 w-3/4 bg-ocean-100 rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && course && (
          <>
            {/* Header card */}
            <GlassCard className="p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-72 h-44 rounded-xl overflow-hidden">
                  <img
                    src={course.thumbnail_url ?? "https://placehold.co/600x400?text=Course"}
                    alt={course.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
                      {course.category ?? "Uncategorized"}
                    </span>
                    {course.level && (
                      <span className="text-xs font-medium text-ocean-700 bg-ocean-50 px-2 py-1 rounded-full border border-ocean-100">
                        {course.level}
                      </span>
                    )}
                    <span className="text-xs text-ocean-500">
                      {(course.students_enrolled ?? 0).toLocaleString()} students
                    </span>
                    <span className="text-xs text-ocean-500">
                      {course.is_paid ? "Paid" : "Free"}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-ocean-700 mb-2">{course.name}</h1>
                  {course.instructor_name && (
                    <p className="text-ocean-500 mb-2">By {course.instructor_name}</p>
                  )}
                  <p className="text-ocean-600">{course.description}</p>
                </div>
              </div>
            </GlassCard>

            {/* Tabs placed directly under Now Playing */}
            <div className="mb-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setActiveTab("videos");
                    setSearchParams((prev) => {
                      const sp = new URLSearchParams(prev);
                      sp.set("tab", "videos");
                      return sp;
                    });
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    activeTab === "videos"
                      ? "bg-ocean-600 text-white border-ocean-600"
                      : "bg-white/60 text-ocean-700 border-ocean-200 hover:bg-white"
                  }`}
                >
                  Videos
                </button>
                <button
                  onClick={() => {
                    setActiveTab("resources");
                    setSearchParams((prev) => {
                      const sp = new URLSearchParams(prev);
                      sp.set("tab", "resources");
                      return sp;
                    });
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    activeTab === "resources"
                      ? "bg-ocean-600 text-white border-ocean-600"
                      : "bg-white/60 text-ocean-700 border-ocean-200 hover:bg-white"
                  }`}
                >
                  Resources
                </button>
              </div>
            </div>

            {/* Now Playing just below header */}
            {selectedVideo && activeTab === "videos" && (
              <GlassCard className="p-4 mb-8 md:p-6">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h4 className="text-xl md:text-2xl font-semibold text-ocean-700 line-clamp-2">
                      Now Playing: {selectedVideo.title}
                    </h4>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedVideo(null)}
                        className="text-sm md:text-base text-ocean-600 hover:text-ocean-800 underline"
                      >
                        Close
                      </button>
                      <a
                        href={selectedVideo.url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        title="Open fullscreen"
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-ocean-200 text-ocean-700 hover:bg-ocean-50"
                      >
                        <span className="text-lg leading-none">⤢</span>
                      </a>
                    </div>
                  </div>
                  {selectedVideo.url ? (
                    <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: "16 / 9" }}>
                      <iframe
                        key={selectedVideo.id}
                        src={(normalizeVideoUrl(selectedVideo.url) ?? undefined) as string}
                        title={selectedVideo.title}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-ocean-500">This video has no playable URL.</div>
                  )}
                </div>
              </GlassCard>
            )}

            {/* Search bar below Tabs */}
            <div className="mb-6">
              {activeTab === "videos" && (
                <div className="relative w-full md:w-[28rem]">
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="Search topics or video titles..."
                    className="w-full pl-5 pr-4 py-3 bg-white/80 border border-ocean-200 rounded-full focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:border-transparent transition-all duration-300 text-base"
                  />
                </div>
              )}
              {activeTab === "resources" && (
                <div className="flex items-center gap-3 w-full md:w-[28rem]">
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={resourceSearch}
                      onChange={(e) => setResourceSearch(e.target.value)}
                      placeholder="Search resources..."
                      className="w-full pl-5 pr-4 py-3 bg-white/80 border border-ocean-200 rounded-full focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:border-transparent transition-all duration-300 text-base"
                    />
                  </div>
                  <div className="text-ocean-500 text-sm whitespace-nowrap">
                    Showing {resources.filter(r => {
                      const q = resourceSearch.trim().toLowerCase();
                      if (!q) return true;
                      const name = (r.name ?? "").toLowerCase();
                      const type = (r.type ?? "").toLowerCase();
                      return name.includes(q) || type.includes(q);
                    }).length} resource{resources.filter(r => {
                      const q = resourceSearch.trim().toLowerCase();
                      if (!q) return true;
                      const name = (r.name ?? "").toLowerCase();
                      const type = (r.type ?? "").toLowerCase();
                      return name.includes(q) || type.includes(q);
                    }).length === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </div>

            {/* Tab content */}
            {activeTab === "videos" ? (
              <>
                {/* compute filtered topics */}
                {(() => {
                  const q = topicSearch.trim().toLowerCase();
                  const computed =
                    q === ""
                      ? topics
                      : (topics
                          .map((t) => {
                            const topicMatch = t.title.toLowerCase().includes(q);
                            const videosMatch = t.videos.filter((v) =>
                              (v.title ?? "").toLowerCase().includes(q)
                            );
                            if (topicMatch) return { ...t, videos: t.videos };
                            if (videosMatch.length > 0) return { ...t, videos: videosMatch };
                            return null;
                          })
                          .filter(Boolean) as TopicWithVideos[]);
                  return (
                    <>
                      {computed.length === 0 ? (
                        <GlassCard className="p-8 text-center text-ocean-500">
                          No topics or videos match your search.
                        </GlassCard>
                      ) : (
                        <div className="space-y-6">
                          {computed.map((t) => {
                            const isOpen = !!openTopics[t.id];
                            return (
                              <div key={t.id} className="border border-ocean-100 rounded-xl overflow-hidden">
                                <button
                                  onClick={() =>
                                    setOpenTopics((prev) => ({ ...prev, [t.id]: !prev[t.id] }))
                                  }
                                  className="w-full flex items-center justify-between px-4 py-3 bg-white/70 hover:bg-white transition text-left"
                                >
                                  <div>
                                    <h3 className="text-lg md:text-xl font-semibold text-ocean-700">
                                      {t.title}
                                    </h3>
                                    <span className="text-xs text-ocean-500">
                                      {t.videos.length} video{t.videos.length === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                  <span
                                    className={`ml-4 inline-block transform transition-transform ${
                                      isOpen ? "rotate-180" : "rotate-0"
                                    }`}
                                    aria-hidden="true"
                                  >
                                    ▾
                                  </span>
                                </button>

                                {isOpen && (
                                  <div className="p-4">
                                    {t.videos.length === 0 ? (
                                      <GlassCard className="p-6 text-ocean-500">
                                        No videos under this topic.
                                      </GlassCard>
                                    ) : (
                                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {t.videos.map((v) => {
                                          const isHighlighted = deepVideoId === v.id;
                                          return (
                                            <div
                                              key={v.id}
                                              ref={isHighlighted ? highlightedRef : undefined}
                                              className={`rounded-xl bg-white/70 backdrop-blur-sm border border-ocean-100 overflow-hidden group transition-shadow ${
                                                isHighlighted ? "ring-2 ring-teal-500 shadow-lg" : ""
                                              }`}
                                            >
                                              <div
                                                className="relative h-40 overflow-hidden cursor-pointer"
                                                onClick={() => {
                                                  setSearchParams((prev) => {
                                                    const sp = new URLSearchParams(prev);
                                                    sp.set("tab", "videos");
                                                    sp.set("topic", t.id);
                                                    sp.set("video", v.id);
                                                    return sp;
                                                  });
                                                  setSelectedVideo({
                                                    id: v.id,
                                                    title: v.title,
                                                    url: v.video_url ?? null,
                                                  });
                                                }}
                                                role="button"
                                                aria-label={`Play ${v.title}`}
                                              >
                                                <img
                                                  src={v.thumbnail_url ?? "https://placehold.co/600x400?text=Video"}
                                                  alt={v.title}
                                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                                {v.order_index != null && (
                                                  <div className="absolute bottom-2 left-2">
                                                    <span className="text-xs text-white/90 bg-black/40 px-2 py-0.5 rounded">
                                                      #{v.order_index}
                                                    </span>
                                                  </div>
                                                )}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                                    <Play className="w-7 h-7 text-white ml-0.5" />
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="p-4">
                                                <div className="text-sm text-ocean-500 mb-1">
                                                  {v.instructor ?? ""}
                                                </div>
                                                <button
                                                  className="text-left text-ocean-700 font-semibold hover:underline"
                                                  onClick={() => {
                                                    setSearchParams((prev) => {
                                                      const sp = new URLSearchParams(prev);
                                                      sp.set("tab", "videos");
                                                      sp.set("topic", t.id);
                                                      sp.set("video", v.id);
                                                      return sp;
                                                    });
                                                    setSelectedVideo({
                                                      id: v.id,
                                                      title: v.title,
                                                      url: v.video_url ?? null,
                                                    });
                                                  }}
                                                >
                                                  {v.title}
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Inline player moved to top above course header */}
                    </>
                  );
                })()}

                {/* dpEducationVideos dedicated section */}
                <div className="mt-10">
                  <h3 className="text-xl md:text-2xl font-semibold text-ocean-700 mb-4">
                    Sinhala Library
                  </h3>
                  {videos.length === 0 ? (
                    <GlassCard className="p-6 text-ocean-500">No Sinhala library videos for this course.</GlassCard>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {videos.map((dv) => (
                        <div
                          key={dv.id}
                          className="rounded-xl bg-white/70 backdrop-blur-sm border border-ocean-100 overflow-hidden group"
                        >
                          <div
                            className="relative h-40 overflow-hidden cursor-pointer"
                            onClick={() => {
                              setSelectedVideo({
                                id: dv.id,
                                title: dv.subject ? `${dv.subject} #${dv.video_no ?? ""}` : "Video",
                                url: dv.video_url ?? null,
                              });
                              setSearchParams((prev) => {
                                const sp = new URLSearchParams(prev);
                                sp.set("tab", "videos");
                                sp.delete("topic");
                                sp.set("video", dv.id);
                                return sp;
                              });
                            }}
                            role="button"
                            aria-label={`Play ${dv.subject ?? "Video"}`}
                          >
                            <img
                              src={dv.thumbnail_url ?? "https://placehold.co/600x400?text=Video"}
                              alt={dv.subject ?? "Video"}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            {dv.video_no != null && (
                              <div className="absolute top-2 left-2">
                                <span className="text-xs text-white/90 bg-black/40 px-2 py-0.5 rounded">
                                  #{dv.video_no}
                                </span>
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                <Play className="w-7 h-7 text-white ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="text-sm text-ocean-500 mb-1">
                              {dv.stream ?? ""}
                            </div>
                            <div className="text-ocean-700 font-semibold line-clamp-2">
                              {dv.subject ? `${dv.subject}` : "Video"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : resources.length === 0 ? (
              <GlassCard className="p-8 text-center text-ocean-500">
                No resources found for this course.
              </GlassCard>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {resources
                  .filter((r) => {
                    const q = resourceSearch.trim().toLowerCase();
                    if (!q) return true;
                    const name = (r.name ?? "").toLowerCase();
                    const type = (r.type ?? "").toLowerCase();
                    return name.includes(q) || type.includes(q);
                  })
                  .map((r) => (
                  <GlassCard key={r.id} className="p-5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-ocean-700">
                        {r.name ?? "Resource"}
                      </div>
                      <div className="text-sm text-ocean-500">
                        {r.type?.toUpperCase() ?? "FILE"}
                      </div>
                    </div>
                    {r.file_url ? (
                      <a
                        href={r.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-ocean-700 hover:underline"
                      >
                        <Download className="w-4 h-4" />
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-ocean-400">No link</span>
                    )}
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CourseViewing;
