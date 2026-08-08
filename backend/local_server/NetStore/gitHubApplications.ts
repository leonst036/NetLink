async function getGitHubApplicationsVersion() {
    const url = "https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/NetStore/applications/version.json";
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch applications version");
    }
    const applicationsVersion = await response.json();
    return applicationsVersion;
}

export async function getGitHubApplicationsList() {
    const url = "https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/NetStore/applications/applications.json";
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch applications list");
    }
    const applicationsList = await response.json();
    return applicationsList;
}

export async function checkNewApplications() {
    try {
        const applicationsVersion = await getGitHubApplicationsVersion();
        console.log("GitHub Version:", applicationsVersion);

        const applicationsList = await getGitHubApplicationsList();
        console.log("GitHub Applications:", applicationsList);
        
        return applicationsList;
    } catch (error) {
        console.error("Error checking new applications:", error);
    }
}

// checkNewApplications(); // Typically exported and called from elsewhere
