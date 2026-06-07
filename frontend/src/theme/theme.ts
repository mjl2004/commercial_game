import { createTheme } from '@mui/material/styles';
import colors from './colors';

const base = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary,
      light: '#33dcff',
      dark: '#00a8cc',
      contrastText: '#0a0e1a',
    },
    secondary: {
      main: colors.accent,
      light: '#33ffb5',
      dark: '#00cc80',
      contrastText: '#0a0e1a',
    },
    error: { main: colors.danger },
    warning: { main: colors.warning },
    info: { main: colors.primary },
    success: { main: colors.successLow },
    background: {
      default: colors.bg.deep,
      paper: colors.bg.paper,
    },
    text: {
      primary: colors.textMain,
      secondary: colors.textSub,
      disabled: colors.muted,
    },
    divider: colors.border,
  },
  typography: {
    fontFamily: '"Noto Sans SC", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: { fontFamily: '"Orbitron", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: '"Orbitron", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: '"Orbitron", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontFamily: '"Orbitron", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontFamily: '"Orbitron", sans-serif', fontWeight: 500, letterSpacing: '-0.02em' },
    h6: { fontFamily: '"Orbitron", sans-serif', fontWeight: 500, letterSpacing: '-0.02em' },
    body1: { fontWeight: 400, lineHeight: 1.5, color: colors.textMain },
    body2: { fontWeight: 400, lineHeight: 1.5, color: colors.textSub },
    caption: { fontFamily: '"JetBrains Mono", "Roboto Mono", monospace', fontWeight: 400 },
    button: {
      fontFamily: '"Orbitron", sans-serif',
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'none',
    },
  },
  shape: { borderRadius: 4 },
});

export default createTheme(base, {
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: colors.bg.deep },
          '&::-webkit-scrollbar-thumb': { background: colors.border, borderRadius: '2px' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(13, 17, 28, 0.75)',
          border: `1px solid ${colors.border}`,
          boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,212,255,0.1)`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '2px',
          padding: '10px 24px',
          minHeight: 48,
          position: 'relative',
          overflow: 'hidden',
          clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            boxShadow: `0 0 16px ${colors.glowStrong}`,
            transform: 'translateY(-2px)',
          },
          '&:active': {
            transform: 'scale(0.95) translateY(2px)',
          },
          '&.MuiButton-containedPrimary': {
            background: `linear-gradient(180deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.05) 100%)`,
            border: `1px solid ${colors.borderHover}`,
            '&:hover': {
              background: `linear-gradient(180deg, rgba(0,212,255,0.25) 0%, rgba(0,212,255,0.1) 100%)`,
              boxShadow: `0 0 20px ${colors.glowStrong}`,
            },
          },
          '&.MuiButton-containedSecondary': {
            background: `linear-gradient(180deg, rgba(0,229,160,0.15) 0%, rgba(0,229,160,0.05) 100%)`,
            border: `1px solid rgba(0,229,160,0.4)`,
            '&:hover': {
              background: `linear-gradient(180deg, rgba(0,229,160,0.25) 0%, rgba(0,229,160,0.1) 100%)`,
              boxShadow: `0 0 20px rgba(0,229,160,0.3)`,
            },
          },
          '&.MuiButton-containedError': {
            background: `linear-gradient(180deg, rgba(255,43,109,0.15) 0%, rgba(255,43,109,0.05) 100%)`,
            border: `1px solid rgba(255,43,109,0.4)`,
            '&:hover': {
              background: `linear-gradient(180deg, rgba(255,43,109,0.25) 0%, rgba(255,43,109,0.1) 100%)`,
              boxShadow: `0 0 20px rgba(255,43,109,0.3)`,
            },
          },
          '&.MuiButton-outlinedPrimary': {
            borderColor: colors.borderHover,
            background: 'transparent',
            '&:hover': { borderColor: colors.primary, background: `${colors.primary}14` },
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: colors.border,
          color: colors.textSub,
          borderRadius: '2px',
          '&.Mui-selected': { color: colors.primary, background: `${colors.primary}1a` },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '2px',
          '& fieldset': { borderColor: colors.border },
          '&:hover fieldset': { borderColor: colors.borderHover },
          '&.Mui-focused fieldset': { borderColor: colors.primary },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(13, 17, 28, 0.9)',
          border: `1px solid ${colors.borderGlow}`,
          boxShadow: `0 8px 48px rgba(0,0,0,0.6), 0 0 24px ${colors.glow}`,
          borderRadius: '4px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: '2px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.04)' },
        bar: { borderRadius: '2px' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.bg.paper,
          border: `1px solid ${colors.border}`,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.72rem',
          borderRadius: '2px',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '2px',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(0,212,255,0.08)',
            boxShadow: `0 0 8px ${colors.glow}`,
          },
        },
      },
    },
  },
});
