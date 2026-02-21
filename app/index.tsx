import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KakaoMap, { KakaoMapRef } from './components/KakaoMap';
import { KAKAO_CONFIG } from './kakao-config';

type ViewMode = 'list' | 'map' | 'settings';
type ThemeMode = 'light' | 'dark';

type Theme = {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  danger: string;
};

type Destination = {
  id: number;
  address: string;
  lat: number;
  lng: number;
};

type SearchResult = {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string;
  y: string;
};

const LIGHT_THEME: Theme = {
  bg: '#f4f6f8',
  card: '#ffffff',
  cardAlt: '#eef2f5',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#dbe1e8',
  accent: '#14a760',
  danger: '#c0392b',
};

const DARK_THEME: Theme = {
  bg: '#0f1217',
  card: '#171c22',
  cardAlt: '#212832',
  text: '#ecf2f8',
  textMuted: '#98a6b8',
  border: '#2b3441',
  accent: '#29cc7a',
  danger: '#ff7373',
};

const BRAND_NAME = '√lo';
const TMAP_ANDROID_MARKET_URL = 'market://details?id=com.skt.tmap.ku';
const TMAP_ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';
const TMAP_IOS_STORE_URL = 'https://apps.apple.com/kr/app/id431589174';

function toAddressText(item: SearchResult) {
  return item.road_address_name || item.address_name || item.place_name;
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [brightness, setBrightness] = useState(0.8);
  const [isExpertMode, setIsExpertMode] = useState(false);

  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState('');
  const mapErrorShownRef = useRef(false);
  const mapRef = useRef<KakaoMapRef>(null);

  const isDarkMode = themeMode === 'dark';
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;

      if (status !== 'granted') {
        Alert.alert('권한 필요', '현재 위치 권한이 있어야 경로 최적화를 정확히 할 수 있습니다.');
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({});
        if (mounted) setCurrentLocation(loc);
      } catch {
        if (mounted) {
          Alert.alert('위치 오류', '현재 위치를 가져오지 못했습니다.');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  const getEta = (startTime: Date, totalKm: number) => {
    const minutes = Math.round(totalKm * 3);
    const t = new Date(startTime.getTime() + minutes * 60000);
    return `${t.getHours()}:${t.getMinutes().toString().padStart(2, '0')}`;
  };

  const searchNominatim = async (keyword: string): Promise<SearchResult[]> => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=7&q=${encodeURIComponent(keyword)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      place_name: String(item.display_name || keyword),
      address_name: String(item.display_name || keyword),
      road_address_name: String(item.display_name || ''),
      x: String(item.lon),
      y: String(item.lat),
    }));
  };

  const searchAddress = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const keywordRes = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(trimmed)}&size=7`,
        { headers: { Authorization: `KakaoAK ${KAKAO_CONFIG.REST_KEY}` } }
      );
      const keywordData = await keywordRes.json().catch(() => ({}));

      if (!keywordRes.ok) {
        throw new Error(`Kakao keyword HTTP ${keywordRes.status}`);
      }

      if (keywordData?.documents?.length > 0) {
        setSearchResults(keywordData.documents);
        return;
      }

      const addressRes = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(trimmed)}&size=7`,
        { headers: { Authorization: `KakaoAK ${KAKAO_CONFIG.REST_KEY}` } }
      );
      const addressData = await addressRes.json().catch(() => ({}));

      if (!addressRes.ok) {
        throw new Error(`Kakao address HTTP ${addressRes.status}`);
      }

      if (addressData?.documents?.length > 0) {
        const mapped = addressData.documents.map((d: any) => ({
          place_name: d.address_name,
          address_name: d.address_name,
          road_address_name: d.road_address?.address_name || '',
          x: d.x,
          y: d.y,
        }));
        setSearchResults(mapped);
      } else {
        const fallback = await searchNominatim(trimmed);
        if (fallback.length > 0) {
          setSearchResults(fallback);
          Alert.alert('대체 검색 사용', '카카오 결과가 없어 대체 검색 결과를 표시합니다.');
        } else {
          Alert.alert('검색 결과 없음', '다른 키워드로 다시 검색해 주세요.');
        }
      }
    } catch (error: any) {
      try {
        const fallback = await searchNominatim(trimmed);
        if (fallback.length > 0) {
          setSearchResults(fallback);
          Alert.alert('대체 검색 사용', '카카오 검색 실패로 대체 검색 결과를 표시합니다.');
          return;
        }
      } catch {
        // no-op
      }
      const message = typeof error?.message === 'string' ? error.message : 'unknown error';
      Alert.alert('검색 실패', `네트워크 또는 API 설정을 확인해 주세요.\n(${message})`);
    } finally {
      setIsSearching(false);
    }
  };

  const addDestination = (address: string, lat: number, lng: number) => {
    setDestinations((prev) => [...prev, { id: Date.now() + Math.random(), address, lat, lng }]);
  };

  const addFromSearchResult = (item: SearchResult) => {
    const lat = parseFloat(item.y);
    const lng = parseFloat(item.x);
    const address = toAddressText(item);

    addDestination(address, lat, lng);
    setQuery('');
    setSearchResults([]);
    setSelectedPoint(null);
    mapRef.current?.moveTo(lat, lng);
  };

  const focusSearchResultOnMap = (item: SearchResult) => {
    const lat = parseFloat(item.y);
    const lng = parseFloat(item.x);
    setQuery(toAddressText(item));
    setSearchResults([]);
    setSelectedPoint({ lat, lng });
    mapRef.current?.moveTo(lat, lng);
  };

  const removeDestination = (id: number) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  };

  const optimizeRoute = () => {
    if (!currentLocation || destinations.length === 0) return;

    const sorted: Destination[] = [];
    const remaining = [...destinations];
    let cursor = {
      lat: currentLocation.coords.latitude,
      lng: currentLocation.coords.longitude,
    };

    while (remaining.length > 0) {
      let closestIndex = 0;
      let minDistance = Infinity;

      remaining.forEach((d, i) => {
        const dist = Math.sqrt(Math.pow(d.lat - cursor.lat, 2) + Math.pow(d.lng - cursor.lng, 2));
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = i;
        }
      });

      const next = remaining.splice(closestIndex, 1)[0];
      sorted.push(next);
      cursor = { lat: next.lat, lng: next.lng };
    }

    setDestinations(sorted);
    Alert.alert(BRAND_NAME, '목적지를 가까운 순서로 정렬했습니다.');
  };

  const openUrlSafely = async (url: string) => {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  };

  const openTmapNavigation = async (dest: Destination) => {
    const encoded = encodeURIComponent(dest.address);
    const deepLinks = [
      `tmap://route?rGoName=${encoded}&rGoX=${dest.lng}&rGoY=${dest.lat}`,
      `tmap://?rGoName=${encoded}&rGoX=${dest.lng}&rGoY=${dest.lat}`,
    ];

    for (const link of deepLinks) {
      const ok = await openUrlSafely(link);
      if (ok) return;
    }

    if (Platform.OS === 'android') {
      const marketOpened = await openUrlSafely(TMAP_ANDROID_MARKET_URL);
      if (!marketOpened) await openUrlSafely(TMAP_ANDROID_STORE_URL);
    } else {
      await openUrlSafely(TMAP_IOS_STORE_URL);
    }
  };

  const confirmOpenNavigation = (dest: Destination) => {
    Alert.alert('길안내 시작', `${dest.address}까지 Tmap으로 이동할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '이동', onPress: () => void openTmapNavigation(dest) },
    ]);
  };

  const handleMapReady = () => {
    setIsMapReady(true);
    setMapErrorMessage('');
    mapErrorShownRef.current = false;
  };

  const handleMapError = (message: string) => {
    setIsMapReady(false);
    setMapErrorMessage(message);
    if (mapErrorShownRef.current) return;
    mapErrorShownRef.current = true;
    Alert.alert(
      '지도 로딩 실패',
      `${message}\n\nKakao 개발자 콘솔에서 "플랫폼 > Web > 사이트 도메인"에 https://localhost 를 등록했는지 확인해 주세요.`
    );
  };

  const fetchAddressByCoord = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
        { headers: { Authorization: `KakaoAK ${KAKAO_CONFIG.REST_KEY}` } }
      );
      const data = await res.json();
      const doc = data?.documents?.[0];
      if (!doc) return;

      const address = doc.road_address?.address_name || doc.address?.address_name || '';
      if (address) setQuery(address);
    } catch {
      // no-op
    }
  };

  const saveSelectedPoint = () => {
    if (!selectedPoint) {
      Alert.alert('선택 필요', '지도에서 위치를 먼저 선택해 주세요.');
      return;
    }
    const address = query.trim() || `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}`;
    addDestination(address, selectedPoint.lat, selectedPoint.lng);
    setQuery('');
    setSearchResults([]);
    setSelectedPoint(null);
    setViewMode('list');
  };

  if (viewMode === 'list') {
    let accumulatedKm = 0;
    const now = new Date();

    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: BRAND_NAME,
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            headerTitleStyle: {
              color: theme.accent,
              fontFamily: Platform.select({
                ios: 'SnellRoundhand-Bold',
                android: 'cursive',
                default: 'serif',
              }),
              fontSize: 30,
            },
          }}
        />

        <TouchableOpacity style={styles.floatingSettingsBtn} onPress={() => setViewMode('settings')}>
          <Ionicons name="settings-outline" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{BRAND_NAME}</Text>
          <Text style={styles.heroSubtitle}>같은 길도, 적은 힘으로, 오늘도 안전운전!</Text>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.card}>
            <Text style={[styles.label, { marginBottom: 10 }]}>주소 검색</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (!text.trim()) setSearchResults([]);
                }}
                placeholder="주소/장소를 검색해서 목적지 추가"
                placeholderTextColor={theme.textMuted}
                onSubmitEditing={searchAddress}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.searchBtn, (isSearching || query.trim().length < 2) && { opacity: 0.5 }]}
                onPress={searchAddress}
                disabled={isSearching || query.trim().length < 2}
              >
                <Text style={styles.searchBtnText}>{isSearching ? '검색중' : '검색'}</Text>
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 ? (
              <View style={styles.resultWrap}>
                {searchResults.map((item, idx) => (
                  <TouchableOpacity
                    key={`${item.x}-${item.y}-${idx}`}
                    style={styles.resultItem}
                    onPress={() => addFromSearchResult(item)}
                  >
                    <Ionicons name="location-outline" size={18} color={theme.accent} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.place_name}
                      </Text>
                      <Text style={styles.resultAddr} numberOfLines={1}>
                        {toAddressText(item)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.label}>목적지 ({destinations.length})</Text>
              {destinations.length > 0 ? (
                <TouchableOpacity onPress={optimizeRoute}>
                  <Text style={styles.linkText}>최적화</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {destinations.length === 0 ? (
              <Text style={{ color: theme.textMuted }}>검색 결과를 탭해서 목적지를 추가해 주세요.</Text>
            ) : (
              destinations.map((d, i) => {
                const prevLat = i === 0 ? (currentLocation?.coords.latitude ?? d.lat) : destinations[i - 1].lat;
                const prevLng = i === 0 ? (currentLocation?.coords.longitude ?? d.lng) : destinations[i - 1].lng;
                const dist = getDistanceKm(prevLat, prevLng, d.lat, d.lng);
                accumulatedKm += dist;

                return (
                  <TouchableOpacity key={d.id} style={styles.destRow} onPress={() => confirmOpenNavigation(d)}>
                    <View style={styles.numBadge}>
                      <Text style={styles.numBadgeText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.destAddress} numberOfLines={1}>
                        {d.address}
                      </Text>
                      <Text style={styles.destMeta}>
                        +{dist}km (누적 {accumulatedKm.toFixed(1)}km) · {getEta(now, accumulatedKm)} 도착 예상
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeDestination(d.id)}>
                      <Ionicons name="close-circle" size={22} color={theme.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity style={styles.addBtn} onPress={() => setViewMode('map')}>
              <Text style={{ color: theme.accent, fontWeight: '700' }}>지도에서 목적지 추가</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (viewMode === 'map') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        <KakaoMap
          ref={mapRef}
          latitude={selectedPoint?.lat || currentLocation?.coords.latitude || 37.5665}
          longitude={selectedPoint?.lng || currentLocation?.coords.longitude || 126.978}
          markers={destinations.map((d, i) => ({
            id: d.id,
            lat: d.lat,
            lng: d.lng,
            label: `${i + 1}`,
          }))}
          showUserLocation={true}
          onMapReady={handleMapReady}
          onMapError={handleMapError}
          onMapPress={(lat, lng) => {
            setSelectedPoint({ lat, lng });
            void fetchAddressByCoord(lat, lng);
          }}
        />

        <View style={styles.floatingTopRow}>
          <TouchableOpacity
            onPress={() => {
              setViewMode('list');
              setSearchResults([]);
            }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.floatingSearch}>
            <Ionicons name="search" size={20} color={theme.textMuted} style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.floatingInput}
              placeholder="장소 또는 주소 검색"
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (!text.trim()) setSearchResults([]);
              }}
              onSubmitEditing={searchAddress}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchMiniBtn} onPress={searchAddress}>
              <Text style={styles.searchMiniBtnText}>검색</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.mapSettingsBtn} onPress={() => setViewMode('settings')}>
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        {searchResults.length > 0 ? (
          <View style={styles.floatingResults}>
            <ScrollView>
              {searchResults.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.x}-${item.y}-${idx}`}
                  style={styles.resultItem}
                  onPress={() => focusSearchResultOnMap(item)}
                >
                  <Ionicons name="location-outline" size={18} color={theme.accent} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.place_name}
                    </Text>
                    <Text style={styles.resultAddr} numberOfLines={1}>
                      {toAddressText(item)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {selectedPoint ? (
          <View style={styles.bottomSheet}>
            <View style={styles.bottomHandle} />
            <Text style={styles.bottomText} numberOfLines={2}>
              {query || `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}`}
            </Text>
            <TouchableOpacity style={styles.saveBtn} onPress={saveSelectedPoint}>
              <Text style={styles.saveBtnText}>이 위치를 목적지로 추가</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: '설정',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />

      <View style={styles.settingsHead}>
        <TouchableOpacity onPress={() => setViewMode('list')}>
          <Ionicons name="close" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.settingsHeadText}>앱 설정</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsTitle}>디스플레이</Text>
        <Text style={styles.settingsHint}>테마 선택</Text>
        <View style={styles.themePickerRow}>
          <TouchableOpacity
            style={[styles.themeOptionBtn, themeMode === 'light' && styles.themeOptionBtnActive]}
            onPress={() => setThemeMode('light')}
          >
            <Ionicons
              name="sunny-outline"
              size={16}
              color={themeMode === 'light' ? '#ffffff' : theme.text}
            />
            <Text
              style={[
                styles.themeOptionText,
                { color: themeMode === 'light' ? '#ffffff' : theme.text },
              ]}
            >
              라이트
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.themeOptionBtn, themeMode === 'dark' && styles.themeOptionBtnActive]}
            onPress={() => setThemeMode('dark')}
          >
            <Ionicons
              name="moon-outline"
              size={16}
              color={themeMode === 'dark' ? '#ffffff' : theme.text}
            />
            <Text
              style={[
                styles.themeOptionText,
                { color: themeMode === 'dark' ? '#ffffff' : theme.text },
              ]}
            >
              다크
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>밝기 ({Math.round(brightness * 100)}%)</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={1}
            value={brightness}
            onValueChange={setBrightness}
            minimumTrackTintColor={theme.accent}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsTitle}>배달 옵션</Text>
        <View style={styles.settingsRow}>
          <Text style={styles.label}>전문 모드</Text>
          <Switch
            value={isExpertMode}
            onValueChange={setIsExpertMode}
            trackColor={{ false: '#8a8f98', true: theme.accent }}
            thumbColor="#ffffff"
          />
        </View>
        <Text style={styles.settingsHint}>
          전문 모드를 켜면 목적지가 많을 때 더 공격적으로 가까운 순 정렬을 수행합니다.
        </Text>
      </View>

    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    floatingSettingsBtn: {
      position: 'absolute',
      top: 14,
      right: 14,
      zIndex: 20,
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    hero: { alignItems: 'center', paddingTop: 18, paddingBottom: 10 },
    heroTitle: {
      color: theme.accent,
      fontSize: 46,
      fontFamily: Platform.select({
        ios: 'SnellRoundhand-Bold',
        android: 'cursive',
        default: 'serif',
      }),
      fontWeight: '800',
    },
    heroSubtitle: { color: theme.textMuted, fontSize: 13, marginTop: -4 },
    body: { paddingHorizontal: 16 },
    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    label: { color: theme.text, fontWeight: '700', fontSize: 16 },
    linkText: { color: theme.accent, fontWeight: '700' },
    mapPreview: {
      height: 210,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: '#0f1115',
    },
    mapInner: { flex: 1 },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    loadingText: {
      color: '#fff',
      fontWeight: '700',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    errorBox: {
      backgroundColor: '#ffefef',
      borderColor: '#f5c2c2',
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
    },
    errorTitle: { color: '#a12323', fontWeight: '700', marginBottom: 4 },
    errorText: { color: '#a12323', fontSize: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    searchInput: {
      flex: 1,
      backgroundColor: theme.cardAlt,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      color: theme.text,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
    },
    searchBtn: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    searchBtnText: { color: '#fff', fontWeight: '700' },
    resultWrap: {
      marginTop: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.cardAlt,
    },
    resultName: { color: theme.text, fontWeight: '700', fontSize: 14 },
    resultAddr: { color: theme.textMuted, fontSize: 12, marginTop: 1 },
    destRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 12,
      paddingBottom: 8,
    },
    numBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    numBadgeText: { color: '#fff', fontWeight: '700', fontSize: 11 },
    destAddress: { color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 2 },
    destMeta: { color: theme.textMuted, fontSize: 12 },
    addBtn: {
      marginTop: 6,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardAlt,
    },
    floatingTopRow: {
      position: 'absolute',
      top: 60,
      left: 16,
      right: 16,
      zIndex: 10,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      marginRight: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    floatingSearch: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    floatingInput: {
      flex: 1,
      color: theme.text,
      paddingHorizontal: 8,
      paddingVertical: 11,
      fontSize: 15,
    },
    searchMiniBtn: {
      marginRight: 6,
      borderRadius: 10,
      backgroundColor: theme.accent,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    searchMiniBtnText: { color: '#fff', fontWeight: '700' },
    mapSettingsBtn: {
      marginLeft: 10,
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    floatingResults: {
      position: 'absolute',
      top: 120,
      left: 16,
      right: 16,
      maxHeight: 250,
      zIndex: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      overflow: 'hidden',
    },
    bottomSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 34,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: theme.cardAlt,
      borderTopWidth: 1,
      borderColor: theme.border,
    },
    bottomHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.textMuted,
      alignSelf: 'center',
      marginBottom: 12,
    },
    bottomText: { color: theme.text, fontWeight: '600', fontSize: 15, marginBottom: 12 },
    saveBtn: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      alignItems: 'center',
      paddingVertical: 14,
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    settingsHead: {
      marginTop: 52,
      marginHorizontal: 20,
      marginBottom: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingsHeadText: { color: theme.text, fontWeight: '700', fontSize: 21 },
    settingsSection: {
      marginHorizontal: 20,
      marginBottom: 16,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    settingsTitle: {
      color: theme.accent,
      textTransform: 'uppercase',
      fontWeight: '700',
      fontSize: 12,
      marginBottom: 12,
    },
    settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    themePickerRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    themeOptionBtn: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardAlt,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    themeOptionBtnActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    themeOptionText: {
      fontWeight: '700',
      fontSize: 13,
    },
    settingsHint: { color: theme.textMuted, fontSize: 12, marginTop: 8 },
    dangerText: { color: theme.danger },
  });
