import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  TextField,
} from '@mui/material';
import { Send, Trash2 } from 'lucide-react';

interface ConsoleTabProps {
  logs: string[];
  onClearLogs: () => void;
  onSendCommand: (cmd: string) => void;
}

export const ConsoleTab: React.FC<ConsoleTabProps> = ({
  logs,
  onClearLogs,
  onSendCommand,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const logBoxRef = useRef<HTMLDivElement>(null);

  // Auto scroll inner container only without affecting window/iframe scroll
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    onSendCommand(commandInput.trim());
    setCommandInput('');
  };

  return (
    <Card
      sx={{
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#f8fafc' }}>
            Wings Process Console
          </Typography>
          <Button
            size="small"
            startIcon={<Trash2 size={14} />}
            onClick={onClearLogs}
            sx={{ color: '#94a3b8' }}
          >
            Clear View
          </Button>
        </Stack>

        {/* Live Output Box */}
        <Box
          ref={logBoxRef}
          sx={{
            height: 380,
            backgroundColor: '#030712',
            borderRadius: 2,
            p: 2,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {logs.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#475569', fontStyle: 'italic' }}>
              Waiting for Wings server process output...
            </Typography>
          ) : (
            logs.map((log, i) => (
              <Typography key={i} variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.5 }}>
                {log}
              </Typography>
            ))
          )}
        </Box>

        {/* Stdin Command Input Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, display: 'flex', gap: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type command into server stdin..."
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!commandInput.trim()}
            startIcon={<Send size={16} />}
            sx={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              px: 3,
              borderRadius: 2,
              '&:hover': { backgroundColor: '#059669' },
            }}
          >
            Send
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
