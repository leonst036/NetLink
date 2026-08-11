import React from 'react';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    loading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export default function ConfirmModal({
    title,
    message,
    confirmText = 'Delete',
    confirmVariant = 'danger',
    loading = false,
    onConfirm,
    onClose
}: ConfirmModalProps) {
    const btnClass = confirmVariant === 'danger' ? 'dm-btn-danger' : confirmVariant === 'primary' ? 'dm-btn-primary' : 'dm-btn-secondary';

    return (
        <div className="dm-modal-overlay" onClick={onClose}>
            <div className="dm-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <h3 className="dm-modal-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--dm-amber)" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>{title}</span>
                    </h3>
                    <button className="dm-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="dm-modal-body">
                    <p style={{ margin: 0, color: 'var(--dm-text-body)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                        {message}
                    </p>
                </div>
                <div className="dm-modal-footer">
                    <button 
                        type="button" 
                        className="dm-btn dm-btn-secondary" 
                        onClick={onClose} 
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className={`dm-btn ${btnClass}`} 
                        onClick={onConfirm} 
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
