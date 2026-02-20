import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface Destination {
  id: number;
  address: string;
  lat: number;
  lng: number;
}

export default function Index() {
  // --- 기존 상태 변수 ---
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'settings'>('list');
  const [tempAddress, setTempAddress] = useState('');
  const [tempCoords, setTempCoords] = useState({ lat: 0, lng: 0 });

  // --- 새로운 설정 관련 상태 ---
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [brightness, setBrightness] = useState(0.8);
  const [isExpertMode, setIsExpertMode] = useState(false); // 기공물 특수 배송 모드

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

  // 2. 거리/시간 계산 로직 (기존 유지)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  const getArrivalTime = (startTime: Date, totalKm: number) => {
    const travelTimeMinutes = totalKm * 3;
    const arrivalDate = new Date(startTime.getTime() + travelTimeMinutes * 60000);
    return `${arrivalDate.getHours()}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;
  };

  // 3. 주요 기능 함수들
  const searchAddress = async () => {
    if (tempAddress.length < 2) return;
    try {
      let result = await Location.geocodeAsync(tempAddress);
      if (result.length > 0) {
        setTempCoords({ lat: result[0].latitude, lng: result[0].longitude });
      } else { Alert.alert("알림", "주소를 찾을 수 없습니다."); }
    } catch (e) { Alert.alert("에러", "검색 실패"); }
  };

  const saveDestination = () => {
    if (tempCoords.lat === 0) {
      Alert.alert("알림", "돋보기 버튼을 눌러 위치를 먼저 확인해 주세요.");
      return;
    }
    setDestinations([...destinations, { address: tempAddress, lat: tempCoords.lat, lng: tempCoords.lng, id: Date.now() }]);
    setTempAddress(''); setTempCoords({ lat: 0, lng: 0 });
    setViewMode('list');
  };

  const optimizeRoute = () => {
    if (!location || destinations.length === 0) return;
    let unvisited = [...destinations];
    let optimized: Destination[] = [];
    let current = { lat: location.coords.latitude, lng: location.coords.longitude };
    while (unvisited.length > 0) {
      let closestIdx = 0; let min = Infinity;
      unvisited.forEach((dest, i) => {
        let d = Math.sqrt(Math.pow(dest.lat - current.lat, 2) + Math.pow(dest.lng - current.lng, 2));
        if (d < min) { min = d; closestIdx = i; }
      });
      optimized.push(unvisited[closestIdx]);
      current = { lat: unvisited[closestIdx].lat, lng: unvisited[closestIdx].lng };
      unvisited.splice(closestIdx, 1);
    }
    setDestinations(optimized);
    Alert.alert("√lo", "동선 최적화 완료! ⚡");
  };

  // --- UI 구성 요소 ---

  // 공통 다크모드 스타일 적용 함수
  const t = (light: string, dark: string) => (isDarkMode ? dark : light);

  // [화면 1: 메인 리스트]
  if (viewMode === 'list') {
    let accumulatedKm = 0;
    const now = new Date();

    return (
      <View style={[styles.container, { backgroundColor: t('#fff', '#121212') }]}>
        <Stack.Screen options={{ 
          title: "√lo", 
          headerRight: () => (
            <TouchableOpacity onPress={() => setViewMode('settings')}>
              <Ionicons name="settings-outline" size={24} color={t('#333', '#fff')} />
            </TouchableOpacity>
          ),
          headerTitleStyle: { color: '#2ecc71', fontWeight: '900' } 
        }} />
        <View style={styles.listHeader}>
          <Text style={styles.mainEmoji}>🛵</Text>
          <Text style={styles.mainTitle}>√lo</Text>
          <Text style={[styles.mainSubtitle, { color: t('#888', '#aaa') }]}>오늘의 배달 동선을 확인하세요.</Text>
        </View>
        <ScrollView style={styles.listBody}>
          <View style={[styles.card, { backgroundColor: t('#fff', '#1e1e1e') }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.label, { color: t('#333', '#fff') }]}>목적지 ({destinations.length})</Text>
              {destinations.length > 0 && (
                <TouchableOpacity onPress={optimizeRoute}><Text style={styles.optLink}>⚡ 최적화</Text></TouchableOpacity>
              )}
            </View>
            {destinations.map((d, i) => {
              let prevLat = i === 0 ? (location?.coords.latitude ?? d.lat) : destinations[i - 1].lat;
              let prevLng = i === 0 ? (location?.coords.longitude ?? d.lng) : destinations[i - 1].lng;
              const dist = getDistance(prevLat, prevLng, d.lat, d.lng);
              accumulatedKm += dist;
              return (
                <View key={d.id} style={styles.listItem}>
                  <View style={styles.indexCircle}><Text style={styles.indexText}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listAddr, { color: t('#333', '#fff') }]} numberOfLines={1}>{d.address}</Text>
                    <Text style={{ fontSize: 12, color: t('#888', '#aaa') }}>+{dist}km (누적 {accumulatedKm.toFixed(1)}km)  <Text style={{ color: '#2ecc71' }}>🕒 {getArrivalTime(now, accumulatedKm)} 도착</Text></Text>
                  </View>
                  <TouchableOpacity onPress={() => setDestinations(destinations.filter(item => item.id !== d.id))}>
                    <Ionicons name="close-circle" size={22} color="#ccc" />
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: t('#f9f9f9', '#2a2a2a') }]} onPress={() => setViewMode('detail')}>
              <Text style={{ color: '#2ecc71', fontWeight: 'bold' }}>+ 목적지 추가</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // [화면 2: 개선된 지도/검색 모드]
  if (viewMode === 'detail') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "목적지 설정" }} />
        
        {/* 레이어 형태의 세련된 검색바 */}
        <View style={styles.floatingSearchContainer}>
          <TouchableOpacity onPress={() => setViewMode('list')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={20} color="#888" style={{ marginLeft: 10 }} />
            <TextInput 
              style={styles.floatingInput} 
              placeholder="주소 입력 (예: 강남대로 123)" 
              value={tempAddress} 
              onChangeText={setTempAddress}
              onSubmitEditing={searchAddress}
            />
            <TouchableOpacity style={styles.searchSubmitBtn} onPress={searchAddress}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>검색</Text>
            </TouchableOpacity>
          </View>
        </View>

        <MapView 
          style={{ flex: 1 }} 
          region={{ 
            latitude: tempCoords.lat || (location?.coords.latitude ?? 37.5665), 
            longitude: tempCoords.lng || (location?.coords.longitude ?? 126.9780), 
            latitudeDelta: 0.01, longitudeDelta: 0.01 
          }} 
          showsUserLocation={true}
        >
          {tempCoords.lat !== 0 && <Marker coordinate={{ latitude: tempCoords.lat, longitude: tempCoords.lng }} />}
        </MapView>

        <TouchableOpacity style={styles.saveBtn} onPress={saveDestination}>
          <Text style={styles.saveBtnText}>이 위치로 주소 확정</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // [화면 3: 설정 모드]
  return (
    <ScrollView style={[styles.container, { backgroundColor: t('#f8f9fa', '#121212') }]}>
      <Stack.Screen options={{ title: "설정" }} />
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
          <Text style={[styles.label, { color: t('#333', '#fff') }]}>화면 밝기 ({Math.round(brightness * 100)}%)</Text>
          <Slider 
            style={{ width: '100%', height: 40 }} 
            minimumValue={0} maximumValue={1} 
            value={brightness} onValueChange={setBrightness}
            minimumTrackTintColor="#2ecc71"
          />
        </View>
      </View>

      <View style={[styles.settingSection, { backgroundColor: t('#fff', '#1e1e1e') }]}>
        <Text style={styles.sectionTitle}>사용자 맞춤 설정</Text>
        <View style={styles.settingRow}>
          <Text style={[styles.label, { color: t('#333', '#fff') }]}>기공물 특수 배송 모드</Text>
          <Switch value={isExpertMode} onValueChange={setIsExpertMode} />
        </View>
        <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>* 치기공소 배달 시 최적의 경로 알고리즘을 적용합니다.</Text>
      </View>
    </ScrollView>
  );
}

// --- 스타일 정의 ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  // 리스트 스타일
  listHeader: { paddingTop: 40, paddingBottom: 20, alignItems: 'center' },
  mainEmoji: { fontSize: 50 }, 
  mainTitle: { fontSize: 32, fontWeight: '900', color: '#2ecc71' }, 
  mainSubtitle: { fontSize: 14 },
  listBody: { padding: 20 }, 
  card: { borderRadius: 25, padding: 20, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }, 
  label: { fontWeight: 'bold', fontSize: 16 }, 
  optLink: { color: '#2ecc71', fontWeight: 'bold' },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, 
  indexCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#2ecc71', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  indexText: { color: '#fff', fontSize: 11, fontWeight: 'bold' }, 
  listAddr: { fontWeight: 'bold', fontSize: 15, marginBottom: 2 }, 
  addBtn: { padding: 16, alignItems: 'center', borderRadius: 15, marginTop: 10 },

  // 개선된 지도/검색 스타일
  floatingSearchContainer: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center' },
  backBtn: { backgroundColor: '#fff', padding: 12, borderRadius: 15, elevation: 5, marginRight: 10 },
  searchBarWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, elevation: 5, paddingLeft: 5 },
  floatingInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15 },
  searchSubmitBtn: { backgroundColor: '#2ecc71', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, marginRight: 5 },
  saveBtn: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#2ecc71', padding: 20, borderRadius: 20, alignItems: 'center', elevation: 5 }, 
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  // 설정 스타일
  settingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  settingHeaderText: { fontSize: 22, fontWeight: 'bold' },
  settingSection: { marginHorizontal: 20, marginBottom: 20, padding: 20, borderRadius: 20, elevation: 2 },
  sectionTitle: { fontSize: 13, color: '#2ecc71', fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});