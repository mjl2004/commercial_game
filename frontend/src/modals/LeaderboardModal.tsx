import { Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon, Leaderboard as LeaderboardIcon } from '@mui/icons-material';
import type { LeaderboardEntry } from '../api/authApi';
import colors from '../theme/colors';

interface Props {
  open: boolean;
  entries: LeaderboardEntry[];
  onClose: () => void;
}

export default function LeaderboardModal({ open, entries, onClose }: Props) {
  if (!open) return null;

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Box
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        sx={{
          width: 720,
          maxWidth: '94vw',
          maxHeight: '88vh',
          overflow: 'hidden',
          bgcolor: 'rgba(13,17,28,0.96)',
          borderRadius: '4px',
          border: `1px solid ${colors.borderGlow}`,
          boxShadow: `0 0 40px ${colors.glowStrong}, 0 8px 48px rgba(0,0,0,0.55)`,
          animation: 'fadeIn 0.25s ease both',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 3,
            py: 1.75,
            borderBottom: `1px solid ${colors.border}`,
            background: 'rgba(13,17,28,0.4)',
          }}
        >
          <LeaderboardIcon sx={{ color: colors.primary, fontSize: 22 }} />
          <Typography
            sx={{
              flex: 1,
              fontFamily: 'var(--font-heading)',
              fontSize: '1rem',
              color: colors.textMain,
              letterSpacing: '0.04em',
            }}
          >
            银河排行榜 TOP 10
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: colors.textSub }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, py: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '72px 1.4fr 1.2fr 1fr 1.2fr',
              gap: 1,
              px: 1.5,
              py: 1,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            {['排名', '昵称', '账号', '最高分', '更新时间'].map((label) => (
              <Typography
                key={label}
                sx={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: colors.primary,
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </Typography>
            ))}
          </Box>

          {entries.length === 0 ? (
            <Box
              sx={{
                py: 8,
                textAlign: 'center',
                color: colors.muted,
              }}
            >
              <Typography sx={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: colors.textSub, mb: 1 }}>
                暂无排行榜记录
              </Typography>
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                完成一局结算后，这里会显示历史最高分前十名。
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {entries.map((entry, index) => (
                <Box
                  key={entry.accountId}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '72px 1.4fr 1.2fr 1fr 1.2fr',
                    gap: 1,
                    px: 1.5,
                    py: 1.25,
                    borderBottom: `1px solid ${colors.border}22`,
                    bgcolor: index % 2 === 0 ? 'rgba(0,212,255,0.03)' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Typography sx={{ fontFamily: 'var(--font-mono)', color: entry.rank <= 3 ? colors.warning : colors.textSub, fontWeight: 700 }}>
                    #{entry.rank}
                  </Typography>
                  <Typography sx={{ color: colors.textMain, fontWeight: 600 }}>
                    {entry.nickname}
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', color: colors.textSub, fontSize: '0.72rem' }}>
                    {entry.emailMasked}
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', color: colors.accent, fontWeight: 700 }}>
                    {entry.bestScore.toLocaleString()}
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', color: colors.muted, fontSize: '0.68rem' }}>
                    {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '-'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
