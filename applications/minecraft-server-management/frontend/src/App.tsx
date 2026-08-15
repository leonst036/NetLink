import { Box, Typography, Card, CardContent, Stack, Chip, Button } from '@mui/material';
import { WindowLayout } from '@netlink/ui';
import { Gamepad2, Server, Terminal, Play, RefreshCw } from 'lucide-react';

export default function App() {

  return (
    <WindowLayout>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          p: 3,
        }}
      >
        <Card
          sx={{
            maxWidth: 600,
            width: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            textAlign: 'center',
            p: 4,
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          }}
        >
          <CardContent>
            <Box
              sx={{
                display: 'inline-flex',
                p: 2.5,
                borderRadius: '50%',
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                mb: 2.5,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <Gamepad2 size={44} />
            </Box>

            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: '#10b981',
                mb: 1,
                letterSpacing: '-0.025em',
              }}
            >
              Minecraft Server Management
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: '#94a3b8',
                mb: 3,
                fontSize: '1rem',
              }}
            >
              Monitor, configure, and control your Minecraft servers across the network.
            </Typography>

            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 3 }}>
              <Chip
                icon={<Server size={14} />}
                label="Server Engine Ready"
                size="small"
                sx={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              />
              <Chip
                icon={<Terminal size={14} />}
                label="CLI Access"
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              />
            </Stack>

            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<Play size={16} />}
                sx={{
                  bgcolor: '#10b981',
                  '&:hover': { bgcolor: '#059669' },
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  borderRadius: 2,
                }}
              >
                Launch Instance
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshCw size={16} />}
                sx={{
                  color: '#94a3b8',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2,
                }}
              >
                Scan Servers
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </WindowLayout>
  );
}
