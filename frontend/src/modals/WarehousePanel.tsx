import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon, Inventory as WarehouseIcon } from '@mui/icons-material';
import { goodsSrc } from '../theme/assets';
import colors from '../theme/colors';

/* ---- types ---- */
export interface WarehouseItem {
  goodsId: number;
  goodsName: string;
  quantity: number;
  stationName: string;
  storedTurns?: number;
  taxRate?: number;
}

interface Props {
  open: boolean;
  cargoItems: Array<{
    goodsId: number;
    goodsName: string;
    quantity: number;
    avgCost?: number;
    isContraband?: boolean;
  }>;
  warehouseItems: WarehouseItem[];
  cargoCapacity: number;
  cargoUsed: number;
  onDeposit?: (goodsId: number, quantity: number) => void;
  onWithdraw?: (goodsId: number, quantity: number) => void;
  onClose: () => void;
}

export default function WarehousePanel({
  open,
  cargoItems,
  warehouseItems,
  cargoCapacity,
  cargoUsed,
  onDeposit,
  onWithdraw,
  onClose,
}: Props) {
  const [selectedCargoId, setSelectedCargoId] = useState<number | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [transferQty, setTransferQty] = useState(1);

  if (!open) return null;

  const selectedCargo = cargoItems.find((c) => c.goodsId === selectedCargoId);
  const selectedWarehouse = warehouseItems.find((w) => w.goodsId === selectedWarehouseId);

  return (
    <>
      {/* backdrop */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 24,
          bgcolor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.3s ease',
        }}
      />

      {/* panel */}
      <Box
        className="modal-panel"
        sx={{
          position: 'fixed',
          top: 'var(--hud-top-height)',
          right: 0,
          bottom: 'var(--hud-bottom-height)',
          width: 550,
          maxWidth: '92vw',
          zIndex: 25,
          bgcolor: 'rgba(13,17,28,0.96)',
          borderLeft: `1px solid ${colors.borderGlow}`,
          boxShadow: `-8px 0 32px rgba(0,0,0,0.5)`,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 3,
            py: 1.5,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <WarehouseIcon sx={{ color: colors.primary, fontSize: 20, mr: 1 }} />
          <Typography
            variant="h6"
            sx={{
              flex: 1,
              fontFamily: 'var(--font-heading)',
              fontSize: '0.9rem',
              letterSpacing: '0.04em',
              color: colors.textMain,
            }}
          >
            仓库管理
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: colors.textSub }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* body */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* left: cargo */}
          <Box sx={{ flex: 1, p: 2, borderRight: `1px solid ${colors.border}`, overflow: 'auto' }}>
            <Typography
              variant="caption"
              sx={{
                color: colors.textSub,
                mb: 1.5,
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
              }}
            >
              飞船货舱 ({cargoUsed}/{cargoCapacity})
            </Typography>

            {cargoItems.length === 0 ? (
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: colors.muted, textAlign: 'center', py: 4 }}>
                {'\u{1F4E6}'} 货舱为空
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {cargoItems.map((item) => (
                  <Box
                    key={item.goodsId}
                    onClick={() => {
                      setSelectedCargoId(item.goodsId);
                      setSelectedWarehouseId(null);
                      setTransferQty(1);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      borderRadius: '2px',
                      border: `1px solid ${selectedCargoId === item.goodsId ? colors.primary : colors.border}`,
                      bgcolor: selectedCargoId === item.goodsId ? 'rgba(0,212,255,0.06)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      '&:hover': {
                        borderColor: colors.borderHover,
                        bgcolor: 'rgba(0,212,255,0.03)',
                      },
                    }}
                  >
                    <Box component="img" src={goodsSrc(item.goodsId)} alt={item.goodsName} sx={{ width: 32, height: 32, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: colors.textMain, fontWeight: 500 }} noWrap>
                        {item.goodsName}
                      </Typography>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.primary }}>
                        ×{item.quantity}
                        {item.avgCost && ` @ ${item.avgCost.toLocaleString()}`}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* deposit controls */}
            {selectedCargo && (
              <Box sx={{ mt: 2, p: 1.5, borderRadius: '2px', border: `1px solid ${colors.border}`, bgcolor: 'rgba(0,212,255,0.02)' }}>
                <Typography sx={{ fontSize: '0.75rem', color: colors.textMain, mb: 1 }}>
                  存入 <strong>{selectedCargo.goodsName}</strong>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Button
                    size="small"
                    onClick={() => setTransferQty((q) => Math.max(1, q - 1))}
                    sx={{
                      minWidth: 28,
                      px: 0,
                      color: colors.primary,
                      borderColor: colors.border,
                      clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                    }}
                    variant="outlined"
                  >
                    -
                  </Button>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: colors.textMain, minWidth: 40, textAlign: 'center' }}>
                    {transferQty}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setTransferQty((q) => Math.min(q + 1, selectedCargo.quantity))}
                    sx={{
                      minWidth: 28,
                      px: 0,
                      color: colors.primary,
                      borderColor: colors.border,
                      clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                    }}
                    variant="outlined"
                  >
                    +
                  </Button>
                </Box>
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  onClick={() => onDeposit?.(selectedCargo.goodsId, transferQty)}
                  sx={{
                    py: 0.75,
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-heading)',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                    background: 'linear-gradient(180deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.05) 100%)',
                    border: `1px solid ${colors.borderHover}`,
                    '&:hover': { boxShadow: `0 0 12px ${colors.glow}` },
                  }}
                >
                  存入仓库
                </Button>
              </Box>
            )}
          </Box>

          {/* right: warehouse */}
          <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
            <Typography
              variant="caption"
              sx={{
                color: colors.textSub,
                mb: 1.5,
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
              }}
            >
              当前站点仓库
            </Typography>

            {warehouseItems.length === 0 ? (
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: colors.muted, textAlign: 'center', py: 4 }}>
                {'\u{1F4E6}'} 仓库为空
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {warehouseItems.map((item) => (
                  <Box
                    key={`${item.goodsId}-${item.stationName}`}
                    onClick={() => {
                      setSelectedWarehouseId(item.goodsId);
                      setSelectedCargoId(null);
                      setTransferQty(1);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      borderRadius: '2px',
                      border: `1px solid ${selectedWarehouseId === item.goodsId ? colors.accent : colors.border}`,
                      bgcolor: selectedWarehouseId === item.goodsId ? 'rgba(5,255,161,0.06)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      '&:hover': {
                        borderColor: colors.borderHover,
                        bgcolor: 'rgba(5,255,161,0.03)',
                      },
                    }}
                  >
                    <Box component="img" src={goodsSrc(item.goodsId)} alt={item.goodsName} sx={{ width: 32, height: 32, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: colors.textMain, fontWeight: 500 }} noWrap>
                        {item.goodsName}
                      </Typography>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.accent }}>
                        ×{item.quantity}
                      </Typography>
                      {item.storedTurns !== undefined && (
                        <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: colors.textSub }}>
                          存放 {item.storedTurns} 回合
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* withdraw controls */}
            {selectedWarehouse && (
              <Box sx={{ mt: 2, p: 1.5, borderRadius: '2px', border: `1px solid ${colors.border}`, bgcolor: 'rgba(5,255,161,0.02)' }}>
                <Typography sx={{ fontSize: '0.75rem', color: colors.textMain, mb: 1 }}>
                  取出 <strong>{selectedWarehouse.goodsName}</strong>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Button
                    size="small"
                    onClick={() => setTransferQty((q) => Math.max(1, q - 1))}
                    sx={{
                      minWidth: 28,
                      px: 0,
                      color: colors.accent,
                      borderColor: colors.border,
                      clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                    }}
                    variant="outlined"
                  >
                    -
                  </Button>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: colors.textMain, minWidth: 40, textAlign: 'center' }}>
                    {transferQty}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setTransferQty((q) => Math.min(q + 1, selectedWarehouse.quantity))}
                    sx={{
                      minWidth: 28,
                      px: 0,
                      color: colors.accent,
                      borderColor: colors.border,
                      clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                    }}
                    variant="outlined"
                  >
                    +
                  </Button>
                </Box>
                {selectedWarehouse.taxRate && selectedWarehouse.taxRate > 0 && (
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: colors.dangerHigh, mb: 1 }}>
                    预计税费: -{Math.round(transferQty * selectedWarehouse.taxRate).toLocaleString()} CR
                  </Typography>
                )}
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  onClick={() => onWithdraw?.(selectedWarehouse.goodsId, transferQty)}
                  sx={{
                    py: 0.75,
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-heading)',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                    background: 'linear-gradient(180deg, rgba(5,255,161,0.15) 0%, rgba(5,255,161,0.05) 100%)',
                    border: `1px solid rgba(5,255,161,0.4)`,
                    color: colors.white,
                    '&:hover': { boxShadow: '0 0 12px rgba(5,255,161,0.3)' },
                  }}
                >
                  取出货物
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
