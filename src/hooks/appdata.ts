import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface AppData {
  working_dir: string;
  ping_address: string;
  ping_port: number;
}

export const useAppData = () =>
  useQuery<AppData>({
    queryKey: ["appData"],
    queryFn: async () => {
      return await invoke("get_app_data");
    },
  });

export const saveAppData = async (data: AppData) => {
  return await invoke("save_app_data", { data });
};

export const dirExists = async (path: string): Promise<boolean> => {
  return await invoke("folder_exists", { path });
};
