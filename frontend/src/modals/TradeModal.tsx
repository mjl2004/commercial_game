import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  ShoppingCart as TradeIcon,
  ArrowUpward,
  ArrowDownward,
  Lock as LockIcon,
} from '@mui/icons-material';
import colors from '../theme/colors';
import PriceTrendChart from '../fx/PriceTrendChart';
import { goodsSrc, ASSET_PATHS } from '../theme/assets';

/* ---- types ---- */
export interface GoodsCard {
  goodsId: number;
  goodsName: string;
  currentPrice: number;
  previousPrice?: number;
  avgPrice?: number;
  stock: number;
  maxStock: number;
  isContraband: boolean;
  isLocked: boolean;
  lockReason?: string;
}

export interface CargoSlotItem {
  goodsId: number;
  goodsName: string;
  quantity: number;
  avgCost?: number;
  isContraband?: boolean;
}

export interface AdjacentPrice {
  stationName: string;
  price: number;
}

export interface TradeModalProps {
  open: boolean;
  stationName: string;
  stationGoods: GoodsCard[];
  cargoItems: CargoSlotItem[];
  isLoading: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
  onSelectGoods: (goods: GoodsCard) => void;
  onClose: () => void;
}

/* ---- price color helper ---- */
function getPriceColor(goods: GoodsCard): string {
  if (goods.previousPrice) {
    if (goods.currentPrice < goods.previousPrice) return colors.successLow;
    if (goods.currentPrice > goods.previousPrice) return colors.dangerHigh;
  }
  if (goods.avgPrice) {
    if (goods.currentPrice < goods.avgPrice) return colors.successLow;
    if (goods.currentPrice > goods.avgPrice) return colors.dangerHigh;
  }
  return colors.primary;
}

/* ---- stock bar color ---- */
function getStockColor(stock: number, maxStock: number): string {
  const ratio = stock / maxStock;
  if (ratio < 0.2) return colors.dangerHigh;
  if (ratio < 0.5) return colors.warning;
  return colors.successLow;
}

export default function TradeModal({
  open,
  stationName,
  stationGoods,
  cargoItems,
  isLoading,
  errorMessage,
  onClearError,
  onSelectGoods,
  onClose,
}: TradeModalProps) {
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 280);
  }

  function handleSelectGoods(goods: GoodsCard) {
    if (goods.isLocked) return;
    onSelectGoods(goods);
  }

  const cargoMap = useMemo(() => {
    const map = new Map<number, CargoSlotItem>();
    cargoItems.forEach((c) => map.set(c.goodsId, c));
    return map;
  }, [cargoItems]);

  if (!open && !closing) return null;

  return (
    <Box
      onClick={handleClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 19,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        animation: `fadeIn 0.3s ease ${closing ? 'reverse' : 'both'}`,
      }}
    >
      {/* modal */}
      <Box
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: 960,
          maxWidth: '94vw',
          height: 640,
          maxHeight: '88vh',
          bgcolor: 'rgba(16,20,35,0.96)',
          borderRadius: '4px',
          border: `1px solid ${colors.borderGlow}`,
          boxShadow: `0 0 40px ${colors.glow}, 0 8px 64px rgba(0,0,0,0.6)`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: closing
            ? 'slideDown 0.28s ease forwards'
            : 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* ---- header ---- */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 3,
            py: 1.5,
            borderBottom: `1px solid ${colors.border}`,
            background: 'rgba(13,17,28,0.5)',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              flex: 1,
              fontFamily: 'var(--font-heading)',
              fontSize: '1rem',
              letterSpacing: '0.04em',
              color: colors.textMain,
            }}
          >
            <span style={{ color: colors.primary, marginRight: 8 }}>&#9664;</span>
            {stationName} · 商品市场
          </Typography>
          <IconButton onClick={handleClose} size="small" sx={{ color: colors.textSub, '&:hover': { color: colors.dangerHigh } }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {!!errorMessage && (
          <Box
            sx={{
              px: 3,
              py: 1.25,
              borderBottom: `1px solid ${colors.danger}33`,
              bgcolor: 'rgba(255,42,109,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: colors.dangerHigh }}>
              {errorMessage}
            </Typography>
            <IconButton size="small" onClick={onClearError} sx={{ color: colors.dangerHigh, p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}

        {/* ---- body ---- */}
        {isLoading ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Box sx={{ position: 'relative', width: 56, height: 56 }}>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  border: `2px solid ${colors.primary}`,
                  animation: 'spin 2s linear infinite',
                  '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 10,
                  border: `2px solid ${colors.accent}`,
                  animation: 'spin 1.5s linear infinite reverse',
                  '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } },
                }}
              />
            </Box>
            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: colors.textSub, animation: 'pulse 2s ease-in-out infinite' }}>
              正在连接贸易网络...
            </Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* ---- left: station market (60%) ---- */}
            <Box sx={{ flex: 3, overflow: 'auto', p: 2, borderRight: `1px solid ${colors.border}` }}>
              <Typography
                variant="caption"
                sx={{ color: colors.textSub, mb: 2, display: 'block', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}
              >
                本站商品 ({stationGoods.length})
              </Typography>
              {stationGoods.length === 0 ? (
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: colors.muted, textAlign: 'center', py: 4 }}>
                  {'\u{1F4E6}'} 无可用商品
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 1.5,
                  }}
                >
                  {stationGoods.map((goods) => {
                    const isSelected = false;
                    const cargoItem = cargoMap.get(goods.goodsId);
                    const priceColor = getPriceColor(goods);
                    const stockColor = getStockColor(goods.stock, goods.maxStock || 100);

                    return (
                      <Box
                        key={goods.goodsId}
                        onClick={() => handleSelectGoods(goods)}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          p: 1.5,
                          borderRadius: '2px',
                          border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                          bgcolor: goods.isLocked
                            ? 'rgba(255,255,255,0.02)'
                            : isSelected
                            ? 'rgba(0,212,255,0.08)'
                            : 'rgba(13,17,28,0.6)',
                          cursor: goods.isLocked ? 'not-allowed' : 'pointer',
                          opacity: goods.isLocked ? 0.4 : 1,
                          filter: goods.isLocked ? 'grayscale(0.7)' : 'none',
                          transition: 'all var(--transition-fast)',
                          position: 'relative',
                          minHeight: 160,
                          transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                          boxShadow: isSelected ? `0 0 20px ${colors.glow}` : 'none',
                          '&:hover': !goods.isLocked && !isSelected ? {
                            borderColor: colors.borderHover,
                            bgcolor: 'rgba(0,212,255,0.04)',
                          } : {},
                        }}
                      >
                        {/* held badge */}
                        {cargoItem && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 6,
                              left: 6,
                              px: 0.75,
                              py: 0.25,
                              bgcolor: `${colors.accent}22`,
                              border: `1px solid ${colors.accent}44`,
                              borderRadius: '2px',
                            }}
                          >
                            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: colors.accent, fontWeight: 600 }}>
                              已持有
                            </Typography>
                          </Box>
                        )}

                        {/* icon */}
                        <Box
                          component="img"
                          src={goodsSrc(goods.goodsId)}
                          alt={goods.goodsName}
                          sx={{ width: 48, height: 48, flexShrink: 0, opacity: goods.isLocked ? 0.5 : 1 }}
                        />

                        {/* name */}
                        <Typography
                          sx={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: goods.isLocked ? colors.muted : colors.textMain,
                            textAlign: 'center',
                          }}
                        >
                          {goods.goodsName}
                        </Typography>

                        {/* contraband / lock */}
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          {goods.isContraband && (
                            <Box component="img" src={ASSET_PATHS.icons.contrabandWarning} alt="" sx={{ width: 16, height: 16 }} />
                          )}
                          {goods.isLocked && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                              <LockIcon sx={{ fontSize: 16, color: colors.danger }} />
                              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: colors.danger }}>
                                {goods.lockReason}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* price */}
                        <Box sx={{ textAlign: 'center' }}>
                          {goods.previousPrice && goods.previousPrice !== goods.currentPrice && (
                            <Typography
                              sx={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.6rem',
                                color: colors.textSub,
                                textDecoration: 'line-through',
                              }}
                            >
                              {goods.previousPrice.toLocaleString()}
                            </Typography>
                          )}
                          <Typography
                            sx={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '1.15rem',
                              fontWeight: 700,
                              color: priceColor,
                            }}
                          >
                            {goods.currentPrice.toLocaleString()} CR
                          </Typography>
                        </Box>

                        {/* stock bar */}
                        <Box sx={{ width: '100%', mt: 'auto' }}>
                          <Box
                            sx={{
                              width: '100%',
                              height: 4,
                              borderRadius: '2px',
                              bgcolor: 'rgba(255,255,255,0.04)',
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                width: `${Math.min((goods.stock / (goods.maxStock || 100)) * 100, 100)}%`,
                                height: '100%',
                                bgcolor: stockColor,
                                borderRadius: '2px',
                                transition: 'width 0.5s ease',
                              }}
                            />
                          </Box>
                          <Typography
                            sx={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.55rem',
                              color: colors.textSub,
                              textAlign: 'center',
                              mt: 0.25,
                            }}
                          >
                            库存: {goods.stock}
                          </Typography>
                        </Box>

                        {/* price comparison arrow for held goods */}
                        {cargoItem && cargoItem.avgCost && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                            {goods.currentPrice < cargoItem.avgCost ? (
                              <>
                                <ArrowDownward sx={{ fontSize: 14, color: colors.successLow }} />
                                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: colors.successLow }}>
                                  可补仓
                                </Typography>
                              </>
                            ) : goods.currentPrice > cargoItem.avgCost ? (
                              <>
                                <ArrowUpward sx={{ fontSize: 14, color: colors.dangerHigh }} />
                                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: colors.dangerHigh }}>
                                  可套利
                                </Typography>
                              </>
                            ) : null}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* ---- right: cargo (40%) ---- */}
            <Box
              sx={{
                flex: 2,
                overflow: 'auto',
                p: 2,
                bgcolor: 'rgba(13,17,28,0.3)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: colors.textSub,
                  mb: 2,
                  display: 'block',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                }}
              >
                飞船货舱 ({cargoItems.length})
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
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.25,
                        borderRadius: '2px',
                        bgcolor: 'rgba(5,255,161,0.03)',
                        border: `1px solid ${colors.border}`,
                        transition: 'all var(--transition-fast)',
                        '&:hover': {
                          borderColor: colors.accent,
                          bgcolor: 'rgba(5,255,161,0.06)',
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={goodsSrc(item.goodsId)}
                        alt={item.goodsName}
                        sx={{ width: 32, height: 32, flexShrink: 0 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.78rem', color: colors.textMain, fontWeight: 500 }} noWrap>
                          {item.goodsName}
                        </Typography>
                        <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.primary }}>
                          ×{item.quantity}
                          {item.avgCost && ` @ ${item.avgCost.toLocaleString()}`}
                        </Typography>
                      </Box>
                      {item.isContraband && (
                        <Box component="img" src={ASSET_PATHS.icons.contrabandWarning} alt="" sx={{ width: 14, height: 14 }} />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ---- MiniTradePanel (GA-25) ---- */

export interface MiniTradePanelProps {
  goodsId: number;
  goodsName: string;
  currentPrice: number;
  previousPrice?: number;
  stock: number;
  isContraband: boolean;
  cargoQuantity: number;
  maxBuy: number;
  maxSell: number;
  priceHistory?: number[];
  adjacentPrices?: AdjacentPrice[];
  isSubmitting?: boolean;
  onExecute: (quantity: number, type: 'buy' | 'sell') => void;
  onClose: () => void;
}

export function MiniTradePanel({
  goodsId,
  goodsName,
  currentPrice,
  previousPrice,
  stock,
  isContraband,
  cargoQuantity,
  maxBuy,
  maxSell,
  adjacentPrices,
  isSubmitting,
  priceHistory,
  onExecute,
  onClose,
}: MiniTradePanelProps) {
  const [quantity, setQuantity] = useState(1);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');

  const maxQty = tradeType === 'buy' ? maxBuy : maxSell;
  const total = currentPrice * quantity;
  const safeQty = Math.max(1, Math.min(quantity, maxQty));

  return (
    <Box
      className="modal-panel"
      onClick={(e) => e.stopPropagation()}
      sx={{
        width: 400,
        maxWidth: '92vw',
        maxHeight: '88vh',
        overflow: 'auto',
        zIndex: 22,
        bgcolor: 'rgba(13,17,28,0.98)',
        borderRadius: '4px',
        border: `1px solid ${colors.borderGlow}`,
        boxShadow: `0 0 40px ${colors.glowStrong}, 0 8px 48px rgba(0,0,0,0.6)`,
        p: 3,
        animation: 'fadeIn 0.25s ease both',
      }}
    >
      {/* header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="img" src={goodsSrc(goodsId)} alt="" sx={{ width: 32, height: 32 }} />
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: colors.textMain }}>
            {goodsName}
          </Typography>
          {isContraband && (
            <Box component="img" src={ASSET_PATHS.icons.contrabandWarning} alt="" sx={{ width: 16, height: 16 }} />
          )}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: colors.textSub, '&:hover': { color: colors.dangerHigh } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* price info - large breathing price */}
      <Box sx={{ mb: 3, textAlign: 'center', position: 'relative' }}>
        <Typography variant="caption" sx={{ color: colors.textSub, display: 'block', mb: 0.5, fontFamily: 'var(--font-mono)' }}>
          当前价格
        </Typography>
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          {/* radar scan decoration */}
          <Box
            sx={{
              position: 'absolute',
              inset: '-20px',
              borderRadius: '50%',
              border: '1px solid rgba(0,212,255,0.1)',
              animation: 'breathe 3s ease-in-out infinite',
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
            {previousPrice && previousPrice !== currentPrice && (
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: colors.textSub, textDecoration: 'line-through' }}>
                {previousPrice.toLocaleString()}
              </Typography>
            )}
            <Typography
              sx={{
                fontFamily: 'var(--font-mono)',
                fontSize: '2.5rem',
                fontWeight: 700,
                color: colors.primary,
                letterSpacing: '-0.02em',
                animation: 'priceBreathe 2s ease-in-out infinite',
                textShadow: '0 0 16px rgba(0,212,255,0.4), 0 0 32px rgba(0,212,255,0.2)',
              }}
            >
              {currentPrice.toLocaleString()}
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: colors.textSub }}>
              CR
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: colors.textSub, display: 'block' }}>库存</Typography>
            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: colors.textMain, fontWeight: 600 }}>
              {stock} 单位
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: colors.textSub, display: 'block' }}>已持有</Typography>
            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: colors.textMain, fontWeight: 600 }}>
              {cargoQuantity} 单位
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* price trend chart */}
      {priceHistory && priceHistory.length > 1 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ color: colors.textSub, mb: 0.75, display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
            价格趋势
          </Typography>
          <PriceTrendChart data={priceHistory} width={340} height={70} />
        </Box>
      )}

      {/* adjacent prices */}
      {adjacentPrices && adjacentPrices.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ color: colors.textSub, mb: 0.75, display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
            相邻站点价格
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {adjacentPrices.map((ap) => {
              const diff = ap.price - currentPrice;
              const diffPct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;
              const isHigher = diff > 0;
              const cardColor = isHigher ? colors.dangerHigh : colors.successLow;
              return (
                <Box
                  key={ap.stationName}
                  sx={{
                    flex: 1,
                    px: 1,
                    py: 0.75,
                    borderRadius: '2px',
                    border: `1px solid ${cardColor}44`,
                    bgcolor: `${cardColor}08`,
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '0.6rem', color: colors.textSub }} noWrap>{ap.stationName}</Typography>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: cardColor, fontWeight: 600 }}>
                    {ap.price.toLocaleString()}
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: cardColor }}>
                    {isHigher ? '▲' : '▼'} {Math.abs(diffPct).toFixed(1)}%
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* trade type toggle */}
      <ToggleButtonGroup
        value={tradeType}
        exclusive
        size="small"
        fullWidth
        onChange={(_, v) => { if (v) { setTradeType(v); setQuantity(1); } }}
        sx={{ mb: 2.5 }}
      >
        <ToggleButton
          value="buy"
          sx={{
            flex: 1,
            fontSize: '0.8rem',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            py: 0.75,
            borderRadius: '2px',
            color: tradeType === 'buy' ? colors.successLow : colors.textSub,
            bgcolor: tradeType === 'buy' ? `${colors.successLow}18` : 'transparent',
            border: `1px solid ${tradeType === 'buy' ? colors.successLow : colors.border}`,
            '&.Mui-selected': {
              color: colors.successLow,
              bgcolor: `${colors.successLow}18`,
              borderColor: colors.successLow,
            },
          }}
        >
          买入
        </ToggleButton>
        <ToggleButton
          value="sell"
          sx={{
            flex: 1,
            fontSize: '0.8rem',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            py: 0.75,
            borderRadius: '2px',
            color: tradeType === 'sell' ? colors.dangerHigh : colors.textSub,
            bgcolor: tradeType === 'sell' ? `${colors.dangerHigh}18` : 'transparent',
            border: `1px solid ${tradeType === 'sell' ? colors.dangerHigh : colors.border}`,
            '&.Mui-selected': {
              color: colors.dangerHigh,
              bgcolor: `${colors.dangerHigh}18`,
              borderColor: colors.dangerHigh,
            },
          }}
        >
          卖出
        </ToggleButton>
      </ToggleButtonGroup>

      {/* quantity adjuster */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          sx={{
            minWidth: 40,
            px: 0,
            py: 0.5,
            fontSize: '1.2rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: colors.primary,
            borderColor: colors.borderHover,
            borderRadius: '2px',
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
            '&:hover': { borderColor: colors.primary, bgcolor: 'rgba(0,212,255,0.06)' },
            '&:active': { transform: 'scale(0.95) translateY(1px)' },
          }}
        >
          -
        </Button>
        <Box
          component="input"
          type="number"
          value={safeQty}
          min={1}
          max={maxQty}
          onChange={(e) => setQuantity(Math.max(1, Math.min(Number(e.target.value) || 1, maxQty)))}
          sx={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: colors.textMain,
            bgcolor: 'rgba(0,0,0,0.2)',
            border: `1px solid ${colors.border}`,
            borderRadius: '2px',
            py: 0.75,
            outline: 'none',
            '&:focus': { borderColor: colors.primary, boxShadow: `0 0 8px ${colors.glow}` },
            '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { display: 'none' },
          }}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={() => setQuantity((q) => Math.min(q + 1, maxQty))}
          sx={{
            minWidth: 40,
            px: 0,
            py: 0.5,
            fontSize: '1.2rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: colors.primary,
            borderColor: colors.borderHover,
            borderRadius: '2px',
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
            '&:hover': { borderColor: colors.primary, bgcolor: 'rgba(0,212,255,0.06)' },
            '&:active': { transform: 'scale(0.95) translateY(1px)' },
          }}
        >
          +
        </Button>
        <Typography variant="caption" sx={{ color: colors.textSub, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', ml: 0.5 }}>
          max {maxQty}
        </Typography>
      </Box>

      {/* total preview */}
      <Box
        sx={{
          mb: 2.5,
          p: 2,
          borderRadius: '2px',
          bgcolor: tradeType === 'buy' ? 'rgba(255,71,87,0.04)' : 'rgba(0,229,160,0.04)',
          border: `1px solid ${tradeType === 'buy' ? 'rgba(255,71,87,0.15)' : 'rgba(0,229,160,0.15)'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ color: colors.textSub, fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
          {tradeType === 'buy' ? '预计支出' : '预计收入'}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.75rem',
            fontWeight: 800,
            color: tradeType === 'buy' ? colors.dangerHigh : colors.successLow,
            letterSpacing: '-0.02em',
          }}
        >
          {tradeType === 'buy' ? '-' : '+'}{total.toLocaleString()} CR
        </Typography>
      </Box>

      {/* execute button */}
      <Button
        variant="contained"
        fullWidth
        disabled={isSubmitting || maxQty < 1}
        onClick={() => onExecute(safeQty, tradeType)}
        startIcon={<TradeIcon />}
        sx={{
          py: 1.5,
          fontSize: '0.9rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          letterSpacing: '0.05em',
          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
          background: tradeType === 'buy'
            ? 'linear-gradient(180deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)'
            : 'linear-gradient(180deg, rgba(0,229,160,0.2) 0%, rgba(0,229,160,0.08) 100%)',
          border: `1px solid ${tradeType === 'buy' ? colors.borderHover : 'rgba(0,229,160,0.5)'}`,
          color: colors.white,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            boxShadow: tradeType === 'buy'
              ? `0 0 24px ${colors.glowStrong}`
              : '0 0 24px rgba(0,229,160,0.3)',
            transform: 'translateY(-2px)',
          },
          '&:active': {
            transform: 'scale(0.97) translateY(2px)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)',
            transform: 'translateY(-100%)',
            transition: 'transform 0.3s ease',
          },
          '&:hover::after': {
            transform: 'translateY(0)',
          },
        }}
      >
        {isSubmitting ? '处理中...' : `${tradeType === 'buy' ? '买入' : '卖出'} ${goodsName}`}
      </Button>
    </Box>
  );
}
