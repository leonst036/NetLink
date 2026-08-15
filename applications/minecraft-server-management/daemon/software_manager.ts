// Software Manager Module for Minecraft Wings Daemon
// Handles resolving and downloading server jars for different softwares, versions, and build numbers.

export interface SoftwareOption {
  id: string;
  name: string;
  description: string;
  recommendedVersion: string;
  supportedVersions: string[];
  supportsBuilds?: boolean;
  buildLabel?: string;
}

export const SUPPORTED_SOFTWARES: SoftwareOption[] = [
  {
    id: "paper",
    name: "PaperMC",
    description: "High-performance Spigot fork with bug fixes and plugin support.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
    supportsBuilds: true,
    buildLabel: "Build Number",
  },
  {
    id: "purpur",
    name: "Purpur",
    description: "Drop-in replacement for Paper with extensive gameplay configuration.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
    supportsBuilds: true,
    buildLabel: "Build Number",
  },
  {
    id: "vanilla",
    name: "Vanilla (Mojang)",
    description: "Official, unmodded Minecraft server software directly from Mojang.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2"],
    supportsBuilds: false,
  },
  {
    id: "fabric",
    name: "Fabric",
    description: "Lightweight, highly-modular mod loader with fast startup and low overhead.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
    supportsBuilds: true,
    buildLabel: "Loader Version",
  },
  {
    id: "forge",
    name: "Forge",
    description: "Classic modding platform supporting thousands of mods across all Minecraft versions.",
    recommendedVersion: "1.20.1",
    supportedVersions: ["1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.19.2", "1.18.2", "1.16.5", "1.12.2", "1.7.10"],
    supportsBuilds: true,
    buildLabel: "Forge Version",
  },
  {
    id: "spigot",
    name: "Spigot",
    description: "Modified Minecraft server with Bukkit plugin compatibility.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.1", "1.20.4", "1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2"],
    supportsBuilds: false,
  },
];

export interface InstanceSoftwareConfig {
  software: string;
  version: string;
  build?: string;
  jarFile: string;
  updatedAt?: number;
}

const USER_AGENT_HEADER = {
  "User-Agent": "NetLink-MinecraftManager/1.0 (https://github.com/leonst036/NetLink)",
};

// Get current instance software config
export async function getInstanceSoftware(serverPath: string): Promise<InstanceSoftwareConfig> {
  try {
    const raw = await Deno.readTextFile(`${serverPath}/instance_config.json`);
    const cfg = JSON.parse(raw);
    return {
      software: cfg.software || "vanilla",
      version: cfg.version || "1.20.4",
      build: cfg.build || "latest",
      jarFile: cfg.jarFile || "server.jar",
      updatedAt: cfg.updatedAt,
    };
  } catch {}
  return {
    software: "vanilla",
    version: "1.20.4",
    build: "latest",
    jarFile: "server.jar",
  };
}

// Fetch available builds / loader versions dynamically
export async function getAvailableBuilds(
  software: string,
  version: string
): Promise<{ builds: string[]; latest: string }> {
  const normalizedSoftware = software.toLowerCase();

  switch (normalizedSoftware) {
    case "paper": {
      try {
        const res = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`, {
          headers: USER_AGENT_HEADER,
        });
        if (res.ok) {
          const buildsData = await res.json();
          if (Array.isArray(buildsData) && buildsData.length > 0) {
            const builds = buildsData.map((b: any) => b.id.toString());
            return { builds, latest: builds[0] };
          }
        }
      } catch {}
      return { builds: [], latest: "latest" };
    }

    case "purpur": {
      try {
        const res = await fetch(`https://api.purpurmc.org/v2/purpur/${version}`, {
          headers: USER_AGENT_HEADER,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.builds && Array.isArray(data.builds.all)) {
            const reversed = [...data.builds.all].reverse();
            return { builds: reversed, latest: data.builds.latest || reversed[0] || "latest" };
          }
        }
      } catch {}
      return { builds: [], latest: "latest" };
    }

    case "fabric": {
      try {
        const res = await fetch("https://meta.fabricmc.net/v2/versions/loader", {
          headers: USER_AGENT_HEADER,
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const builds = data.map((l: any) => l.version);
            return { builds, latest: builds[0] || "0.16.10" };
          }
        }
      } catch {}
      return { builds: ["0.19.3", "0.16.10", "0.16.9", "0.15.11"], latest: "0.19.3" };
    }

    case "forge": {
      try {
        const res = await fetch("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json", {
          headers: USER_AGENT_HEADER,
        });
        if (res.ok) {
          const data = await res.json();
          const promos = data.promos || {};
          const builds: string[] = [];
          const rec = promos[`${version}-recommended`];
          const lat = promos[`${version}-latest`];
          if (lat) builds.push(lat);
          if (rec && !builds.includes(rec)) builds.push(rec);

          for (const [k, v] of Object.entries(promos)) {
            if (k.startsWith(version) && typeof v === "string" && !builds.includes(v)) {
              builds.push(v);
            }
          }
          const latest = lat || rec || (builds.length > 0 ? builds[0] : "latest");
          return { builds, latest };
        }
      } catch {}
      return { builds: [], latest: "latest" };
    }

    default:
      return { builds: [], latest: "" };
  }
}

// Resolve download URL for specific software, version, and build
export async function resolveJarDownloadUrl(
  software: string,
  version: string,
  build?: string
): Promise<string> {
  const normalizedSoftware = software.toLowerCase();
  const trimmedBuild = build && build.trim() !== "" ? build.trim() : "latest";

  switch (normalizedSoftware) {
    case "paper": {
      try {
        // Fetch builds from PaperMC Fill v3 API
        const buildsRes = await fetch(
          `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`,
          {
            headers: USER_AGENT_HEADER,
          }
        );
        if (buildsRes.ok) {
          const buildsData = await buildsRes.json();
          if (Array.isArray(buildsData) && buildsData.length > 0) {
            if (trimmedBuild !== "latest") {
              const matched = buildsData.find((b: any) => b.id.toString() === trimmedBuild);
              if (matched && matched.downloads?.["server:default"]?.url) {
                return matched.downloads["server:default"].url;
              }
            }
            // Default to latest build
            const latestBuild = buildsData[0];
            const directUrl = latestBuild.downloads?.["server:default"]?.url;
            if (directUrl) return directUrl;
          }
        }
      } catch {}
      return "";
    }

    case "purpur": {
      if (trimmedBuild !== "latest") {
        return `https://api.purpurmc.org/v2/purpur/${version}/${trimmedBuild}/download`;
      }
      return `https://api.purpurmc.org/v2/purpur/${version}/latest/download`;
    }

    case "fabric": {
      const loaderVersion = trimmedBuild !== "latest" ? trimmedBuild : "0.16.10";
      return `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/1.0.1/server/jar`;
    }

    case "forge": {
      try {
        let forgeVersion = trimmedBuild;
        if (forgeVersion === "latest") {
          const res = await fetch("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json", {
            headers: USER_AGENT_HEADER,
          });
          if (res.ok) {
            const data = await res.json();
            forgeVersion = data.promos?.[`${version}-recommended`] || data.promos?.[`${version}-latest`] || "";
          }
        }

        if (forgeVersion && forgeVersion !== "latest") {
          const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
          const universalUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-universal.jar`;

          try {
            const testRes = await fetch(installerUrl, { method: "HEAD", headers: USER_AGENT_HEADER });
            if (testRes.ok) return installerUrl;
          } catch {}

          return universalUrl;
        }
      } catch {}
      return "";
    }

    case "vanilla":
    default: {
      try {
        const manifestRes = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          const target = manifest.versions?.find((v: any) => v.id === version);
          if (target && target.url) {
            const versionRes = await fetch(target.url);
            if (versionRes.ok) {
              const versionData = await versionRes.json();
              if (versionData.downloads?.server?.url) {
                return versionData.downloads.server.url;
              }
            }
          }
        }
      } catch {}
      return "https://piston-data.mojang.com/v1/objects/8dd1a28015f51b1803213892b50b7b4fc76e594d/server.jar";
    }
  }
}

// Download and install software jar into server directory
export async function installServerSoftware(
  serverPath: string,
  software: string,
  version: string,
  build?: string,
  jarFile: string = "server.jar"
): Promise<{ success: boolean; jarPath: string; error?: string }> {
  try {
    const downloadUrl = await resolveJarDownloadUrl(software, version, build);
    if (!downloadUrl) {
      return {
        success: false,
        jarPath: "",
        error: `Could not resolve download URL for ${software} ${version}${build ? ` (build ${build})` : ""}`,
      };
    }

    const res = await fetch(downloadUrl, {
      headers: USER_AGENT_HEADER,
    });
    if (!res.ok) {
      return { success: false, jarPath: "", error: `Failed to download jar from ${downloadUrl} (HTTP ${res.status})` };
    }

    const buffer = await res.arrayBuffer();
    const targetFile = `${serverPath}/${jarFile}`;

    // Backup previous jar if exists
    try {
      await Deno.copyFile(targetFile, `${targetFile}.bak`);
    } catch {}

    await Deno.writeFile(targetFile, new Uint8Array(buffer));

    // Update instance_config.json
    let cfg: Record<string, any> = {};
    try {
      const raw = await Deno.readTextFile(`${serverPath}/instance_config.json`);
      cfg = JSON.parse(raw);
    } catch {}

    cfg.software = software;
    cfg.version = version;
    cfg.build = build || "latest";
    cfg.jarFile = jarFile;
    cfg.updatedAt = Date.now();

    await Deno.writeTextFile(`${serverPath}/instance_config.json`, JSON.stringify(cfg, null, 2));

    return { success: true, jarPath: targetFile };
  } catch (err: any) {
    return { success: false, jarPath: "", error: err.message || "Unknown download error" };
  }
}
