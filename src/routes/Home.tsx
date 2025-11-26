import {
  ArrowUp,
  Cpu,
  HardDrive,
  Plus,
  Search,
  Settings,
  Signal,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { ServerCard } from "../components/ServerCard";
import NoDataSvg from "../components/svgs/NoDataSvg";
import { useAppData } from "../hooks/appdata";
import {
  Server,
  usePingServer,
  useServers,
  useStorage,
} from "../hooks/servers";

export default function Home() {
  const navigate = useNavigate();
  const { data: appData, isLoading: isAppDataLoading } = useAppData();
  const { data: servers, isLoading } = useServers();
  const { data: storage, isLoading: isStorageLoading } = useStorage();
  const {
    data: ping,
    isLoading: isPinging,
    isRefetching: isRePinging,
    refetch: rePing,
  } = usePingServer();

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(10);
  const observerRef = useRef<HTMLDivElement>(null);

  // Memoize filtered and sorted servers
  const filteredServers = useMemo(() => {
    if (!servers) return [];
    return (
      [...servers].map((server, index) => ({
        ...server,
        storage: storage ? storage[index] : 0,
      })) as (Server & { storage: string })[]
    )
      .sort((a, b) => b.last_played.getTime() - a.last_played.getTime())
      .filter(
        (server) =>
          server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          server.engine.toLowerCase().includes(searchQuery.toLowerCase()) ||
          server.version.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [servers, searchQuery, storage]);

  const displayedServers = useMemo(() => {
    return filteredServers.slice(0, displayCount);
  }, [filteredServers, displayCount]);

  const hasMore = filteredServers.length > displayCount;

  // Memoize total storage computation
  const totalStorage = useMemo(() => {
    return storage?.reduce((sum, s) => sum + parseFloat(s), 0).toFixed(2);
  }, [storage]);

  const handleCreate = () => {};

  // Infinite scroll observer
  useEffect(() => {
    if (!observerRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => prev + 10);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  // Reset display count when search query changes
  useEffect(() => {
    setDisplayCount(10);
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="flex justify-start flex-col gap-8 min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Top Section */}
      <div className="flex w-full justify-between items-center">
        <div className="flex flex-col justify-center items-start">
          <div className="flex justify-center items-center gap-2">
            <span className="text-6xl font-bold mb-2 bg-linear-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              MC
            </span>
            <span className="flex flex-col">
              <span className="text-3xl font-medium ">Server Creator</span>
              <span className="text-sm text-white/50 font-light">
                Version 0.0.1 Alpha
              </span>
            </span>
          </div>
          <div className="text-white/20 text-xs font-extralight">
            Working Dir {isAppDataLoading ? "Loading..." : appData?.working_dir}
          </div>
        </div>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => navigate("/settings")}
            className="h-fit min-h-12 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 text-white transition-all flex items-center gap-2"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleCreate}
            className="h-fit min-h-12 px-6 py-3 rounded-xl bg-linear-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[102%]"
          >
            <Plus size={20} />
            Create Server
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-linear-to-br from-emerald-500/10 to-emerald-500/5 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Total Servers</p>
              {isLoading ? (
                <Loader />
              ) : (
                <p className="text-4xl font-bold text-white">
                  {servers?.length}
                </p>
              )}
            </div>
            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Cpu size={28} className="text-emerald-400" />
            </div>
          </div>
        </div>

        {isPinging || isRePinging ? (
          <div className="bg-linear-to-br from-gray-500/10 to-gray-500/5 backdrop-blur-xl border border-gray-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Server Accessible</p>
                <p className="text-4xl font-bold text-gray-500">Pinging...</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center">
                <Loader size={28} className="text-gray-400" />
              </div>
            </div>
          </div>
        ) : ping?.online ? (
          <div
            onClick={() => {
              rePing();
            }}
            className="cursor-pointer bg-linear-to-br from-green-500/10 to-green-500/5 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 hover:from-green-600/10 hover:to-green-600/6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Server Accessible</p>
                <p className="text-4xl font-bold text-green-500">
                  {ping.latency} ms
                </p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Signal size={28} className="text-green-400" />
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => {
              rePing();
            }}
            className="bg-linear-to-br from-red-500/10 to-red-500/5 hover:to-red-600/5 hover:from-red-600/10 backdrop-blur-xl border border-red-500/20 hover:border-red-600/20 rounded-2xl p-6 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Server Accessible</p>
                <p className="text-4xl font-bold text-red-500">False</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center">
                <WifiOff size={28} className="text-red-400" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-linear-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Total Storage</p>
              {isStorageLoading ? (
                <Loader />
              ) : (
                <p className="text-4xl font-bold text-white">
                  {totalStorage} GB
                </p>
              )}
            </div>
            <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <HardDrive size={28} className="text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          size={20}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search servers by name, engine, or version..."
          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
        />
      </div>

      {/* Server Grid */}
      {isLoading ? (
        <div className="w-full flex justify-center">
          <Loader />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {displayedServers.map((server, i) => (
            <ServerCard key={`server${i}${server.location}`} server={server} />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={observerRef} className="w-full py-4 flex justify-center">
          <div className="animate-pulse text-slate-500 text-sm">
            Loading more servers...
          </div>
        </div>
      )}

      {/* No data messages */}
      {filteredServers.length === 0 &&
        (servers?.length === 0 ? (
          <div className="flex flex-col w-full justify-center items-center">
            <NoDataSvg className="w-64 h-48" />
            <div className="flex flex-col justify-center items-center gap-4">
              <p className="text-slate-400 text-3xl">No Servers Created Yet</p>
              <button
                onClick={handleCreate}
                className="h-fit min-h-12 px-6 py-3 rounded-xl bg-linear-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[102%]"
              >
                <Plus size={20} />
                Create One
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">No servers found</p>
            <p className="text-slate-500 text-sm mt-2">
              Try adjusting your search
            </p>
          </div>
        ))}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 w-12 h-12 rounded-full bg-linear-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center transition-all duration-300 ${
          showScrollTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-16 pointer-events-none"
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp size={20} />
      </button>
    </main>
  );
}
