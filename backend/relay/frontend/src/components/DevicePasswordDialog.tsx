import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  TextField,
  Button,
  CircularProgress
} from "@mui/material";

interface DevicePasswordDialogProps {
  open: boolean;
  deviceName?: string;
  password: string;
  passwordError: string | null;
  submitting: boolean;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e?: React.FormEvent) => void;
}

export const DevicePasswordDialog: React.FC<DevicePasswordDialogProps> = ({
  open,
  deviceName,
  password,
  passwordError,
  submitting,
  onPasswordChange,
  onClose,
  onSubmit,
}) => {
  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "24px",
            background: "linear-gradient(135deg, #0b1329 0%, #1e1b4b 100%)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            p: 1,
            color: "#fff",
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)"
          }
        }
      }}
    >
      <form onSubmit={onSubmit}>
        <DialogTitle sx={{ pb: 1, color: "#fff", fontWeight: 600 }}>
          Confirm Authorization
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2 }}>
            Enter your account password to authorize <strong>{deviceName || "this device"}</strong>.
          </Typography>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: "12px" }}>
              {passwordError}
            </Alert>
          )}

          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Account Password"
            placeholder="Enter your password"
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
            sx={{
              "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.5)" },
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                borderRadius: "12px",
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                "&.Mui-focused fieldset": { borderColor: "#38bdf8" }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={onClose}
            disabled={submitting}
            sx={{ color: "rgba(255,255,255,0.7)", textTransform: "none", borderRadius: "20px" }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !password.trim()}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              background: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
              color: "#fff",
              fontWeight: 600,
              textTransform: "none",
              borderRadius: "20px",
              px: 2.5
            }}
          >
            {submitting ? "Authorizing..." : "Authorize"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
