import { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import GeminiLoader from './GeminiLoader';

interface DynamicAppLoaderProps {
  appId: string;
  token: string;
  target: string;
  extraParams?: Record<string, string>;
  isBuiltIn?: boolean;
}

export default function DynamicAppLoader({ appId, token, target, extraParams = {} }: DynamicAppLoaderProps) {
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    let isMounted = true;

    // Fetch a single-use ticket
    fetch(`/api/auth/ticket?target=${encodeURIComponent(target)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to get auth ticket');
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          if (data.success && data.ticket) {
            setTicket(data.ticket);
          } else {
            setError('No ticket returned');
          }
        }
      })
      .catch(err => {
        if (isMounted) setError(err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [token, target]);

  // Fallback timeout to dismiss loader if iframe load event is delayed
  useEffect(() => {
    if (ticket) {
      const timer = setTimeout(() => {
        setIframeLoading(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [ticket]);

  const handleIframeLoad = () => {
    const elapsed = Date.now() - mountTimeRef.current;
    const minDisplayTime = 400;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    setTimeout(() => {
      setIframeLoading(false);
    }, remainingTime);
  };

  if (error) {
    return <Box sx={{ p: 2, color: 'error.main' }}>Failed to load app: {error}</Box>;
  }

  const isSecure = window.location.protocol === 'https:';
  const protocol = isSecure ? 'https:' : 'http:';
  let host = window.location.host;
  if (import.meta.env.DEV || host.includes('localhost:5173')) host = import.meta.env.VITE_RELAY_HOST || 'localhost:4535';

  const searchParams = new URLSearchParams();
  if (ticket) {
    searchParams.set('ticket', ticket);
  }
  searchParams.set('target', target);

  let userId = 'unknown';
  try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const decoded = JSON.parse(jsonPayload);
      if (decoded.role) searchParams.set('role', decoded.role);
      if (decoded.permissions) searchParams.set('permissions', decoded.permissions.join(','));
      userId = decoded.userId || decoded.username || decoded.sub || 'unknown';
  } catch (e) {
      console.warn('Failed to decode token in DynamicAppLoader', e);
  }

  Object.entries(extraParams).forEach(([k, v]) => {
    if (v) searchParams.set(k, v);
  });

  const entrypoint = extraParams.entrypoint || 'frontend/dist/index.html';

  // All apps are now served through the NetStore /apps/ routes, which handle asset path rewriting properly.
  const srcUrl = ticket ? `${protocol}//${host}/apps/${userId}/${appId}/${entrypoint}?${searchParams.toString()}` : '';
  const showLoader = !ticket || iframeLoading;

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', background: 'transparent', overflow: 'hidden' }}>
      {showLoader && (
        <Box 
          className="loader-wrapper"
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.paper',
            transition: 'opacity 0.3s ease',
          }}
        >
          <GeminiLoader size={48} />
        </Box>
      )}

      {ticket && (
        <iframe 
          src={srcUrl}
          onLoad={handleIframeLoad}
          style={{ 
            width: '100%', 
            height: '100%', 
            border: 'none',
            opacity: showLoader ? 0 : 1,
            transition: 'opacity 0.3s ease'
          }}
          title={`App ${appId}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      )}
    </Box>
  );
}
