import { useState, useEffect } from 'react';
import { Box, Typography, Button, Zoom } from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Cancel as FailIcon,
} from '@mui/icons-material';
import colors from '../theme/colors';
import { ASSET_PATHS } from '../theme/assets';

/* ---- types ---- */
export interface EncounterChoice {
  choiceId: number;
  text: string;
  consequenceHint: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface EncounterResult {
  success: boolean;
  message: string;
}

export interface EncounterModalProps {
  open: boolean;
  title: string;
  description: string;
  choices: EncounterChoice[];
  result?: EncounterResult | null;
  onChoose: (choiceId: number) => void;
  onConfirmResult: () => void;
}

/* scanline bar component */
function ScanlineBar({ color = colors.danger }: { color?: string }) {
  return (
    <Box
      sx={{
        height: 2,
        background: `repeating-linear-gradient(90deg, transparent, transparent 8px, ${color}22 8px, ${color}22 9px)`,
        animation: 'scanLine 2s linear infinite',
      }}
    />
  );
}

export default function EncounterModal({
  open,
  title,
  description,
  choices,
  result,
  onChoose,
  onConfirmResult,
}: EncounterModalProps) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    queueMicrotask(() => {
      if (open) {
        setVisible(true);
        setClosing(false);
      } else if (visible) {
        setClosing(true);
        t = setTimeout(() => setVisible(false), 300);
      }
    });
    return () => clearTimeout(t);
  }, [open, visible]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 21,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        animation: closing ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.3s ease both',
        '@keyframes fadeOut': { to: { opacity: 0 } },
      }}
    >
      <Box
        className="modal-panel"
        sx={{
          width: 600,
          maxWidth: '92vw',
          maxHeight: '86vh',
          overflow: 'auto',
          bgcolor: 'rgba(13,17,28,0.96)',
          borderRadius: '4px',
          border: `1px solid ${colors.danger}44`,
          boxShadow: `0 0 40px ${colors.danger}22, 0 8px 48px rgba(0,0,0,0.5)`,
          animation: closing ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.3s ease both',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* top scanline */}
        <ScanlineBar />

        {/* abstract header background */}
        <Box
          sx={{
            position: 'relative',
            height: 120,
            background: `linear-gradient(135deg, rgba(255,43,109,0.08) 0%, rgba(10,14,26,0.5) 50%, rgba(0,212,255,0.05) 100%)`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* decorative circles */}
          <Box
            sx={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              border: `1px solid ${colors.danger}15`,
              top: -60,
              right: -40,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: `1px solid ${colors.primary}15`,
              bottom: -40,
              left: 20,
            }}
          />

          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${colors.danger}15`,
              border: `2px solid ${colors.danger}55`,
              zIndex: 1,
              boxShadow: `0 0 20px ${colors.danger}22`,
            }}
          >
            <Box component="img" src={ASSET_PATHS.icons.eventEncounter} alt="" sx={{ width: 28, height: 28 }} />
          </Box>
        </Box>

        {/* header */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, textAlign: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              color: colors.danger,
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-heading)',
              fontSize: '0.7rem',
              display: 'block',
              mb: 0.5,
            }}
          >
            ENCOUNTER
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.2rem',
              color: colors.textMain,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* body */}
        <Box sx={{ px: 3, pb: 2.5, flex: 1 }}>
          {result ? (
            <Zoom in>
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ mb: 2 }}>
                  {result.success ? (
                    <SuccessIcon sx={{ fontSize: 56, color: colors.successLow, filter: `drop-shadow(0 0 12px ${colors.successLow}44)` }} />
                  ) : (
                    <FailIcon sx={{ fontSize: 56, color: colors.dangerHigh, filter: `drop-shadow(0 0 12px ${colors.dangerHigh}44)` }} />
                  )}
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    color: result.success ? colors.successLow : colors.dangerHigh,
                    mb: 3,
                    fontSize: '1rem',
                    fontWeight: 500,
                  }}
                >
                  {result.message}
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onConfirmResult}
                  sx={{
                    px: 5,
                    py: 1,
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                  }}
                >
                  确认
                </Button>
              </Box>
            </Zoom>
          ) : (
            <>
              <Typography
                variant="body2"
                sx={{
                  color: colors.textSub,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                  mb: 2.5,
                  fontSize: '0.9rem',
                }}
              >
                {description}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {choices.map((c, i) => (
                  <Button
                    key={c.choiceId}
                    variant="outlined"
                    fullWidth
                    disabled={c.disabled}
                    onClick={() => onChoose(c.choiceId)}
                    sx={{
                      py: 1.5,
                      px: 2.5,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      borderColor: c.disabled ? `${colors.muted}22` : colors.border,
                      borderRadius: '2px',
                      opacity: c.disabled ? 0.4 : 1,
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                      '&:hover': !c.disabled
                        ? {
                            borderColor: colors.primary,
                            bgcolor: `${colors.primary}08`,
                            boxShadow: `inset 4px 0 0 ${colors.primary}88`,
                            pl: 3.5,
                            '& .choice-indicator': {
                              bgcolor: colors.primary,
                              color: '#0a0e1a',
                              boxShadow: `0 0 8px ${colors.glowStrong}`,
                            },
                          }
                        : {},
                      '&:active': !c.disabled
                        ? {
                            transform: 'scale(0.98)',
                          }
                        : {},
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                      <Box
                        className="choice-indicator"
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          bgcolor: `${colors.border}`,
                          color: colors.textSub,
                          flexShrink: 0,
                          mt: 0.25,
                          transition: 'all 0.25s ease',
                        }}
                      >
                        {i + 1}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: '0.88rem',
                            color: c.disabled ? colors.muted : colors.textMain,
                            textAlign: 'left',
                            fontWeight: 500,
                            lineHeight: 1.4,
                          }}
                        >
                          {c.text}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.65rem',
                            color: c.disabled ? colors.muted : colors.textSub,
                            fontFamily: 'var(--font-mono)',
                            mt: 0.5,
                            lineHeight: 1.4,
                          }}
                        >
                          {c.consequenceHint}
                        </Typography>
                        {c.disabled && c.disabledReason && (
                          <Typography sx={{ fontSize: '0.6rem', color: colors.dangerHigh, mt: 0.5, fontFamily: 'var(--font-mono)' }}>
                            {c.disabledReason}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Button>
                ))}
              </Box>
            </>
          )}
        </Box>

        {/* bottom scanline */}
        <ScanlineBar />
      </Box>
    </Box>
  );
}
