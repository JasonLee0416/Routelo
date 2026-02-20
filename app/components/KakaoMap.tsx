// components/KakaoMap.tsx
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { KAKAO_CONFIG } from '../kakao-config';

interface KakaoMapProps {
  latitude: number;
  longitude: number;
  markers?: Array<{
    id: number;
    lat: number;
    lng: number;
    label?: string;
  }>;
  showUserLocation?: boolean;
  onMapPress?: (lat: number, lng: number) => void;
  style?: any;
}

export interface KakaoMapRef {
  moveTo: (lat: number, lng: number) => void;
  addMarker: (lat: number, lng: number, label: string) => void;
  clearMarkers: () => void;
  drawRoute: (points: Array<{ lat: number; lng: number }>) => void;
}

const KakaoMap = forwardRef<KakaoMapRef, KakaoMapProps>(
  ({ latitude, longitude, markers = [], showUserLocation = true, onMapPress, style }, ref) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      moveTo: (lat: number, lng: number) => {
        webViewRef.current?.injectJavaScript(`
          map.setCenter(new kakao.maps.LatLng(${lat}, ${lng}));
          true;
        `);
      },
      addMarker: (lat: number, lng: number, label: string) => {
        webViewRef.current?.injectJavaScript(`
          addNumberedMarker(${lat}, ${lng}, "${label}");
          true;
        `);
      },
      clearMarkers: () => {
        webViewRef.current?.injectJavaScript(`
          clearAllMarkers();
          true;
        `);
      },
      drawRoute: (points: Array<{ lat: number; lng: number }>) => {
        const pointsJson = JSON.stringify(points);
        webViewRef.current?.injectJavaScript(`
          drawPolyline(${pointsJson});
          true;
        `);
      },
    }));

    const markersJson = JSON.stringify(markers);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_CONFIG.JS_KEY}&autoload=true"></script>
  <script>
    var map;
    var markers = [];
    var polyline = null;
    var userMarker = null;

    // 지도 초기화
    var container = document.getElementById('map');
    var options = {
      center: new kakao.maps.LatLng(${latitude}, ${longitude}),
      level: 4
    };
    map = new kakao.maps.Map(container, options);

    // 지도 컨트롤 추가
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

    // 현재 위치 표시
    ${showUserLocation ? `
    userMarker = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(${latitude}, ${longitude}),
      content: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(66,133,244,0.5);"></div>',
      yAnchor: 0.5,
      xAnchor: 0.5
    });
    userMarker.setMap(map);
    ` : ''}

    // 초기 마커 표시
    var initMarkers = ${markersJson};
    initMarkers.forEach(function(m, i) {
      addNumberedMarker(m.lat, m.lng, m.label || (i + 1).toString());
    });

    // 번호가 매겨진 마커 추가
    function addNumberedMarker(lat, lng, label) {
      var content = '<div style="' +
        'width:28px;height:28px;background:#2ecc71;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;' +
        'color:#fff;font-weight:bold;font-size:13px;' +
        'box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;' +
        '">' + label + '</div>';

      var overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(lat, lng),
        content: content,
        yAnchor: 0.5,
        xAnchor: 0.5
      });
      overlay.setMap(map);
      markers.push(overlay);
    }

    // 검색 결과 마커 (빨간색 핀)
    function addSearchMarker(lat, lng) {
      clearSearchMarker();
      var content = '<div style="' +
        'width:32px;height:32px;background:#e74c3c;border-radius:50% 50% 50% 0;' +
        'transform:rotate(-45deg);border:3px solid #fff;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.4);' +
        '"></div>';

      window._searchMarker = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(lat, lng),
        content: content,
        yAnchor: 1,
        xAnchor: 0.5
      });
      window._searchMarker.setMap(map);
      map.setCenter(new kakao.maps.LatLng(lat, lng));
      map.setLevel(3);
    }

    function clearSearchMarker() {
      if (window._searchMarker) {
        window._searchMarker.setMap(null);
        window._searchMarker = null;
      }
    }

    // 모든 마커 제거
    function clearAllMarkers() {
      markers.forEach(function(m) { m.setMap(null); });
      markers = [];
      clearSearchMarker();
    }

    // 경로 폴리라인 그리기
    function drawPolyline(points) {
      if (polyline) polyline.setMap(null);
      var path = points.map(function(p) {
        return new kakao.maps.LatLng(p.lat, p.lng);
      });
      polyline = new kakao.maps.Polyline({
        path: path,
        strokeWeight: 4,
        strokeColor: '#2ecc71',
        strokeOpacity: 0.8,
        strokeStyle: 'solid'
      });
      polyline.setMap(map);

      // 경로가 모두 보이도록 범위 조정
      var bounds = new kakao.maps.LatLngBounds();
      path.forEach(function(p) { bounds.extend(p); });
      map.setBounds(bounds);
    }

    // 지도 클릭 이벤트
    kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
      var latlng = mouseEvent.latLng;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapClick',
        lat: latlng.getLat(),
        lng: latlng.getLng()
      }));
    });
  </script>
</body>
</html>`;

    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapClick' && onMapPress) {
          onMapPress(data.lat, data.lng);
        }
      } catch (e) {
        console.warn('WebView message parse error:', e);
      }
    };

    return (
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={[styles.map, style]}
        javaScriptEnabled={true}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
      />
    );
  }
);

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default KakaoMap;
