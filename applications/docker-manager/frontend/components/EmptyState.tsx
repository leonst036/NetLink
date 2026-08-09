import React from 'react';

export default function EmptyState() {
    return (
        <div className="nl-panel dm-empty">
            <img src="/apps/docker-manager/frontend/assets/empty.svg" alt="Empty" width="48" height="48" />
            <h3>No Containers Found</h3>
            <p>No active or stopped Docker containers on this host.</p>
        </div>
    );
}
