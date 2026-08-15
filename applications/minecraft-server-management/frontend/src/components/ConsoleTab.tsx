import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  TextField,
  Chip,
} from '@mui/material';
import { Send, Trash2, Terminal as TerminalIcon } from 'lucide-react';

interface ConsoleTabProps {
  logs: string[];
  onClearLogs: () => void;
  onSendCommand: (cmd: string) => void;
}

// Minecraft section sign (§) color map
const MC_COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#0000aa',
  '2': '#00aa00',
  '3': '#00aaaa',
  '4': '#aa0000',
  '5': '#aa00aa',
  '6': '#ffaa00',
  '7': '#aaaaaa',
  '8': '#555555',
  '9': '#5555ff',
  'a': '#55ff55',
  'b': '#55ffff',
  'c': '#ff5555',
  'd': '#ff55ff',
  'e': '#ffff55',
  'f': '#ffffff',
};

// Render colored Minecraft/server log line
function renderLogLine(line: string, index: number): React.ReactNode {
  // 1. User stdin command
  if (line.startsWith('>')) {
    return (
      <Box
        key={index}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: '#34d399',
          fontWeight: 600,
          py: 0.2,
        }}
      >
        <span style={{ color: '#10b981' }}>&gt;</span>
        <span>{line.substring(1).trim()}</span>
      </Box>
    );
  }

  // 2. Wings Daemon system logs
  if (line.startsWith('[Wings]')) {
    return (
      <Box key={index} sx={{ color: '#c084fc', py: 0.2, fontWeight: 500 }}>
        <span style={{ color: '#a855f7', fontWeight: 700 }}>[Wings]</span>
        <span>{line.substring(7)}</span>
      </Box>
    );
  }

  // 3. Stderr & Warnings / Errors
  if (line.startsWith('[STDERR]') || line.includes('ERROR') || line.includes('Exception') || line.includes('FATAL')) {
    return (
      <Box
        key={index}
        sx={{
          color: '#f87171',
          py: 0.2,
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          px: 0.5,
          borderRadius: 0.5,
        }}
      >
        {line}
      </Box>
    );
  }

  if (line.includes('WARN') || line.includes('WARNING')) {
    return (
      <Box key={index} sx={{ color: '#fbbf24', py: 0.2 }}>
        {line}
      </Box>
    );
  }

  // 4. Server Done / Ready message
  if (line.includes('Done (') && line.includes(')!')) {
    return (
      <Box
        key={index}
        sx={{
          color: '#4ade80',
          fontWeight: 700,
          py: 0.3,
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          px: 0.5,
          borderRadius: 0.5,
        }}
      >
        {line}
      </Box>
    );
  }

  // 5. Standard Minecraft timestamp format: [HH:MM:SS] [Thread/LEVEL]: Message
  const logMatch = line.match(/^(\[\d{2}:\d{2}:\d{2}\])\s+(\[[^\]]+\]):\s*(.*)$/);
  if (logMatch) {
    const [, timestamp, tag, message] = logMatch;
    const isInfo = tag.includes('INFO');
    const isWarn = tag.includes('WARN');
    const isError = tag.includes('ERROR');

    const tagColor = isError ? '#f87171' : isWarn ? '#fbbf24' : isInfo ? '#38bdf8' : '#94a3b8';
    const messageColor = isError ? '#fca5a5' : isWarn ? '#fde68a' : '#e2e8f0';

    return (
      <Box key={index} sx={{ py: 0.15, lineHeight: 1.5 }}>
        <span style={{ color: '#64748b', marginRight: 8 }}>{timestamp}</span>
        <span style={{ color: tagColor, fontWeight: 600, marginRight: 8 }}>{tag}:</span>
        <span style={{ color: messageColor }}>{message}</span>
      </Box>
    );
  }

  // 6. Section sign § formatting fallback
  if (line.includes('§')) {
    const parts = line.split(/(§[0-9a-fklmnor])/g);
    let currentColor = '#cbd5e1';
    let isBold = false;

    return (
      <Box key={index} sx={{ py: 0.15 }}>
        {parts.map((part, pIdx) => {
          if (part.startsWith('§')) {
            const code = part[1].toLowerCase();
            if (MC_COLORS[code]) {
              currentColor = MC_COLORS[code];
            } else if (code === 'l') {
              isBold = true;
            } else if (code === 'r') {
              currentColor = '#cbd5e1';
              isBold = false;
            }
            return null;
          }
          return (
            <span key={pIdx} style={{ color: currentColor, fontWeight: isBold ? 700 : 400 }}>
              {part}
            </span>
          );
        })}
      </Box>
    );
  }

  // Default Line
  return (
    <Box key={index} sx={{ color: '#cbd5e1', py: 0.15 }}>
      {line}
    </Box>
  );
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
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TerminalIcon size={18} color="#10b981" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#f8fafc' }}>
              Wings Process Console
            </Typography>
            <Chip
              size="small"
              label={`${logs.length} lines`}
              sx={{
                height: 20,
                fontSize: '0.7rem',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
              }}
            />
          </Stack>

          <Button
            size="small"
            startIcon={<Trash2 size={14} />}
            onClick={onClearLogs}
            sx={{ color: '#94a3b8' }}
          >
            Clear View
          </Button>
        </Stack>

        {/* Live Colored Output Box */}
        <Box
          ref={logBoxRef}
          sx={{
            minHeight: 420,
            height: 'calc(100vh - 420px)',
            maxHeight: 750,
            backgroundColor: '#030712',

            borderRadius: 2,
            p: 2,
            overflowY: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.85rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {logs.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#475569', fontStyle: 'italic' }}>
              Waiting for Wings server process output...
            </Typography>
          ) : (
            logs.map((log, i) => renderLogLine(log, i))
          )}
        </Box>

        {/* Stdin Command Input Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, display: 'flex', gap: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type command into server stdin (e.g. op Player, gamemode creative, time set day)..."
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
