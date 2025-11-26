import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface Server {
  name: string;
  engine: string;
  version: string;
  location: string;
  players: number;
  last_played: Date;
}

export interface PingResult {
  online: boolean;
  latency: number;
}

export const usePingServer = () =>
  useQuery<PingResult>({
    queryKey: ["server-ping"],
    queryFn: async () => {
      return await invoke("ping_minecraft_server");
    },
    refetchInterval: 45_000,
  });

export const useStorage = () =>
  useQuery<string[]>({
    queryKey: ["servers-storage"],
    queryFn: async () => {
      return await invoke("fetch_server_storage_sizes");
    },
  });

export const useServers = () =>
  useQuery<Server[]>({
    queryKey: ["servers"],
    queryFn: async () => {
      const servers: Server[] = await invoke("fetch_servers");
      return servers.map((elem) => {
        return {
          ...elem,
          last_played: new Date(elem.last_played),
        };
      });
    },
  });
