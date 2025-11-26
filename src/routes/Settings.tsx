import { useEffect, useState } from "react";
import { dirExists, saveAppData, useAppData } from "../hooks/appdata";
import {
  Check,
  ChevronLeft,
  FolderOpen,
  HardDrive,
  RotateCcw,
  Save,
  Wifi,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../utils/utils";
import { open } from "@tauri-apps/plugin-dialog";
import Loader from "../components/Loader";

export default function Settings() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [folderExists, setFolderExists] = useState(true);
  const [canSave, setCanSave] = useState(true);

  const { data } = useAppData();
  const [appData, setAppData] = useState(data!);

  useEffect(() => {
    const correctDir = folderExists;
    const correctPort = appData.ping_port >= 0 && appData.ping_port <= 65535;
    const correctIp = appData.ping_address.length > 0;

    setCanSave(correctDir && correctPort && correctIp);
  }, [appData, folderExists]);

  useEffect(() => {
    if (!showSavedModal) return;

    const timer = setTimeout(() => {
      setShowSavedModal(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showSavedModal]);

  const handleDirChange = async (e: any, path?: string) => {
    const newPath: string = e.target.value ?? path;
    setAppData({ ...appData, working_dir: newPath });
    setFolderExists(await dirExists(newPath));
  };

  const handleIpChange = async (e: any) => {
    const newIp: string = e.target.value;
    setAppData({ ...appData, ping_address: newIp });
  };

  const handlePortChange = async (e: any) => {
    const newPort: number = parseInt(e.target.value);
    setAppData({ ...appData, ping_port: newPort });
  };

  const handleBrowse = async () => {
    const file = await open({
      multiple: false,
      directory: true,
      defaultPath: appData?.working_dir,
    });
    file ? setAppData({ ...appData, working_dir: file }) : null;
  };

  const handleSave = () => {
    setSaving(true);

    saveAppData(appData)
      .then(() => {
        setSaving(false);
        setShowSavedModal(true);
      })
      .catch((e) => {
        console.warn(e);
        setSaving(false);
      });
  };

  return (
    <main className="min-h-screen w-full bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="flex flex-col items-start w-full gap-8 min-h-[calc(100vh-3rem)]">
        <div className="flex justify-between items-center w-full">
          <div className="flex flex-col">
            <h1 className="text-5xl font-bold mb-2 bg-linear-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent p-2">
              Settings
            </h1>
            <p className="text-slate-400">
              Configure your Minecraft Server Manager
            </p>
          </div>

          <button
            onClick={() => {
              navigate("/");
            }}
            className="h-fit min-h-12 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 text-white transition-all flex items-center gap-2"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Success Message */}
        <div
          className={cn(
            "grid transition-all duration-500 ease-out w-full",
            showSavedModal ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-4 flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                <Check size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-emerald-400">Settings Saved</p>
                <p className="text-sm text-emerald-300/70">
                  Your changes have been applied successfully
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col w-full gap-4">
          <div
            style={{
              minWidth: `calc(${appData?.working_dir.length}ch + 13rem)`,
            }}
            className="bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <HardDrive size={24} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Servers Directory
                </h2>
                <p className="text-slate-400 text-sm">
                  Location where your servers are stored
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Working Directory
                </label>
                <div className="relative flex items-center gap-3">
                  <input
                    type="text"
                    value={appData?.working_dir}
                    onChange={handleDirChange}
                    className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-sm"
                    placeholder="C:\Path\To\Servers"
                  />
                  <div
                    className={cn(
                      "size-8 flex justify-center items-center absolute right-36 rounded-full",
                      folderExists ? "bg-green-500/20" : "bg-red-500/20"
                    )}
                  >
                    {folderExists ? (
                      <Check className="stroke-green-500" size={18} />
                    ) : (
                      <X className="stroke-red-500" size={18} />
                    )}
                  </div>
                  <button
                    onClick={handleBrowse}
                    className="px-5 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-white transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <FolderOpen size={18} />
                    Browse
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  All server files will be stored in this directory
                </p>
              </div>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-sm text-blue-300">
              <span className="font-semibold">💡 Tip:</span> Changing the
              working directory will not move existing servers. You'll need to
              manually move server folders to the new location.
            </p>
          </div>

          <div
            style={{
              minWidth: `calc(${appData?.working_dir.length}ch + 13rem)`,
            }}
            className="bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                <Wifi size={24} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Server status check
                </h2>
                <p className="text-slate-400 text-sm">
                  Ip address and a port to check the status of your server
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Hostname and Port
                </label>
                <div className="relative flex items-center gap-3">
                  <input
                    type="text"
                    value={appData?.ping_address}
                    onChange={handleIpChange}
                    className="flex-4 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-sm"
                    placeholder="your_server.net"
                  />
                  <input
                    type="number"
                    value={appData?.ping_port}
                    step={1}
                    min={0}
                    max={65535}
                    onChange={handlePortChange}
                    className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-sm"
                    placeholder="25565"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  The address doesn't have to lead to your server
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex w-full gap-4">
          <button
            onClick={() => {
              setAppData(data!);
              setFolderExists(true);
            }}
            className="flex-1 px-6 py-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 text-white font-semibold transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={20} />
            Don't Save
          </button>
          {saving ? (
            <button
              style={{ cursor: "not-allowed" }}
              className="flex-1 px-6 py-4 rounded-xl bg-linear-to-r from-emerald-500 to-cyan-500 text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <Loader size={20} />
              Saving...
            </button>
          ) : canSave ? (
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-4 rounded-xl bg-linear-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[102%]"
            >
              <Save size={20} />
              Save Changes
            </button>
          ) : (
            <button
              style={{ cursor: "not-allowed" }}
              className="flex-1 px-6 py-4 rounded-xl bg-linear-to-r from-red-500 to-orange-500 text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/25"
            >
              <X size={20} />
              Can't Save
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
