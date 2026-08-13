export const fetchServers = async (target: string) => {
    const res = await fetch(`/api/servers?target=${encodeURIComponent(target)}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.devices || []);
};
