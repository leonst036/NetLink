import React from 'react';

export default function EmptyState() {
    return (
        <div className="dm-empty-container">
            <img src="/apps/docker-manager/frontend/assets/empty.svg" alt="Empty" className="dm-empty-icon" />
            <h3 className="dm-empty-title">No Containers Found</h3>
            <p className="dm-empty-sub">There are currently no active or stopped Docker containers on this host machine.</p>
        </div>
    );
}

