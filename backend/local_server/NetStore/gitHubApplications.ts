export function getGitHubHeaders(customToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': 'NetLink-LocalServer'
    };
    const token = customToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }
    return headers;
}

async function getGitHubApplicationsVersion(branch: string = 'NetStore', customToken?: string) {
    const url = `https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/${branch}/applications/version.json`;
    const response = await fetch(url, { headers: getGitHubHeaders(customToken) });
    if (!response.ok) {
        throw new Error(`Failed to fetch applications version for branch ${branch}`);
    }
    const applicationsVersion = await response.json();
    return applicationsVersion;
}

export async function getGitHubApplicationsList(branch: string = 'NetStore', customToken?: string) {
    const url = `https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/${branch}/applications/applications.json`;
    const response = await fetch(url, { headers: getGitHubHeaders(customToken) });
    if (!response.ok) {
        throw new Error(`Failed to fetch applications list for branch ${branch}`);
    }
    const applicationsList = await response.json();
    return applicationsList;
}

export async function checkNewApplications(branch: string = 'NetStore', customToken?: string) {
    try {
        const applicationsVersion = await getGitHubApplicationsVersion(branch, customToken);
        console.log(`GitHub Version (${branch}):`, applicationsVersion);

        const applicationsList = await getGitHubApplicationsList(branch, customToken);
        console.log(`GitHub Applications (${branch}):`, applicationsList);
        
        return applicationsList;
    } catch (error) {
        console.error(`Error checking new applications for branch ${branch}:`, error);
    }
}

