import { Box, Typography, keyframes } from '@mui/material';
import colors from '../theme/colors';

const spinClock = keyframes`
  100% { transform: rotate(360deg); }
`;

const spinCounter = keyframes`
  100% { transform: rotate(-360deg); }
`;

interface Props {
  text?: string;
  size?: number;
}

export default function LoadingSpinner({ text = '正在连接贸易网络...', size = 56 }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            border: `2px solid ${colors.primary}`,
            borderRadius: '2px',
            animation: `${spinClock} 2s linear infinite`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: size * 0.18,
            border: `2px solid ${colors.accent}`,
            borderRadius: 0.5,
            animation: `${spinCounter} 1.6s linear infinite`,
          }}
        />
      </Box>
      <Typography
        sx={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: colors.textSub,
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}
