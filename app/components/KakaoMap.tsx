import React, { forwardRef, useImperativeHandle, useRef } from 'react';
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
  onMapReady?: () => void;
  onMapError?: (message: string) => void;
  style?: any;
}

export interface KakaoMapRef {
  moveTo: (lat: number, lng: number) => void;
  addMarker: (lat: number, lng: number, label: string) => void;
  clearMarkers: () => void;
  drawRoute: (points: Array<{ lat: number; lng: number }>) => void;
}

const KakaoMap = forwardRef<KakaoMapRef, KakaoMapProps>(
  (
    {
      latitude,
      longitude,
      markers = [],
      showUserLocation = true,
      onMapPress,
      onMapReady,
      onMapError,
      style,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      moveTo: (lat: number, lng: number) => {
        webViewRef.current?.injectJavaScript(`
          if (window.__MAP_READY && window.__MAP_INSTANCE) {
            window.__MAP_INSTANCE.setCenter(new kakao.maps.LatLng(${lat}, ${lng}));
          }
          true;
        `);
      },
      addMarker: (lat: number, lng: number, label: string) => {
        webViewRef.current?.injectJavaScript(`
          if (window.__MAP_READY && window.addNumberedMarker) {
            window.addNumberedMarker(${lat}, ${lng}, "${label}");
          }
          true;
        `);
      },
      clearMarkers: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.__MAP_READY && window.clearAllMarkers) {
            window.clearAllMarkers();
          }
          true;
        `);
      },
      drawRoute: (points: Array<{ lat: number; lng: number }>) => {
        const pointsJson = JSON.stringify(points);
        webViewRef.current?.injectJavaScript(`
          if (window.__MAP_READY && window.drawPolyline) {
            window.drawPolyline(${pointsJson});
          }
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0f1115; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = null;
    var markers = [];
    var polyline = null;
    var userMarker = null;
    var mapErrorSent = false;
    window.__MAP_READY = false;
    window.__MAP_INSTANCE = null;

    function postMessage(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function sendMapErrorOnce(message) {
      if (mapErrorSent) return;
      mapErrorSent = true;
      postMessage({
        type: 'mapError',
        message: message,
      });
    }

    window.onerror = function(message, source, lineno, colno) {
      sendMapErrorOnce('JS: ' + message + ' @ ' + source + ':' + lineno + ':' + colno);
      return false;
    };

    window.addNumberedMarker = function(lat, lng, label) {
      if (!map) return;
      var content = '<div style="' +
        'width:28px;height:28px;background:#2ecc71;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;' +
        'color:#fff;font-weight:bold;font-size:13px;' +
        'box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid #fff;' +
        '">' + label + '</div>';

      var overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(lat, lng),
        content: content,
        yAnchor: 0.5,
        xAnchor: 0.5
      });
      overlay.setMap(map);
      markers.push(overlay);
    };

    function clearSearchMarker() {
      if (!map) return;
      if (window._searchMarker) {
        window._searchMarker.setMap(null);
        window._searchMarker = null;
      }
    }

    window.clearAllMarkers = function() {
      if (!map) return;
      markers.forEach(function(marker) { marker.setMap(null); });
      markers = [];
      clearSearchMarker();
    };

    window.drawPolyline = function(points) {
      if (!map) return;
      if (polyline) polyline.setMap(null);
      var path = points.map(function(point) {
        return new kakao.maps.LatLng(point.lat, point.lng);
      });
      polyline = new kakao.maps.Polyline({
        path: path,
        strokeWeight: 4,
        strokeColor: '#2ecc71',
        strokeOpacity: 0.85,
        strokeStyle: 'solid'
      });
      polyline.setMap(map);

      if (path.length > 1) {
        var bounds = new kakao.maps.LatLngBounds();
        path.forEach(function(point) { bounds.extend(point); });
        map.setBounds(bounds);
      }
    };

    function initializeMap() {
      if (!window.kakao || !window.kakao.maps) {
        sendMapErrorOnce('Kakao SDK init failed');
        return;
      }

      var container = document.getElementById('map');
      var options = {
        center: new kakao.maps.LatLng(${latitude}, ${longitude}),
        level: 4
      };
      map = new kakao.maps.Map(container, options);
      window.__MAP_INSTANCE = map;
      window.__MAP_READY = true;
      postMessage({ type: 'mapReady' });

      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

      ${showUserLocation ? `
      userMarker = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(${latitude}, ${longitude}),
        content: '<div style="width:16px;height:16px;background:#4d90fe;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(77,144,254,0.55);"></div>',
        yAnchor: 0.5,
        xAnchor: 0.5
      });
      userMarker.setMap(map);
      ` : ''}

      var initMarkers = ${markersJson};
      initMarkers.forEach(function(item, index) {
        window.addNumberedMarker(item.lat, item.lng, item.label || (index + 1).toString());
      });

      kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
        var latlng = mouseEvent.latLng;
        postMessage({
          type: 'mapClick',
          lat: latlng.getLat(),
          lng: latlng.getLng()
        });
      });
    }

    function loadKakaoSdk() {
      if (window.kakao && window.kakao.maps) {
        try {
          kakao.maps.load(initializeMap);
        } catch (e) {
          sendMapErrorOnce('kakao.maps.load failed: ' + (e && e.message ? e.message : e));
        }
        return;
      }

      var sdkUrls = [
        'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_CONFIG.JS_KEY}&autoload=false',
        'http://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_CONFIG.JS_KEY}&autoload=false'
      ];
      var attempts = [];

      function loadByIndex(index) {
        if (index >= sdkUrls.length) {
          var origin = (window.location && window.location.origin) ? window.location.origin : 'unknown';
          var href = (window.location && window.location.href) ? window.location.href : 'unknown';
          var base = document.baseURI || 'unknown';
          sendMapErrorOnce(
            'Failed to load Kakao SDK script | origin=' + origin + ' | href=' + href + ' | baseURI=' + base + ' | tried=' + attempts.join(', ')
          );
          return;
        }

        var url = sdkUrls[index];
        attempts.push(url);

        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = function() {
          if (window.kakao && window.kakao.maps) {
            try {
              kakao.maps.load(initializeMap);
            } catch (e) {
              sendMapErrorOnce('kakao.maps.load failed after script load: ' + (e && e.message ? e.message : e));
            }
          } else {
            loadByIndex(index + 1);
          }
        };
        script.onerror = function() {
          loadByIndex(index + 1);
        };
        document.head.appendChild(script);
      }

      loadByIndex(0);
    }

    setTimeout(function() {
      if (!window.__MAP_READY) {
        sendMapErrorOnce('Map initialization timeout (likely JS key/domain mismatch)');
      }
    }, 8000);

    loadKakaoSdk();
  </script>
</body>
</html>`;

    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapClick' && onMapPress) {
          onMapPress(data.lat, data.lng);
          return;
        }
        if (data.type === 'mapReady' && onMapReady) {
          onMapReady();
          return;
        }
        if (data.type === 'mapError' && onMapError) {
          onMapError(data.message);
        }
      } catch (error) {
        console.warn('WebView message parse error:', error);
      }
    };

    return (
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: 'https://localhost/' }}
        style={[styles.map, style]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        onMessage={handleMessage}
        onError={(event) => {
          onMapError?.(`WebView load error: ${event.nativeEvent.description}`);
        }}
        onHttpError={(event) => {
          onMapError?.(`WebView HTTP error: ${event.nativeEvent.statusCode}`);
        }}
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
