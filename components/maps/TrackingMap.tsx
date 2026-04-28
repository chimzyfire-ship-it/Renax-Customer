// components/maps/TrackingMap.tsx
// Web-only Leaflet tracking map — renders planned routes, live rider position,
// and status-aware display modes powered by Supabase Realtime.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Map } from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TrackingMapProps {
  pickupLat: number;
  pickupLon: number;
  deliveryLat: number;
  deliveryLon: number;
  riderLat?: number | null;
  riderLon?: number | null;
  status: string;
  shipmentType?: string;
  trackingId?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
}

// ─── OSRM Route Fetcher ───────────────────────────────────────────────────────
async function fetchRoute(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number
): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=simplified&geometries=geojson`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.routes && json.routes[0]) {
      return json.routes[0].geometry.coordinates.map(([lon, lat]: number[]) => [lat, lon]);
    }
  } catch (e) {
    console.warn('OSRM route fetch failed:', e);
  }
  // Fallback: straight line
  return [[fromLat, fromLon], [toLat, toLon]];
}

// ─── Native Fallback ──────────────────────────────────────────────────────────
function NativeFallback() {
  return (
    <View style={nativeStyles.box}>
      <Map color="#ccfd3a" size={40} style={{ marginBottom: 12 }} />
      <Text style={nativeStyles.title}>Live Map</Text>
      <Text style={nativeStyles.sub}>Open this app in a browser for the full interactive tracking map.</Text>
    </View>
  );
}
const nativeStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#041910', borderRadius: 16, padding: 32 },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#fff', marginBottom: 8 },
  sub: { fontFamily: 'Outfit_4', fontSize: 14, color: 'rgba(200,255,220,0.55)', textAlign: 'center', lineHeight: 22 },
});

// ─── Web Map Component ────────────────────────────────────────────────────────
function WebTrackingMap(props: TrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<string | null>(null);

  const status = (props.status || '').toLowerCase();
  const isDelivered = status === 'delivered';
  const isCancelled = status === 'cancelled';
  const hasRider = !!(props.riderLat && props.riderLon);
  const isInterState = props.shipmentType === 'inter_state';

  // ── Status config ─────────────────────────────────────────────────────────
  const getStatusConfig = useCallback(() => {
    if (isDelivered) return { color: '#10B981', label: 'Delivered', pulse: false };
    if (isCancelled) return { color: '#EF4444', label: 'Cancelled', pulse: false };
    if (hasRider && (status.includes('assigned') || status.includes('picked') || status.includes('transit'))) {
      return { color: '#ccfd3a', label: 'Rider En Route', pulse: true };
    }
    return { color: '#F59E0B', label: 'Pending — Awaiting Rider', pulse: true };
  }, [status, isDelivered, isCancelled, hasRider]);

  // ── Inject Leaflet CSS once ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // ── Build map on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || typeof window === 'undefined') return;

    let L: any;
    let map: any;

    const init = async () => {
      try {
        L = (await import('leaflet')).default;

        // Destroy old instance if exists
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        map = L.map(mapContainerRef.current!, {
          zoomControl: true,
          attributionControl: false,
        });
        mapRef.current = map;

        // Tile layer — dark RENAX theme
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(map);

        const pickupIcon = L.divIcon({
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:#004d3d;border:3px solid #ccfd3a;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 16px rgba(0,0,0,0.5);
          "><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccfd3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const deliveryIcon = L.divIcon({
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:${isDelivered ? '#10B981' : '#EF4444'};border:3px solid #fff;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 16px rgba(0,0,0,0.5);
          ">${isDelivered ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'}</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const riderIcon = L.divIcon({
          html: `<div style="
            width:44px;height:44px;border-radius:50%;
            background:#ccfd3a;border:3px solid #004d3d;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 20px rgba(204,253,58,0.5);
            animation:renax-pulse 1.5s infinite;
          "><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#004d3d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
          className: '',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        // Inject pulse keyframes
        if (!document.getElementById('renax-map-styles')) {
          const style = document.createElement('style');
          style.id = 'renax-map-styles';
          style.textContent = `
            @keyframes renax-pulse {
              0%,100% { transform: scale(1); box-shadow: 0 4px 20px rgba(204,253,58,0.5); }
              50% { transform: scale(1.15); box-shadow: 0 4px 30px rgba(204,253,58,0.9); }
            }
            @keyframes renax-pending-pulse {
              0%,100% { opacity:1; transform:scale(1); }
              50% { opacity:0.6; transform:scale(1.3); }
            }
          `;
          document.head.appendChild(style);
        }

        // ── Markers ─────────────────────────────────────────────────────────
        L.marker([props.pickupLat, props.pickupLon], { icon: pickupIcon })
          .addTo(map)
          .bindPopup(`<b>Pickup</b><br/>${props.pickupAddress || ''}`);

        L.marker([props.deliveryLat, props.deliveryLon], { icon: deliveryIcon })
          .addTo(map)
          .bindPopup(`<b>${isDelivered ? 'Delivered' : 'Delivery'}</b><br/>${props.deliveryAddress || ''}`);

        // ── Route (from pickup → delivery or rider → delivery) ───────────────
        const fromLat = (hasRider && props.riderLat) ? props.riderLat : props.pickupLat;
        const fromLon = (hasRider && props.riderLon) ? props.riderLon : props.pickupLon;

        const routeColor = isDelivered ? '#10B981' : isCancelled ? '#EF4444' : '#ccfd3a';
        const routeOpacity = isDelivered || isCancelled ? 0.4 : 0.85;

        const coords = await fetchRoute(fromLat, fromLon, props.deliveryLat, props.deliveryLon);

        const polyline = L.polyline(coords, {
          color: routeColor,
          weight: 4,
          opacity: routeOpacity,
          dashArray: hasRider ? undefined : '10, 8', // Dashed when pending
          lineJoin: 'round',
        }).addTo(map);
        routeLayerRef.current = polyline;

        // Fit map to show full route
        map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

        // ── Rider marker ────────────────────────────────────────────────────
        if (hasRider && props.riderLat && props.riderLon) {
          const rm = L.marker([props.riderLat, props.riderLon], { icon: riderIcon })
            .addTo(map)
            .bindPopup('<b>Rider</b><br/>En route to you');
          riderMarkerRef.current = rm;
        }

        // ── Pending pulsing dot at pickup ───────────────────────────────────
        if (!hasRider && !isDelivered) {
          const pendingIcon = L.divIcon({
            html: `<div style="
              width:20px;height:20px;border-radius:50%;
              background:#F59E0B;border:3px solid #fff;
              animation:renax-pending-pulse 2s infinite;
              box-shadow:0 0 20px rgba(245,158,11,0.8);
            "></div>`,
            className: '',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          L.marker([props.pickupLat, props.pickupLon], { icon: pendingIcon }).addTo(map);
        }

        // ── ETA calc ────────────────────────────────────────────────────────
        if (hasRider && props.riderLat && props.riderLon) {
          try {
            const etaUrl = `https://router.project-osrm.org/route/v1/driving/${props.riderLon},${props.riderLat};${props.deliveryLon},${props.deliveryLat}?overview=false`;
            const etaRes = await fetch(etaUrl);
            const etaJson = await etaRes.json();
            if (etaJson.routes?.[0]) {
              const mins = Math.round(etaJson.routes[0].duration / 60);
              setEta(`~${mins} min`);
            }
          } catch {}
        }

        setLoading(false);
      } catch (err) {
        console.error('Map init error:', err);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pickupLat, props.pickupLon, props.deliveryLat, props.deliveryLon, props.status, props.shipmentType]);

  // ── Live-update rider marker without rebuilding map ───────────────────────
  useEffect(() => {
    if (!mapRef.current || !props.riderLat || !props.riderLon) return;
    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([props.riderLat, props.riderLon]);
    }
  }, [props.riderLat, props.riderLon]);

  const cfg = getStatusConfig();

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', background: '#041910' }}>
      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(4,25,16,0.9)',
          gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, border: '3px solid rgba(204,253,58,0.2)',
            borderTopColor: '#ccfd3a', borderRadius: '50%',
            animation: 'renax-spin 0.9s linear infinite',
          }} />
          <span style={{ color: '#ccfd3a', fontFamily: 'sans-serif', fontSize: 14, letterSpacing: 1 }}>
            Loading route...
          </span>
          <style>{`@keyframes renax-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Status pill */}
      {!loading && (
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(4,25,16,0.88)', backdropFilter: 'blur(8px)',
          border: `1px solid ${cfg.color}44`,
          borderRadius: 30, padding: '8px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: `0 4px 24px ${cfg.color}22`,
          zIndex: 1000,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: cfg.color,
            boxShadow: cfg.pulse ? `0 0 10px ${cfg.color}` : 'none',
          }} />
          <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
            {cfg.label}
          </span>
          {eta && (
            <span style={{ color: '#ccfd3a', fontFamily: 'sans-serif', fontSize: 12, marginLeft: 8, opacity: 0.85 }}>
              ETA {eta}
            </span>
          )}
        </div>
      )}

      {/* Inter-state info banner */}
      {isInterState && !loading && (
        <div style={{
          position: 'absolute', bottom: 14, left: 14, right: 14,
          background: 'rgba(180,83,9,0.88)', backdropFilter: 'blur(8px)',
          borderRadius: 12, padding: '12px 18px',
          border: '1px solid rgba(204,253,58,0.2)',
          zIndex: 1000,
        }}>
          <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600 }}>
            Inter-State Route — RENAX Terminal Relay
          </span>
          <br />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'sans-serif', fontSize: 12 }}>
            Your package will be handled via the RENAX relay terminal network.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Smart Export — Web uses Leaflet, Native shows fallback ──────────────────
export default function TrackingMap(props: TrackingMapProps) {
  if (Platform.OS !== 'web') return <NativeFallback />;
  if (!props.pickupLat || !props.pickupLon || !props.deliveryLat || !props.deliveryLon) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#041910', borderRadius: 16 }}>
        <Text style={{ color: 'rgba(200,255,220,0.4)', fontFamily: 'Outfit_4', fontSize: 14 }}>
          No coordinates available for this shipment.
        </Text>
      </View>
    );
  }
  return <WebTrackingMap {...props} />;
}
