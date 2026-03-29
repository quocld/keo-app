import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stitchHarvestFormStyles as headerStyles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { approveReceipt, getReceipt, rejectReceipt } from '@/lib/api/receipts';
import type { Receipt, TripDriverRef } from '@/lib/types/ops';

const S = Brand.stitch;

function normalizeReceiptStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

function statusPillLabel(st: string): string {
  if (st === 'pending') return 'CHỜ DUYỆT';
  if (st === 'approved') return 'ĐÃ DUYỆT';
  if (st === 'rejected') return 'TỪ CHỐI';
  return st ? st.toUpperCase() : '—';
}

function formatReceiptKtCode(id: string | number): string {
  const n = String(id).replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `KT-${n}`;
}

function driverName(r: Receipt): string {
  const d = r.driver;
  if (d && typeof d === 'object') {
    const parts = [d.firstName, d.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    if (d.email) return d.email;
  }
  if (r.driverId != null && r.driverId !== '') return `Tài xế #${r.driverId}`;
  return '—';
}

function driverEmail(r: Receipt): string | null {
  const d = r.driver as TripDriverRef | null | undefined;
  if (d && typeof d === 'object' && d.email) return String(d.email);
  return null;
}

function harvestAreaLine(r: Receipt): string {
  const n = r.harvestArea && typeof r.harvestArea === 'object' ? r.harvestArea.name : null;
  if (n) return String(n);
  if (r.harvestAreaId != null && r.harvestAreaId !== '') return `Khu #${r.harvestAreaId}`;
  return '—';
}

function weighingStationLine(r: Receipt): string {
  const w = (r as { weighingStation?: { name?: string } | null }).weighingStation;
  if (w && typeof w === 'object' && w.name) return String(w.name);
  const id = (r as { weighingStationId?: unknown }).weighingStationId;
  if (id != null && id !== '') return `Trạm #${id}`;
  return '—';
}

function receiptImageUrls(r: Receipt): string[] {
  const out: string[] = [];
  const urls = r.imageUrls;
  if (Array.isArray(urls)) {
    for (const u of urls) {
      if (typeof u === 'string' && u) out.push(u);
    }
  }
  const legacy = (r as { receiptImageUrl?: string }).receiptImageUrl;
  if (typeof legacy === 'string' && legacy) out.push(legacy);
  return out;
}

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function formatReceiptDate(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
}

function pillColors(st: string): { bg: string; fg: string } {
  switch (st) {
    case 'pending':
      return { bg: `${S.primary}18`, fg: S.primary };
    case 'approved':
      return { bg: `${Brand.forest}22`, fg: Brand.forest };
    case 'rejected':
      return { bg: '#ffebee', fg: '#c62828' };
    default:
      return { bg: S.surfaceContainerHigh, fg: S.onSurfaceVariant };
  }
}

export default function ReceiptDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : idParam?.[0];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canModerate = user?.role === 'owner' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getReceipt(id);
      setReceipt(data);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được phiếu'));
      setReceipt(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const st = receipt ? normalizeReceiptStatus(receipt.status) : '';
  const pending = st === 'pending';
  const weight =
    receipt?.weight != null && Number.isFinite(Number(receipt.weight)) ? Number(receipt.weight) : null;
  const amount =
    receipt?.amount != null && Number.isFinite(Number(receipt.amount)) ? Number(receipt.amount) : null;
  const displayId = receipt?.billCode?.trim()
    ? receipt.billCode.trim()
    : receipt
      ? formatReceiptKtCode(receipt.id)
      : '—';
  const images = useMemo(() => (receipt ? receiptImageUrls(receipt) : []), [receipt]);
  const tripId = (receipt as { tripId?: string | number | null })?.tripId;
  const rejectedReason = (receipt as { rejectedReason?: string | null })?.rejectedReason;
  const notes =
    receipt?.notes != null && String(receipt.notes).trim() ? String(receipt.notes).trim() : null;

  const onApprove = () => {
    if (!receipt || !id) return;
    Alert.alert('Phê duyệt phiếu', 'Xác nhận phê duyệt phiếu cân này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Phê duyệt',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const next = await approveReceipt(id);
              setReceipt(next);
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không phê duyệt được'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const onReject = () => {
    if (!receipt || !id) return;
    Alert.alert('Từ chối phiếu', 'Bạn có chắc muốn từ chối phiếu này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const next = await rejectReceipt(id, { rejectedReason: 'Từ chối từ app' });
              setReceipt(next);
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không từ chối được'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const openHarvestArea = () => {
    if (!receipt?.harvestAreaId) return;
    router.push(`/harvest-area/${String(receipt.harvestAreaId)}`);
  };

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>Thiếu mã phiếu.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={S.primary} />
      </View>
    );
  }

  if (error || !receipt) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>{error ?? 'Không có dữ liệu'}</Text>
        <Pressable onPress={() => void load()} style={styles.retry}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const pc = pillColors(st);

  return (
    <View style={styles.flex}>
      <View style={[headerStyles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={headerStyles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={headerStyles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Brand.ink} />
          </Pressable>
          <MaterialIcons name="receipt-long" size={22} color={Brand.forest} />
          <Text style={headerStyles.headerTitle} numberOfLines={1}>
            Chi tiết phiếu cân
          </Text>
        </View>
        <View style={headerStyles.headerRight}>
          <Pressable
            style={headerStyles.helpBtn}
            hitSlop={8}
            onPress={() =>
              Alert.alert('API', 'GET /receipts/:id — Phê duyệt: POST …/approve | …/reject (KeoTram Ops).')
            }>
            <MaterialIcons name="help-outline" size={20} color={Brand.ink} />
            <Text style={headerStyles.helpBtnText}>Hỗ trợ</Text>
          </Pressable>
        </View>
      </View>
      <View style={headerStyles.headerHairline} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (canModerate && pending ? 120 : 28) }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Phiếu cân · KeoTram Ops</Text>
          <Text style={styles.heroCode}>{displayId}</Text>
          <View style={styles.heroStatusRow}>
            <View style={[styles.statusPill, { backgroundColor: pc.bg }]}>
              <Text style={[styles.statusPillText, { color: pc.fg }]} numberOfLines={1}>
                {statusPillLabel(st)}
              </Text>
            </View>
          </View>
          <View style={styles.heroAccent}>
            <LinearGradient
              colors={['#e8f5e9', S.surfaceContainerLow, '#f1f8e9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <MaterialIcons name="scale" size={40} color={S.primary} style={{ opacity: 0.85 }} />
            <Text style={styles.heroAccentHint}>Cân hàng & chứng từ</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsScroll}>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Trọng lượng</Text>
            <Text style={styles.metricValue}>{weight != null ? `${weight} tấn` : '—'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Thành tiền</Text>
            <Text style={styles.metricValue} numberOfLines={2}>
              {amount != null ? formatVnd(amount) : '—'}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Thời gian phiếu</Text>
            <Text style={styles.metricValue} numberOfLines={2}>
              {formatReceiptDate(receipt.receiptDate)}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Thông tin vận hành</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tài xế</Text>
            <Text style={styles.infoValue}>{driverName(receipt)}</Text>
            {driverEmail(receipt) ? (
              <Text style={styles.infoSub}>{driverEmail(receipt)}</Text>
            ) : null}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Khu khai thác</Text>
            <Text style={styles.infoValue}>{harvestAreaLine(receipt)}</Text>
            {receipt.harvestAreaId != null && user?.role === 'owner' ? (
              <Pressable onPress={openHarvestArea} style={styles.linkRow}>
                <Text style={styles.linkText}>Mở chi tiết khu</Text>
                <MaterialIcons name="chevron-right" size={18} color={S.primary} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trạm cân</Text>
            <Text style={styles.infoValue}>{weighingStationLine(receipt)}</Text>
          </View>
          {tripId != null && tripId !== '' ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Chuyến (trip)</Text>
              <Text style={styles.infoValueMono}>#{String(tripId)}</Text>
            </View>
          ) : null}
        </View>

        {st === 'rejected' && rejectedReason ? (
          <View style={styles.rejectBanner}>
            <MaterialIcons name="error-outline" size={22} color="#c62828" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectTitle}>Lý do từ chối</Text>
              <Text style={styles.rejectBody}>{String(rejectedReason)}</Text>
            </View>
          </View>
        ) : null}

        {notes ? (
          <View style={styles.noticeCard}>
            <View style={styles.noticeHead}>
              <MaterialIcons name="notes" size={20} color={S.tertiary} />
              <Text style={styles.noticeTitle}>Ghi chú</Text>
            </View>
            <Text style={styles.noticeBody}>{notes}</Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Ảnh chứng từ</Text>
          {images.length === 0 ? (
            <View style={styles.imageEmpty}>
              <MaterialIcons name="hide-image" size={36} color={`${S.outline}66`} />
              <Text style={styles.imageEmptyText}>Chưa có ảnh đính kèm</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageStrip}>
              {images.map((uri) => (
                <Pressable key={uri} onPress={() => setPreviewUrl(uri)} style={styles.imageThumbWrap}>
                  <Image source={{ uri }} style={styles.imageThumb} contentFit="cover" />
                  <View style={styles.imageZoomBadge}>
                    <MaterialIcons name="zoom-in" size={18} color="#fff" />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {canModerate && pending ? (
        <View style={[styles.footerBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={onReject}
            disabled={busy}
            style={({ pressed }) => [styles.footerReject, pressed && styles.footerRejectPressed, busy && styles.disabled]}>
            <Text style={styles.footerRejectText}>Từ chối</Text>
          </Pressable>
          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={({ pressed }) => [styles.footerApprove, pressed && styles.footerApprovePressed, busy && styles.disabled]}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.footerApproveText}>Phê duyệt</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal visible={previewUrl != null} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPreviewUrl(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalBar}>
              <Text style={styles.modalTitle}>Ảnh phiếu</Text>
              <Pressable onPress={() => setPreviewUrl(null)} hitSlop={12}>
                <MaterialIcons name="close" size={26} color={Brand.ink} />
              </Pressable>
            </View>
            {previewUrl ? (
              <Image source={{ uri: previewUrl }} style={styles.modalImage} contentFit="contain" />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.canvas },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.canvas,
  },
  err: {
    color: '#ba1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: S.primary,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabled: { opacity: 0.55 },
  hero: {
    marginBottom: 20,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  heroCode: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Brand.ink,
    marginBottom: 10,
  },
  heroStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroAccent: {
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.surfaceContainerLow,
  },
  heroAccentHint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  metricsScroll: {
    gap: 12,
    paddingBottom: 4,
    marginBottom: 18,
  },
  metricCard: {
    width: 168,
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 16,
    marginRight: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}88`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  metricEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
    letterSpacing: -0.2,
  },
  sectionCard: {
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}66`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 14,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: S.onSurfaceVariant,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
  },
  infoSub: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    marginTop: 4,
  },
  infoValueMono: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 2,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  rejectBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  rejectTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b71c1c',
    marginBottom: 4,
  },
  rejectBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5d1a1a',
  },
  noticeCard: {
    backgroundColor: S.tertiaryFixed,
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: `${S.tertiary}33`,
  },
  noticeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: S.onTertiaryFixed,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 21,
    color: S.onTertiaryFixed,
  },
  imageEmpty: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  imageEmptyText: {
    fontSize: 14,
    color: S.onSurfaceVariant,
  },
  imageStrip: {
    gap: 12,
    paddingVertical: 4,
  },
  imageThumbWrap: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: S.surfaceContainerLow,
  },
  imageThumb: {
    width: '100%',
    height: '100%',
  },
  imageZoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    padding: 4,
  },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Brand.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.outlineVariant,
  },
  footerReject: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
    backgroundColor: '#fff5f5',
  },
  footerRejectPressed: {
    backgroundColor: '#ffebee',
  },
  footerRejectText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#c62828',
  },
  footerApprove: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: S.primary,
  },
  footerApprovePressed: {
    opacity: 0.92,
  },
  footerApproveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
  },
  modalImage: {
    width: '100%',
    height: 360,
    backgroundColor: '#000',
  },
});
