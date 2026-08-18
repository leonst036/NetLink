//config
const URL = "https://raw.githubusercontent.com/leonst036/NetStore/refs/heads/main/applications/applications.json"
const REMOTE_DEV_URL = "https://raw.githubusercontent.com/leonst036/NetStore/refs/heads/dev/applications/applications.json"
const LOCAL_DEV_URL = "http://localhost:4540/applications/applications.json"


export async function FetchApplicationCatalog(GithubToken: string | null, branch: string | null) {
    if (branch === "main") {
        try {
            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };
            if (GithubToken) {
                headers['Authorization'] = `Bearer ${GithubToken}`;
            }

            const res = await fetch(URL, {
                method: 'GET',
                headers,
            });

            if (res.status === 403) {
                console.log("Error while fetching application Catalog from GitHub: Forbidden (403)");
                return null;
            }

            if (!res.ok) {
                console.log(`Error while fetching application Catalog from GitHub: HTTP ${res.status}`);
                return null;
            }

            if (res.ok) {
                console.log("Fetched application list (main branch) from GitHub successfully")
            }

            return await res.json();
        } catch (e) {
            console.log("Error while fetching application Catalog from GitHub: " + e);
            return null;
        }
    } else if (branch === "dev") {
        try {
            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };
            if (GithubToken) {
                headers['Authorization'] = `Bearer ${GithubToken}`;
            }

            const res = await fetch(REMOTE_DEV_URL, {
                method: 'GET',
                headers,
            });

            if (res.status === 403) {
                console.log("Error while fetching application Catalog from GitHub: Forbidden (403)");
                return null;
            }

            if (!res.ok) {
                console.log(`Error while fetching application Catalog from GitHub: HTTP ${res.status}`);
                return null;
            }

            if (res.ok) {
                console.log("Fetched application list (dev branch) from GitHub successfully")
            }

            return await res.json();
        } catch (e) {
            console.log("Error while fetching application Catalog from GitHub: " + e);
            return null;
        }
    } else if (branch === "local-debug") {
        try {
            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };
            if (GithubToken) {
                headers['Authorization'] = `Bearer ${GithubToken}`;
            }

            const res = await fetch(LOCAL_DEV_URL, {
                method: 'GET',
                headers,
            });

            if (res.status === 403) {
                console.log("Error while fetching application Catalog from Localhost: Forbidden (403)");
                return null;
            }

            if (!res.ok) {
                console.log(`Error while fetching application Catalog from Localhost: HTTP ${res.status}`);
                return null;
            }

            return await res.json();
        } catch (e) {
            console.log("Error while fetching application Catalog from Localhost: " + e);
            return null;
        }
    } else {
        throw new Error("Invalid branch");
    }
} 