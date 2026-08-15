// Software Manager Module for Minecraft Wings Daemon
// Handles resolving and downloading server jars for different softwares and versions.

export interface SoftwareOption {
  id: string;
  name: string;
  description: string;
  recommendedVersion: string;
  supportedVersions: string[];
}

export const SUPPORTED_SOFTWARES: SoftwareOption[] = [
  {
    id: "paper",
    name: "PaperMC",
    description: "High-performance Spigot fork with bug fixes and plugin support.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
  },
  {
    id: "purpur",
    name: "Purpur",
    description: "Drop-in replacement for Paper with extensive gameplay configuration.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
  },
  {
    id: "vanilla",
    name: "Vanilla (Mojang)",
    description: "Official, unmodded Minecraft server software directly from Mojang.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2"],
  },
  {
    id: "fabric",
    name: "Fabric",
    description: "Lightweight, highly-modular mod loader with fast startup and low overhead.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
  },
  {
    id: "spigot",
    name: "Spigot",
    description: "Modified Minecraft server with Bukkit plugin compatibility.",
    recommendedVersion: "1.20.4",
    supportedVersions: ["1.21.4", "1.21.1", "1.20.4", "1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2"],
  },
];

export interface InstanceSoftwareConfig {
  software: string;
  version: string;
  jarFile: string;
  updatedAt?: number;
}

// Get current instance software config
export async function getInstanceSoftware(serverPath: string): Promise<InstanceSoftwareConfig> {
  try {
    const raw = await Deno.readTextFile(`${serverPath}/instance_config.json`);
    const cfg = JSON.parse(raw);
    return {
      software: cfg.software || "vanilla",
      version: cfg.version || "1.20.4",
      jarFile: cfg.jarFile || "server.jar",
      updatedAt: cfg.updatedAt,
    };
  } catch {}
  return {
    software: "vanilla",
    version: "1.20.4",
    jarFile: "server.jar",
  };
}

// Resolve download URL for specific software and version
export async function resolveJarDownloadUrl(software: string, version: string): Promise<string> {
  const normalizedSoftware = software.toLowerCase();

  switch (normalizedSoftware) {
    case "paper": {
      try {
        // Fetch latest build from PaperMC Fill v3 API
        const buildsRes = await fetch(
          `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`,
          {
            headers: {
              "User-Agent": "NetLink-MinecraftManager/1.0 (https://github.com/leonst036/NetLink)",
            },
          }
        );
        if (buildsRes.ok) {
          const buildsData = await buildsRes.json();
          if (Array.isArray(buildsData) && buildsData.length > 0) {
            const latestBuild = buildsData[0];
            const directUrl = latestBuild.downloads?.["server:default"]?.url;
            if (directUrl) return directUrl;
          }
        }
      } catch {}
      return "";
    }

    case "purpur": {
      return `https://api.purpurmc.org/v2/purpur/${version}/latest/download`;
    }

    case "fabric": {
      return `https://meta.fabricmc.net/v2/versions/loader/${version}/0.16.10/1.0.1/server/jar`;
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
  jarFile: string = "server.jar"
): Promise<{ success: boolean; jarPath: string; error?: string }> {
  try {
    const downloadUrl = await resolveJarDownloadUrl(software, version);
    if (!downloadUrl) {
      return { success: false, jarPath: "", error: `Could not resolve download URL for ${software} ${version}` };
    }

    const res = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "NetLink-MinecraftManager/1.0 (https://github.com/leonst036/NetLink)",
      },
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
    cfg.jarFile = jarFile;
    cfg.updatedAt = Date.now();

    await Deno.writeTextFile(`${serverPath}/instance_config.json`, JSON.stringify(cfg, null, 2));

    return { success: true, jarPath: targetFile };
  } catch (err: any) {
    return { success: false, jarPath: "", error: err.message || "Unknown download error" };
  }
}
