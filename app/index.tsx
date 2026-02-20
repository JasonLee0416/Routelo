import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KakaoMap, { KakaoMapRef } from '../components/KakaoMap';
import { KAKAO_CONFIG } from '../kakao-config';

interface Destination {
  id: number;
  address: string;
  lat: number;
  lng: number;
}

interface SearchResult {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
}

export default function Index() {
  // --- 상태 변수 ---
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'settings'>('list');
  const [tempAddress, setTempAddress] = useState('');
  const [tempCoords, setTempCoords] = useState({ lat: 0, lng: 0 });
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- 설정 ---
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [brightness, setBrightness] = useState(0.8);
  const [isExpertMode, setIsExpertMode] = useState(false);

  // --- Refs ---
  const mapRef = useRef<KakaoMapRef>(null);

  // 1. 초기 권한 및 위치 설정
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 거부', '위치 정보 권한이 필요합니다.');
        return;
      }
      let curr = await Location.getCurrentPositionAsync({});
      setLocation(curr);
    })();
  }, []);

  // 2. 거리/시간 계산
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

  const getArrivalTime = (startTime: Date, totalKm: number) => {
    const travelTimeMinutes = totalKm * 3;
    const arrivalDate = new Date(startTime.getTime() + travelTimeMinutes * 60000);
    return `${arrivalDate.getHours()}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;
  };

  // 3. 카카오 로컬 API로 주소/장소 검색
  const searchAddress = async () => {
    if (tempAddress.length < 2) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      // 키워드로 장소 검색 (카카오 로컬 API)
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
          tempAddress
        )}&size=5`,
        {
          headers: {
            Authorization: `KakaoAK ${KAKAO_CONFIG.REST_KEY}`,
          },
        }
      );
      const data = await res.json();

      if (data.documents && data.documents.length > 0) {
        setSearchResults(data.documents);
      } else {
        // 키워드 검색 실패 시 주소 검색 시도
        const addrRes = await fetch(
          `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(
            tempAddress
          )}&size=5`,
          {
            headers: {
              Authorization: `KakaoAK ${KAKAO_CONFIG.REST_KEY}`,
            },
          }
        );
        const addrData = await addrRes.json();

        if (addrData.documents && addrData.documents.length > 0) {
          setSearchResults(
            addrData.documents.map((d: any) => ({
              place_name: d.address_name,
              address_name: d.address_name,
              road_address_name: d.road_address?.address_name || '',
              x: d.x,
              y: d.y,
            }))
          );
        } else {
          Alert.alert('알림', '검색 결과가 없습니다.');
        }
      }
    } catch (e) {
      console.error('Search error:', e);
      Alert.alert('에러', '검색에 실패했습니다. 네트워크를 확인해주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  // 검색 결과 선택
  const selectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.y);
    const lng = parseFloat(result.x);
    setTempCoords({ lat, lng });
    setTempAddress(result.road_address_name || result.address_name || result.place_name);
    setSearchResults([]);

    // 지도 이동
    mapRef.current?.moveTo(lat, lng);
  };

  // 목적지 저장
  const saveDestination = () => {
    if (tempCoords.lat === 0) {
      Alert.alert('알림', '검색 결과에서 위치를 선택해주세요.');
      return;
    }
    setDestinations([
      ...destinations,
      { address: tempAddress, lat: tempCoords.lat, lng: tempCoords.lng, id: Date.now() },
    ]);
    setTempAddress('');
    setTempCoords({ lat: 0, lng: 0 });
    setSearchResults([]);
    setViewMode('list');
  };

  // 경로 최적화 (Nearest Neighbor)
  const optimizeRoute = () => {
    if (!location || destinations.length === 0) return;
    let unvisited = [...destinations];
    let optimized: Destination[] = [];
    let current = { lat: location.coords.latitude, lng: location.coords.longitude };
    while (unvisited.length > 0) {
      let closestIdx = 0;
      let min = Infinity;
      unvisited.forEach((dest, i) => {
        let d = Math.sqrt(
          Math.pow(dest.lat - current.lat, 2) + Math.pow(dest.lng - current.lng, 2)
        );
        if (d < min) {
          min = d;
          closestIdx = i;
        }
      });
      optimized.push(unvisited[closestIdx]);
      current = { lat: unvisited[closestIdx].lat, lng: unvisited[closestIdx].lng };
      unvisited.splice(closestIdx, 1);
    }
    setDestinations(optimized);
    Alert.alert('Routelo', '동선 최적화 완료! ⚡');
  };

  // 카카오맵 앱으로 길안내
  const openKakaoNavi = (dest: Destination) => {
    Alert.alert(
      '길안내',
      `${dest.address}로 길안내를 시작할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '카카오맵으로 열기',
          onPress: () => {
            // 카카오맵 딥링크: kakaomap://route?sp=lat,lng&ep=lat,lng&by=CAR
            // Linking.openURL(...) 사용
          },
        },
      ]
    );
  };

  // --- 스타일 헬퍼 ---
  const t = (light: string, dark: string) => (isDarkMode ? dark : light);

  // ============================================================
  // [화면 1: 메인 리스트]
  // ============================================================
  if (viewMode === 'list') {
    let accumulatedKm = 0;
    const now = new Date();

    return (
      <View style={[styles.container, { backgroundColor: t('#fff', '#121212') }]}>
        <Stack.Screen
          options={{
            title: 'Routelo',
            headerRight: () => (
              <TouchableOpacity onPress={() => setViewMode('settings')}>
                <Ionicons name="settings-outline" size={24} color={t('#333', '#fff')} />
              </TouchableOpacity>
            ),
            headerTitleStyle: { color: '#2ecc71', fontWeight: '900' },
          }}
        />

        <View style={styles.listHeader}>
          <Text style={styles.mainEmoji}>🛵</Text>
          <Text style={styles.mainTitle}>Routelo</Text>
          <Text style={[styles.mainSubtitle, { color: t('#888', '#aaa') }]}>
            오늘의 배달 동선을 확인하세요.
          </Text>
        </View>

        <ScrollView style={styles.listBody}>
          <View style={[styles.card, { backgroundColor: t('#fff', '#1e1e1e') }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.label, { color: t('#333', '#fff') }]}>
                목적지 ({destinations.length})
              </Text>
              {destinations.length > 0 && (
                <TouchableOpacity onPress={optimizeRoute}>
                  <Text style={styles.optLink}>⚡ 최적화</Text>
                </TouchableOpacity>
              )}
            </View>

            {destinations.map((d, i) => {
              let prevLat =
                i === 0 ? (location?.coords.latitude ?? d.lat) : destinations[i - 1].lat;
              let prevLng =
                i === 0 ? (location?.coords.longitude ?? d.lng) : destinations[i - 1].lng;
              const dist = getDistance(prevLat, prevLng, d.lat, d.lng);
              accumulatedKm += dist;

              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.listItem}
                  onPress={() => openKakaoNavi(d)}
                >
                  <View style={styles.indexCircle}>
                    <Text style={styles.indexText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.listAddr, { color: t('#333', '#fff') }]}
                      numberOfLines={1}
                    >
                      {d.address}
                    </Text>
                    <Text style={{ fontSize: 12, color: t('#888', '#aaa') }}>
                      +{dist}km (누적 {accumulatedKm.toFixed(1)}km){' '}
                      <Text style={{ color: '#2ecc71' }}>
                        🕒 {getArrivalTime(now, accumulatedKm)} 도착
                      </Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setDestinations(destinations.filter((item) => item.id !== d.id))
                    }
                  >
                    <Ionicons name="close-circle" size={22} color="#ccc" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: t('#f9f9f9', '#2a2a2a') }]}
              onPress={() => setViewMode('detail')}
            >
              <Text style={{ color: '#2ecc71', fontWeight: 'bold' }}>+ 목적지 추가</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ============================================================
  // [화면 2: 카카오맵 + 검색]
  // ============================================================
  if (viewMode === 'detail') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '목적지 설정', headerShown: false }} />

        {/* 카카오맵 WebView */}
        <KakaoMap
          ref={mapRef}
          latitude={tempCoords.lat || location?.coords.latitude || 37.5665}
          longitude={tempCoords.lng || location?.coords.longitude || 126.978}
          markers={destinations.map((d, i) => ({
            id: d.id,
            lat: d.lat,
            lng: d.lng,
            label: (i + 1).toString(),
          }))}
          showUserLocation={true}
          onMapPress={(lat, lng) => {
            setTempCoords({ lat, lng });
            // 역지오코딩으로 주소 가져오기
            fetch(
              `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
              { headers: { Authorization: `KakaoAK ${KAKAO_CONFIG.REST_KEY}` } }
            )
              .then((r) => r.json())
              .then((data) => {
                if (data.documents?.[0]) {
                  const addr =
                    data.documents[0].road_address?.address_name ||
                    data.documents[0].address?.address_name ||
                    '';
                  setTempAddress(addr);
                }
              })
              .catch(() => {});
          }}
        />

        {/* 플로팅 검색바 */}
        <View style={styles.floatingSearchContainer}>
          <TouchableOpacity
            onPress={() => {
              setViewMode('list');
              setSearchResults([]);
            }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={20} color="#888" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.floatingInput}
              placeholder="장소 또는 주소 검색"
              value={tempAddress}
              onChangeText={(text) => {
                setTempAddress(text);
                if (text.length === 0) setSearchResults([]);
              }}
              onSubmitEditing={searchAddress}
              returnKeyType="search"
            />
            {tempAddress.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setTempAddress('');
                  setSearchResults([]);
                }}
                style={{ paddingHorizontal: 8 }}
              >
                <Ionicons name="close-circle" size={20} color="#ccc" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.searchSubmitBtn} onPress={searchAddress}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>검색</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 검색 결과 드롭다운 */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.x}-${item.y}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => selectSearchResult(item)}
                >
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color="#2ecc71"
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {item.place_name}
                    </Text>
                    <Text style={styles.searchResultAddr} numberOfLines={1}>
                      {item.road_address_name || item.address_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* 선택된 위치 정보 & 확정 버튼 */}
        {tempCoords.lat !== 0 && (
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.selectedAddrText} numberOfLines={2}>
              📍 {tempAddress || '선택된 위치'}
            </Text>
            <TouchableOpacity style={styles.saveBtn} onPress={saveDestination}>
              <Text style={styles.saveBtnText}>이 위치로 목적지 추가</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ============================================================
  // [화면 3: 설정]
  // ============================================================
  return (
    <ScrollView style={[styles.container, { backgroundColor: t('#f8f9fa', '#121212') }]}>
      <Stack.Screen options={{ title: '설정' }} />
      <View style={styles.settingHeader}>
        <TouchableOpacity onPress={() => setViewMode('list')}>
          <Ionicons name="close" size={28} color={t('#333', '#fff')} />
        </TouchableOpacity>
        <Text style={[styles.settingHeaderText, { color: t('#333', '#fff') }]}>앱 설정</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={[styles.settingSection, { backgroundColor: t('#fff', '#1e1e1e') }]}>
        <Text style={styles.sectionTitle}>디스플레이</Text>
        <View style={styles.settingRow}>
          <Text style={[styles.label, { color: t('#333', '#fff') }]}>다크 모드</Text>
          <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
        </View>
        <View style={{ marginTop: 15 }}>
          <Text style={[styles.label, { color: t('#333', '#fff') }]}>
            화면 밝기 ({Math.round(brightness * 100)}%)
          </Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={1}
            value={brightness}
            onValueChange={setBrightness}
            minimumTrackTintColor="#2ecc71"
          />
        </View>
      </View>

      <View style={[styles.settingSection, { backgroundColor: t('#fff', '#1e1e1e') }]}>
        <Text style={styles.sectionTitle}>내비게이션</Text>
        <View style={styles.settingRow}>
          <Text style={[styles.label, { color: t('#333', '#fff') }]}>기공물 특수 배송 모드</Text>
          <Switch value={isExpertMode} onValueChange={setIsExpertMode} />
        </View>
        <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>
          * 치기공소 배달 시 최적의 경로 알고리즘을 적용합니다.
        </Text>
      </View>

      <View style={[styles.settingSection, { backgroundColor: t('#fff', '#1e1e1e') }]}>
        <Text style={styles.sectionTitle}>정보</Text>
        <Text style={{ color: t('#666', '#999'), fontSize: 13 }}>
          Routelo v1.0.0{'\n'}카카오맵 API 기반 배달 내비게이션
        </Text>
      </View>
    </ScrollView>
  );
}

// ============================================================
// 스타일
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // 리스트
  listHeader: { paddingTop: 40, paddingBottom: 20, alignItems: 'center' },
  mainEmoji: { fontSize: 50 },
  mainTitle: { fontSize: 32, fontWeight: '900', color: '#2ecc71' },
  mainSubtitle: { fontSize: 14 },
  listBody: { padding: 20 },
  card: {
    borderRadius: 25,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  label: { fontWeight: 'bold', fontSize: 16 },
  optLink: { color: '#2ecc71', fontWeight: 'bold' },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  indexCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2ecc71',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indexText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  listAddr: { fontWeight: 'bold', fontSize: 15, marginBottom: 2 },
  addBtn: { padding: 16, alignItems: 'center', borderRadius: 15, marginTop: 10 },

  // 검색 & 지도
  floatingSearchContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 15,
    elevation: 5,
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 5,
    paddingLeft: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  floatingInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15 },
  searchSubmitBtn: {
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginRight: 5,
  },

  // 검색 결과
  searchResultsContainer: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 5,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  searchResultName: { fontSize: 15, fontWeight: '600', color: '#333' },
  searchResultAddr: { fontSize: 12, color: '#888', marginTop: 2 },

  // 하단 시트
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: 40,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  selectedAddrText: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 15 },
  saveBtn: {
    backgroundColor: '#2ecc71',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },

  // 설정
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  settingHeaderText: { fontSize: 22, fontWeight: 'bold' },
  settingSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#2ecc71',
    fontWeight: 'bold',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
