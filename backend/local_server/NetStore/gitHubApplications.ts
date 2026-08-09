async function getGitHubApplicationsVersion(branch: string = 'NetStore') {
    const url = `https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/${branch}/applications/version.json`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch applications version for branch ${branch}`);
    }
    const applicationsVersion = await response.json();
    return applicationsVersion;
}

export async function getGitHubApplicationsList(branch: string = 'NetStore') {
    const url = `https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/${branch}/applications/applications.json`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch applications list for branch ${branch}`);
    }
    const applicationsList = await response.json();
    return applicationsList;
}

export async function checkNewApplications(branch: string = 'NetStore') {
    try {
        const applicationsVersion = await getGitHubApplicationsVersion(branch);
        console.log(`GitHub Version (${branch}):`, applicationsVersion);

        const applicationsList = await getGitHubApplicationsList(branch);
        console.log(`GitHub Applications (${branch}):`, applicationsList);
        
        return applicationsList;
    } catch (error) {
        console.error(`Error checking new applications for branch ${branch}:`, error);
    }
}
