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
    return (
        <div className="dm-modal-backdrop" onClick={onClose}>
            <div className="dm-modal dm-modal-md" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <h3>⚠️ {title}</h3>
                    <button className="dm-modal-close" onClick={onClose}>×</button>
                </div>
                <div className="dm-modal-body">
                    <p style={{ margin: 0, color: 'var(--dm-text-main)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                        {message}
                    </p>
                </div>
                <div className="dm-modal-footer">
                    <button 
                        type="button" 
                        className="nl-button secondary" 
                        onClick={onClose} 
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className={`nl-button ${confirmVariant}`} 
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
