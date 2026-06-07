import { Box, Typography, Button } from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Leaderboard as RankIcon,
  ExitToApp as ExitIcon,
} from '@mui/icons-material';
import colors from '../theme/colors';

interface Props {
  playerName: string;
  onStartGame: () => void;
  onShowLeaderboard: () => void;
  onLogout: () => void;
}

export default function LobbyScreen({
  playerName,
  onStartGame,
  onShowLeaderboard,
  onLogout,
}: Props) {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(ellipse at 50% 30%, ${colors.bg.paper} 0%, ${colors.bg.deep} 80%)`,
        gap: 5,
      }}
    >
      {/* glowing orb background */}
      <Box
        sx={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.glowStrong} 0%, transparent 70%)`,
          animation: 'glowPulse 4s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <Typography
        sx={{
          fontFamily: 'var(--font-heading)',
          fontSize: '2.2rem',
          color: colors.white,
          animation: 'fadeIn 0.6s ease',
          position: 'relative',
          zIndex: 1,
          textShadow: `0 0 24px ${colors.glowStrong}, 0 0 48px ${colors.glow}`,
          letterSpacing: '0.04em',
        }}
      >
        星际货运垄断者
      </Typography>

      <Typography
        sx={{
          color: colors.textSub,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          animation: 'fadeIn 0.6s ease 0.2s both',
        }}
      >
        {playerName}，欢迎回来
      </Typography>

      <Box sx={{ width: 300, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, animation: 'fadeIn 0.6s ease 0.4s both' }}>
        <Button
          variant="contained"
          startIcon={<PlayIcon />}
          onClick={onStartGame}
          className="tech-button"
          sx={{
            py: 1.75,
            fontSize: '0.95rem',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.05em',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
            background: 'linear-gradient(180deg, rgba(0,212,255,0.18) 0%, rgba(0,212,255,0.06) 100%)',
            border: `1px solid ${colors.borderHover}`,
            color: colors.white,
            '&:hover': { boxShadow: `0 0 20px ${colors.glowStrong}` },
          }}
        >
          开始游戏
        </Button>

        <Button
          variant="outlined"
          startIcon={<RankIcon />}
          onClick={onShowLeaderboard}
          className="tech-button"
          sx={{
            py: 1.75,
            fontSize: '0.85rem',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.05em',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
            borderColor: colors.border,
            color: colors.textSub,
            '&:hover': { borderColor: colors.primary, color: colors.primary, bgcolor: 'rgba(0,212,255,0.04)' },
          }}
        >
          排行榜
        </Button>

        <Button
          variant="text"
          startIcon={<ExitIcon />}
          onClick={onLogout}
          sx={{
            py: 1.5,
            fontSize: '0.8rem',
            fontFamily: 'var(--font-heading)',
            color: colors.muted,
            '&:hover': { color: colors.dangerHigh },
          }}
        >
          退出
        </Button>
      </Box>
    </Box>
  );
}
