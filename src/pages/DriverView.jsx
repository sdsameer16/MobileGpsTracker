import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Square, Navigation, AlertTriangle, Settings } from 'lucide-react';
import { io } from 'socket.io-client';
import { useBackend } from '../BackendConfigContext';

export default function DriverView() {
  const { backendUrl, setBackendUrl } = useBackend();
  
  const [busNumber, setBusNumber] = useState('');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [socketStatus, setSocketStatus] = useState('Disconnected');
  
  // Settings modal
  const [showConfig, setShowConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState(backendUrl);

  const watchIdRef = useRef(null);
  const socketRef = useRef(null);

  const normalizeBackendUrl = (rawUrl) => {
    let url = rawUrl.trim().replace(/\/$/, '');

    if (!/^https?:\/\//i.test(url) && !/^wss?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }

    if (url.startsWith('ws://')) {
      url = url.replace('ws://', 'http://');
    }

    if (url.startsWith('wss://')) {
      url = url.replace('wss://', 'https://');
    }

    return url;
  };

  const saveConfig = (e) => {
    e.preventDefault();
    setBackendUrl(tempUrl);
    setShowConfig(false);
  };

  const startTransmitting = (e) => {
    e.preventDefault();
    if (!busNumber) {
      setError('Please enter a bus number.');
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setError('');
    setIsTransmitting(true);

    // Initialize Socket.IO connection with a browser-safe base URL
    const socketBaseUrl = normalizeBackendUrl(backendUrl);

    const isNgrok = /ngrok\.(io|free\.app|free\.dev)$/i.test(new URL(socketBaseUrl).hostname);
    const socketQuery = isNgrok ? { 'ngrok-skip-browser-warning': 'true' } : undefined;

    socketRef.current = io(socketBaseUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      forceNew: true,
      query: socketQuery
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to backend socket:', socketRef.current.id);
      setSocketStatus('Connected');
      setError('');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setSocketStatus('Disconnected');
      setError(`Failed to connect to backend: ${err.message}. If you are using a tunnel, try polling-only or verify the tunnel supports WebSocket.`);
    });

    socketRef.current.on('disconnect', (reason) => {
      setSocketStatus('Disconnected');
      if (reason === 'io server disconnect') {
        socketRef.current.connect();
      }
    });

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed } = position.coords;
        setLocation({ latitude, longitude, accuracy, speed });
        
        // Emit location update over socket
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('driver_location_update', {
            bus_number: busNumber.trim().toUpperCase(),
            latitude,
            longitude
          });
          setLastUpdate(new Date());
        }
      },
      (err) => {
        setError(`GPS Error: ${err.message}`);
        stopTransmitting();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const stopTransmitting = () => {
    setIsTransmitting(false);
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTransmitting();
  }, []);

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-title">
          <Navigation size={24} color="var(--primary-color)" />
          Bus Live Tracker
        </div>
        <button 
          className="btn btn-outline" 
          style={{ padding: '0.5rem' }}
          onClick={() => setShowConfig(!showConfig)}
          title="Configure Backend"
        >
          <Settings size={20} />
        </button>
      </div>

      <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
        {showConfig ? (
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Backend Configuration</h2>
            <form onSubmit={saveConfig}>
              <div className="form-group">
                <label className="form-label">Live Backend URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  value={tempUrl} 
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="http://localhost:3000"
                  required 
                />
              </div>
              <button type="submit" className="btn btn-primary">Save Configuration</button>
            </form>
          </div>
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <Navigation size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
            <h2>Live Location Transmitter</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Enter your bus number and start transmitting your location.
            </p>

            {!isTransmitting ? (
              <form onSubmit={startTransmitting}>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Bus Number / License Plate</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. BUS-101" 
                    value={busNumber}
                    onChange={(e) => setBusNumber(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.25rem' }}>
                  <Play size={24} /> Start Transmitting
                </button>
              </form>
            ) : (
              <div>
                <div className="status-badges" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <div className={`status-badge ${isTransmitting ? 'status-active' : ''}`} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    <div className={`dot ${isTransmitting ? 'dot-active' : ''}`}></div> GPS: {isTransmitting ? 'Active' : 'Off'}
                  </div>
                  <div className={`status-badge ${socketStatus === 'Connected' ? 'status-active' : 'status-expired'}`} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    <div className={`dot ${socketStatus === 'Connected' ? 'dot-active' : 'dot-expired'}`}></div> Server: {socketStatus}
                  </div>
                  <div className="status-badge" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: '#f1f5f9', color: '#1e293b' }}>
                    Bus: {busNumber.toUpperCase()}
                  </div>
                </div>

                {lastUpdate && (
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', fontWeight: '600' }}>
                    Last Sync: {lastUpdate.toLocaleTimeString()}
                  </div>
                )}

                <div className="stat-grid" style={{ marginBottom: '2rem' }}>
                  <div className="stat-card">
                    <div className="stat-value">{location?.latitude?.toFixed(5) || '--'}</div>
                    <div className="stat-label">Latitude</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{location?.longitude?.toFixed(5) || '--'}</div>
                    <div className="stat-label">Longitude</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{location?.accuracy ? Math.round(location.accuracy) + 'm' : '--'}</div>
                    <div className="stat-label">Accuracy</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{location?.speed ? Math.round(location.speed * 3.6) + ' km/h' : '--'}</div>
                    <div className="stat-label">Speed</div>
                  </div>
                </div>

                {lastUpdate && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Last socket ping: {lastUpdate.toLocaleTimeString()}
                  </p>
                )}

                <button onClick={stopTransmitting} className="btn btn-danger" style={{ width: '100%', padding: '1rem', fontSize: '1.25rem' }}>
                  <Square size={24} /> Stop Transmitting
                </button>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '1.5rem', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} /> {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
