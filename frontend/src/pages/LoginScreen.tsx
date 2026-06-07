import { useMemo, useState } from 'react';
import { Alert, Box, Button, LinearProgress, Tab, Tabs, TextField, Typography } from '@mui/material';
import type { AccountRecord, LoginPayload, RegisterPayload } from '../api/authApi';
import colors from '../theme/colors';

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: `${((i * 37 + 13) % 100)}%`,
  top: `${((i * 53 + 7) % 100)}%`,
  size: 2 + (i % 2),
  opacity: 0.12 + (i % 5) * 0.04,
  duration: 3 + (i % 4),
  delay: (i % 3) * 0.8,
}));

type AuthMode = 'login' | 'register';
type PasswordStrength = 'weak' | 'medium' | 'strong';

interface Props {
  onLogin: (payload: LoginPayload) => Promise<{ ok: boolean; message?: string; account?: AccountRecord }>;
  onRegister: (payload: RegisterPayload) => Promise<{ ok: boolean; message?: string; account?: AccountRecord }>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email.trim());
}

function getPasswordStrength(password: string): PasswordStrength {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const typeCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length < 8 || typeCount <= 1) return 'weak';
  if (password.length >= 10 && typeCount >= 3) return 'strong';
  return 'medium';
}

function strengthMeta(strength: PasswordStrength) {
  if (strength === 'strong') return { label: '强', color: colors.accent, value: 100 };
  if (strength === 'medium') return { label: '中', color: colors.warning, value: 66 };
  return { label: '弱', color: colors.dangerHigh, value: 33 };
}

export default function LoginScreen({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordStrengthView = strengthMeta(passwordStrength);
  const emailValid = isValidEmail(email);
  const nicknameValid = nickname.trim().length >= 2;

  const canLogin = emailValid && password.trim().length > 0 && !submitting;
  const canRegister = emailValid && nicknameValid && passwordStrength !== 'weak' && !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const result = await onLogin({ email, password });
        if (!result.ok) {
          setFeedback({ type: 'error', message: result.message ?? '登录失败，请重试。' });
          return;
        }
        setFeedback({ type: 'success', message: '登录成功，正在进入大厅...' });
        return;
      }

      const result = await onRegister({
        email,
        password,
        nickname,
      });
      if (!result.ok) {
        setFeedback({ type: 'error', message: result.message ?? '注册失败，请重试。' });
        return;
      }
      setFeedback({ type: 'success', message: '注册成功，已自动登录。' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(ellipse at 50% 50%, ${colors.bg.paper} 0%, ${colors.bg.deep} 70%)`,
        gap: 4,
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {PARTICLES.map((p) => (
          <Box
            key={p.id}
            sx={{
              position: 'absolute',
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              bgcolor: colors.primary,
              opacity: p.opacity,
              left: p.left,
              top: p.top,
              animation: `float ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </Box>

      <Typography
        sx={{
          fontFamily: 'var(--font-heading)',
          fontSize: '2.5rem',
          color: colors.white,
          textAlign: 'center',
          animation: 'fadeIn 0.8s ease',
          textShadow: `0 0 24px ${colors.glowStrong}, 0 0 48px ${colors.glow}`,
          letterSpacing: '0.04em',
        }}
      >
        星际货运垄断者
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubmit}
        className="glass-panel"
        sx={{
          width: 420,
          maxWidth: '92vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 3,
          borderRadius: '4px',
          animation: 'fadeIn 0.8s ease 0.3s both',
        }}
      >
        <Tabs
          value={mode}
          onChange={(_, next) => {
            setMode(next);
            setFeedback(null);
          }}
          sx={{
            minHeight: 38,
            '& .MuiTabs-indicator': { bgcolor: colors.primary, height: 2 },
            '& .MuiTab-root': {
              minHeight: 38,
              color: colors.textSub,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.04em',
              '&.Mui-selected': { color: colors.primary },
            },
          }}
        >
          <Tab value="login" label="账号登录" />
          <Tab value="register" label="注册账号" />
        </Tabs>

        <Typography sx={{ fontSize: '0.82rem', color: colors.textSub, textAlign: 'center' }}>
          {mode === 'login' ? '使用邮箱和密码登录，继续你的星际贸易事业。' : '注册新账号后，将自动进入大厅。'}
        </Typography>

        {feedback && (
          <Alert
            severity={feedback.type}
            sx={{
              borderRadius: '2px',
              bgcolor: feedback.type === 'error' ? 'rgba(255,71,87,0.1)' : 'rgba(5,255,161,0.1)',
              color: colors.textMain,
              '& .MuiAlert-icon': { color: feedback.type === 'error' ? colors.dangerHigh : colors.accent },
            }}
          >
            {feedback.message}
          </Alert>
        )}

        <TextField
          label="邮箱"
          placeholder="pilot@galaxy.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus
          fullWidth
          error={email.length > 0 && !emailValid}
          helperText={email.length > 0 && !emailValid ? '请输入标准邮箱格式。' : ' '}
          slotProps={{
            htmlInput: {
              style: { fontFamily: 'var(--font-mono)', color: colors.textMain },
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '2px',
              '& fieldset': { borderColor: colors.border },
              '&:hover fieldset': { borderColor: colors.borderHover },
              '&.Mui-focused fieldset': { borderColor: colors.primary },
            },
          }}
        />

        {mode === 'register' && (
          <TextField
            label="游戏昵称"
            placeholder="请输入你的贸易代号"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            fullWidth
            error={nickname.length > 0 && !nicknameValid}
            helperText={nickname.length > 0 && !nicknameValid ? '昵称至少需要 2 个字符。' : ' '}
            slotProps={{
              htmlInput: {
                maxLength: 16,
                style: { fontFamily: 'var(--font-mono)', color: colors.textMain },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '2px',
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.borderHover },
                '&.Mui-focused fieldset': { borderColor: colors.primary },
              },
            }}
          />
        )}

        <TextField
          label="密码"
          type="password"
          placeholder={mode === 'login' ? '请输入密码' : '请输入注册密码'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          fullWidth
          slotProps={{
            htmlInput: {
              style: { fontFamily: 'var(--font-mono)', color: colors.textMain },
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '2px',
              '& fieldset': { borderColor: colors.border },
              '&:hover fieldset': { borderColor: colors.borderHover },
              '&.Mui-focused fieldset': { borderColor: colors.primary },
            },
          }}
        />

        {mode === 'register' && (
          <Box sx={{ mt: -0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: colors.textSub }}>
                密码强度
              </Typography>
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: passwordStrengthView.color, fontWeight: 700 }}>
                {passwordStrengthView.label}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={password.length === 0 ? 0 : passwordStrengthView.value}
              sx={{
                height: 6,
                borderRadius: '4px',
                bgcolor: 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: '4px',
                  bgcolor: passwordStrengthView.color,
                },
              }}
            />
            <Typography sx={{ mt: 0.75, fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: colors.textSub, lineHeight: 1.5 }}>
              弱：少于 8 位或字符类型单一。中：至少 8 位且包含 2 类字符。强：至少 10 位且包含 3 类以上字符。
            </Typography>
            {password.length > 0 && passwordStrength === 'weak' && (
              <Typography sx={{ mt: 0.75, fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: colors.dangerHigh }}>
                弱密码不允许注册，请提升密码复杂度。
              </Typography>
            )}
          </Box>
        )}

        <Button
          type="submit"
          variant="contained"
          disabled={mode === 'login' ? !canLogin : !canRegister}
          className="tech-button"
          sx={{
            py: 1.5,
            fontSize: '0.9rem',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.05em',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
            background: 'linear-gradient(180deg, rgba(0,212,255,0.18) 0%, rgba(0,212,255,0.06) 100%)',
            border: `1px solid ${colors.borderHover}`,
            color: colors.white,
            '&:hover': { boxShadow: `0 0 20px ${colors.glowStrong}` },
            '&.Mui-disabled': { opacity: 0.35, color: colors.muted },
          }}
        >
          {submitting ? '处理中...' : mode === 'login' ? '进入大厅' : '注册并登录'}
        </Button>
      </Box>

      <Typography sx={{ color: colors.muted, fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
        openGauss 课程大作业 · 2026
      </Typography>
    </Box>
  );
}
