import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import {
  Loader2, X, Maximize2, Minimize2, Plus, Minus,
  Layers, Calendar, Filter, RotateCcw, ChevronDown, ChevronUp,
  MapPin, Clock, Activity, Building2, PawPrint,
  ExternalLink, Navigation, Eye,
  User, CheckCircle, AlertCircle, XCircle, Database, Syringe, Flame
} from 'lucide-react';
import useFirebaseData from '../hooks/useFirebaseData';
import usePetRegistrations from '../hooks/usePetRegistrations';
import useBiteIncidentMarkers from '../hooks/useBiteIncidentMarkers';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import {
  DOG_TYPES,
  STATUS_TYPES,
  TEHSIL_BOUNDARIES,
  TEHSIL_BOUNDARIES_BY_DISTRICT,
  TEHSIL_BOUNDARY_STYLES,
  DISTRICT_BOUNDARIES,
  DISTRICT_BOUNDARY_STYLES,
  DISTRICT_MAP_CONFIG,
  DIVISION_MAP_CONFIG,
  DIVISION_DISTRICTS,
  getTehsilsForDistrict,
  ZOOM_THRESHOLDS
} from '../constants';

// Data source options
const DATA_SOURCES = {
  DOG_MONITOR: 'dogCulling',
  PET_REGISTRATION: 'petRegistration'
};

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Red marker for stray dogs
const redIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [18, 30],
  iconAnchor: [9, 30],
  popupAnchor: [1, -25],
  shadowSize: [30, 30]
});

// Green marker for pet dogs
const greenIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [18, 30],
  iconAnchor: [9, 30],
  popupAnchor: [1, -25],
  shadowSize: [30, 30]
});

// Orange marker for pending status
const orangeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [18, 30],
  iconAnchor: [9, 30],
  popupAnchor: [1, -25],
  shadowSize: [30, 30]
});

// Create pulsing div icon for recent markers
const createPulsingIcon = (color) => {
  return L.divIcon({
    className: 'custom-pulse-marker',
    html: `
      <div class="marker-pulse-ring" style="background: ${color}40; border: 1px solid ${color};"></div>
      <div style="
        width: 12px;
        height: 12px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        position: relative;
        z-index: 2;
      " class="marker-pulse"></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6]
  });
};

const pulsingRedIcon = createPulsingIcon('#EF4444');
const pulsingGreenIcon = createPulsingIcon('#22C55E');
const pulsingOrangeIcon = createPulsingIcon('#F97316');

// Vaccination status markers for pet registration
const createVaccinationIcon = (color) => {
  return L.divIcon({
    className: 'custom-vaccination-marker',
    html: `
      <div style="
        width: 14px;
        height: 14px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7]
  });
};

const registeredIcon = createVaccinationIcon('#FBBF24');  // Yellow for Registered
const firstShotIcon = createVaccinationIcon('#8B5CF6');   // Purple for First Shot
const vaccinatedIcon = createVaccinationIcon('#22C55E');  // Green for Vaccinated
const expiredIcon = createVaccinationIcon('#EF4444');     // Red for Expired

// Purple marker for bite incidents - matching size with red/green markers
const purpleBiteIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [18, 30],
  iconAnchor: [9, 30],
  popupAnchor: [1, -25],
  shadowSize: [30, 30]
});

// Pulsing purple icon for recent bite incidents - matching size with other pulsing icons
const pulsingPurpleIcon = createPulsingIcon('#7C3AED');

// Map tile layers
const MAP_LAYERS = {
  street: {
    name: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri'
  },
  terrain: {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }
};


// Component to fit map bounds to visible boundaries or markers
const MapViewSynchronizer = ({ boundaries, markers, defaultCenter, defaultZoom }) => {
  const map = useMap();
  const [hasInitialFit, setHasInitialFit] = useState(false);

  useEffect(() => {
    if (!hasInitialFit && boundaries && Object.keys(boundaries).length > 0) {
      const allPoints = Object.values(boundaries).flat();
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
        setHasInitialFit(true);
      }
    } else if (!hasInitialFit) {
      map.setView(defaultCenter, defaultZoom);
      setHasInitialFit(true);
    }
  }, [boundaries, map, defaultCenter, defaultZoom, hasInitialFit]);

  // Fit to markers when they change and filters are active
  useEffect(() => {
    if (markers && markers.length > 0 && !hasInitialFit) {
      const markerPoints = markers.map(m => [m.latitude, m.longitude]);
      const bounds = L.latLngBounds(markerPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [markers, map, hasInitialFit]);

  return null;
};

// Custom zoom control component
const CustomZoomControl = ({ darkMode }) => {
  const map = useMap();

  return (
    <div className={`absolute bottom-20 right-3 z-[1000] flex flex-col gap-1`}>
      <button
        onClick={() => map.zoomIn()}
        className={`p-2.5 rounded-lg shadow-lg transition-all ${darkMode
          ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
          }`}
        title="Zoom In"
      >
        <Plus size={18} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className={`p-2.5 rounded-lg shadow-lg transition-all ${darkMode
          ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
          }`}
        title="Zoom Out"
      >
        <Minus size={18} />
      </button>
    </div>
  );
};

// Reset view component
const ResetViewControl = ({ darkMode, center, zoom }) => {
  const map = useMap();

  return (
    <button
      onClick={() => map.setView(center, zoom)}
      className={`absolute bottom-36 right-3 z-[1000] p-2.5 rounded-lg shadow-lg transition-all ${darkMode
        ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
        }`}
      title="Reset View"
    >
      <RotateCcw size={18} />
    </button>
  );
};

// Zoom-aware boundary rendering component
const ZoomAwareBoundaries = ({ showBoundary, adminScope }) => {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => {
      setCurrentZoom(map.getZoom());
    },
  });

  if (!showBoundary || !adminScope) return null;

  const { accessLevel, division, district, tehsil: lockedTehsil } = adminScope;

  // Super admins see districts zoomed out, tehsils zoomed in.
  // Local admins see their "domain" boundaries (both district and tehsil) more persistently.
  const showDistricts = accessLevel === 'province'
    ? currentZoom < ZOOM_THRESHOLDS.TEHSIL_SWITCH
    : true; // Local admins always see their authorized district boundaries

  const showTehsils = accessLevel === 'province'
    ? currentZoom >= ZOOM_THRESHOLDS.TEHSIL_SWITCH
    : currentZoom >= 8; // Local admins see tehsils from zoom 8+ (Division level)

  // Filter districts to show based on access level
  const filteredDistricts = Object.entries(DISTRICT_BOUNDARIES).filter(([name]) => {
    if (accessLevel === 'province') return true;
    if (accessLevel === 'division') {
      return (DIVISION_DISTRICTS[division] || []).includes(name);
    }
    // District and Tehsil level see their district boundary
    if (accessLevel === 'district' || accessLevel === 'tehsil') return name === district;
    return false;
  });

  // Filter tehsils to groups based on accessible districts
  const filteredTehsilGroups = Object.entries(TEHSIL_BOUNDARIES_BY_DISTRICT).filter(([distName]) => {
    if (accessLevel === 'province') return true;
    if (accessLevel === 'division') {
      return (DIVISION_DISTRICTS[division] || []).includes(distName);
    }
    if (accessLevel === 'district') return distName === district;
    if (accessLevel === 'tehsil') return true; // Will filter individual tehsils below
    return false;
  });

  return (
    <>
      {/* District boundaries */}
      {showDistricts && filteredDistricts.map(([name, boundary]) => (
        <Polygon
          key={`district-${name}`}
          positions={boundary}
          pathOptions={{
            ...DISTRICT_BOUNDARY_STYLES[name],
            // If we are also showing tehsils, make the district fill lighter so tehsils stand out
            fillOpacity: showTehsils ? 0.05 : 0.12,
          }}
        />
      ))}

      {/* Tehsil boundaries */}
      {showTehsils && filteredTehsilGroups.map(([distName, tehsils]) =>
        Object.entries(tehsils).map(([tehName, boundary]) => {
          // Extra filter for tehsil-level access
          if (accessLevel === 'tehsil' && tehName !== lockedTehsil) return null;

          return (
            <Polygon
              key={`tehsil-${tehName}`}
              positions={boundary}
              pathOptions={TEHSIL_BOUNDARY_STYLES[tehName]}
            />
          );
        })
      )}

      {/* Subtle district outlines at tehsil zoom (keeps context when zoomed in deep) */}
      {currentZoom >= 12 && filteredDistricts.map(([name, boundary]) => (
        <Polygon
          key={`district-outline-${name}`}
          positions={boundary}
          pathOptions={{
            color: DISTRICT_BOUNDARY_STYLES[name]?.color || '#64748b',
            weight: 1.5,
            opacity: 0.3,
            fillColor: 'transparent',
            fillOpacity: 0,
            dashArray: '8, 6',
          }}
        />
      ))}

      {/* For Tehsil Admin: Always show their tehsil boundary if zoomed way out */}
      {currentZoom < 8 && accessLevel === 'tehsil' && lockedTehsil && TEHSIL_BOUNDARIES[lockedTehsil] && (
        <Polygon
          positions={TEHSIL_BOUNDARIES[lockedTehsil]}
          pathOptions={TEHSIL_BOUNDARY_STYLES[lockedTehsil]}
        />
      )}
    </>
  );
};

// Heatmap gradients for different data sources
const HEATMAP_GRADIENTS = {
  dogCulling: {
    0.0: '#3B82F6',  // blue
    0.25: '#06B6D4', // cyan
    0.5: '#FBBF24',  // amber
    0.75: '#F97316', // orange
    1.0: '#EF4444'   // red
  },
  petRegistration: {
    0.0: '#8B5CF6',  // purple
    0.25: '#06B6D4', // cyan
    0.5: '#22C55E',  // green
    0.75: '#FBBF24', // amber
    1.0: '#EC4899'   // pink
  },
  intensity: {
    0.0: '#1E40AF',  // dark blue
    0.2: '#3B82F6',  // blue
    0.4: '#22C55E',  // green
    0.6: '#FBBF24',  // amber
    0.8: '#F97316',  // orange
    1.0: '#DC2626'   // red
  }
};

// Enhanced Heatmap Component with dynamic intensity
const HeatmapLayer = ({ data, settings, dataSource }) => {
  const map = useMap();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const { radius, blur, intensity, minOpacity } = settings;

    // Calculate dynamic intensity based on point clustering
    // Points near many other points get higher intensity
    const calculateIntensity = (point, allPoints) => {
      const nearbyRadius = 0.01; // ~1km in degrees
      let nearbyCount = 0;

      for (const other of allPoints) {
        const dist = Math.sqrt(
          Math.pow(point.latitude - other.latitude, 2) +
          Math.pow(point.longitude - other.longitude, 2)
        );
        if (dist < nearbyRadius && dist > 0) {
          nearbyCount++;
        }
      }

      // Normalize intensity (0.3 to 1.0 based on nearby points)
      const baseIntensity = 0.3;
      const maxNearby = 10;
      const normalizedIntensity = baseIntensity + (Math.min(nearbyCount, maxNearby) / maxNearby) * (1 - baseIntensity);

      return normalizedIntensity * intensity;
    };

    // Convert data to heatmap format [lat, lng, intensity]
    const heatData = data.map(point => [
      point.latitude,
      point.longitude,
      calculateIntensity(point, data)
    ]);

    // Select gradient based on data source
    const gradient = dataSource === 'petRegistration'
      ? HEATMAP_GRADIENTS.petRegistration
      : HEATMAP_GRADIENTS.dogCulling;

    // Create heatmap layer with configurable options
    const heat = L.heatLayer(heatData, {
      radius: radius,
      blur: blur,
      maxZoom: 18,
      max: 1.0,
      minOpacity: minOpacity,
      gradient: gradient
    }).addTo(map);

    // Update heatmap on zoom change for better visualization
    const handleZoom = () => {
      const zoom = map.getZoom();
      // Adjust radius based on zoom level
      const zoomFactor = Math.max(0.5, Math.min(2, zoom / 12));
      heat.setOptions({ radius: radius * zoomFactor });
    };

    map.on('zoomend', handleZoom);

    return () => {
      map.removeLayer(heat);
      map.off('zoomend', handleZoom);
    };
  }, [map, data, settings, dataSource]);

  return null;
};

// Heatmap Legend Component
const HeatmapLegend = ({ darkMode, dataSource }) => {
  const gradient = dataSource === 'petRegistration'
    ? HEATMAP_GRADIENTS.petRegistration
    : HEATMAP_GRADIENTS.dogCulling;

  const gradientStyle = {
    background: `linear-gradient(to right, ${Object.values(gradient).join(', ')})`
  };

  return (
    <div className={`absolute bottom-16 left-3 z-[1000] p-3 rounded-lg shadow-lg backdrop-blur-sm ${darkMode ? 'bg-gray-800/95 border border-gray-700' : 'bg-white/95 border border-gray-200'
      }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
        <span className={`text-xs font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          Heat Intensity
        </span>
      </div>
      <div className="w-32 h-3 rounded-full overflow-hidden" style={gradientStyle}></div>
      <div className="flex justify-between mt-1">
        <span className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Low</span>
        <span className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>High</span>
      </div>
    </div>
  );
};

// Heatmap Controls Panel Component
const HeatmapControls = ({ darkMode, settings, onSettingsChange, showMarkers, onToggleMarkers }) => {
  return (
    <div className={`absolute top-3 left-3 z-[1000] p-3 rounded-xl shadow-lg backdrop-blur-sm w-56 ${darkMode ? 'bg-gray-800/95 border border-gray-700' : 'bg-white/95 border border-gray-200'
      }`}>
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-dashed ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <Flame size={16} className="text-orange-500" />
        <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          Heatmap Settings
        </span>
      </div>

      {/* Radius Control */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Radius</label>
          <span className={`text-xs font-mono ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{settings.radius}px</span>
        </div>
        <input
          type="range"
          min="10"
          max="50"
          value={settings.radius}
          onChange={(e) => onSettingsChange({ ...settings, radius: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
      </div>

      {/* Blur Control */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Blur</label>
          <span className={`text-xs font-mono ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{settings.blur}px</span>
        </div>
        <input
          type="range"
          min="5"
          max="30"
          value={settings.blur}
          onChange={(e) => onSettingsChange({ ...settings, blur: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
      </div>

      {/* Intensity Control */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Intensity</label>
          <span className={`text-xs font-mono ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{(settings.intensity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="20"
          max="100"
          value={settings.intensity * 100}
          onChange={(e) => onSettingsChange({ ...settings, intensity: parseInt(e.target.value) / 100 })}
          className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
      </div>

      {/* Show Markers Toggle */}
      <div className={`pt-2 border-t border-dashed ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <label className="flex items-center justify-between cursor-pointer">
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Show markers</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={showMarkers}
              onChange={onToggleMarkers}
              className="sr-only peer"
            />
            <div className={`w-9 h-5 rounded-full peer peer-checked:bg-orange-500 transition-colors ${darkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
            <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
          </div>
        </label>
      </div>
    </div>
  );
};

const LiveMap = () => {
  const { darkMode } = useOutletContext();
  const navigate = useNavigate();
  const { adminScope } = useAuth();

  // Use shared filter context
  const {
    selectedDistrict,
    selectedTahsil,
    selectedUC,
    selectedDogType,
    startDate,
    endDate,
    filters,
    hasActiveFilters: hasContextFilters,
    availableDistricts,
    availableTahsils,
    setSelectedTahsil,
    setSelectedUC,
    setSelectedDogType,
    setStartDate,
    setEndDate,
    resetFilters,
    ucLookup
  } = useFilters();

  // Date preset types
  const DATE_PRESETS = {
    DAILY: 'daily',
    WEEKLY: '7d',
    MONTHLY: '1m',
    YEARLY: '1y'
  };

  // Map-specific local state
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapKey, setMapKey] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeLayer, setActiveLayer] = useState('street');
  const [showFilters, setShowFilters] = useState(false);
  const [dataSource, setDataSource] = useState(DATA_SOURCES.DOG_CULLING);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showMarkersWithHeatmap, setShowMarkersWithHeatmap] = useState(false);
  const [showOnlyBiteIncidents, setShowOnlyBiteIncidents] = useState(false);
  const [datePreset, setDatePreset] = useState(''); // No default preset
  const [heatmapSettings, setHeatmapSettings] = useState({
    radius: 25,
    blur: 15,
    intensity: 0.8,
    minOpacity: 0.3
  });

  // Helper function to calculate date range based on preset
  const getDateRangeFromPreset = useCallback((preset) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Today in YYYY-MM-DD format
    let start;

    switch (preset) {
      case DATE_PRESETS.DAILY:
        start = todayStr; // Same day
        break;
      case DATE_PRESETS.WEEKLY:
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0];
        break;
      case DATE_PRESETS.MONTHLY:
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        start = monthAgo.toISOString().split('T')[0];
        break;
      case DATE_PRESETS.YEARLY:
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        start = yearAgo.toISOString().split('T')[0];
        break;
      default:
        start = '';
    }

    return { startDate: start, endDate: todayStr };
  }, [DATE_PRESETS.DAILY, DATE_PRESETS.WEEKLY, DATE_PRESETS.MONTHLY, DATE_PRESETS.YEARLY]);

  // Apply date preset
  const applyDatePreset = useCallback((preset) => {
    setDatePreset(preset);
    const { startDate: start, endDate: end } = getDateRangeFromPreset(preset);
    setStartDate(start);
    setEndDate(end);
  }, [getDateRangeFromPreset, setStartDate, setEndDate]);

  // Legend visibility toggles
  const [showStray] = useState(true);
  const [showPet] = useState(true);
  const [showPending] = useState(true);
  const [showRecent] = useState(true);
  const [showBoundary] = useState(true);

  // Initialize with 7 days data default
  useEffect(() => {
    // Only set if no dates are currently set to avoid overriding user selection or context
    if (!startDate && !endDate) {
      applyDatePreset(DATE_PRESETS.WEEKLY);
    }
  }, [startDate, endDate, applyDatePreset, DATE_PRESETS.WEEKLY]);

  // Fetch data from Firebase - only fetch what's needed for the active data source
  const isDogCullingView = dataSource === DATA_SOURCES.DOG_CULLING || dataSource === DATA_SOURCES.DOG_MONITOR;
  const emptyFilters = useMemo(() => ({ district: '', tahsil: '', uc: '', dogType: '', startDate: '', endDate: '' }), []);

  const { data: dogCullingData, loading: dogCullingLoading, error: dogCullingError } = useFirebaseData(isDogCullingView ? filters : emptyFilters);
  const { data: petRegData, loading: petRegLoading, error: petRegError } = usePetRegistrations(!isDogCullingView ? {
    district: selectedDistrict,
    tahsil: selectedTahsil,
    uc: selectedUC,
    startDate,
    endDate,
    status: selectedStatus
  } : null);
  const { data: biteIncidentData, loading: biteIncidentLoading, error: biteIncidentError } = useBiteIncidentMarkers(isDogCullingView ? {
    district: selectedDistrict,
    tahsil: selectedTahsil,
    uc: selectedUC,
    startDate,
    endDate
  } : null);

  // Select data based on data source and bite incident toggle
  // For Dog Culling: show only bite incidents OR combined data based on toggle
  const firebaseData = useMemo(() => {
    if (dataSource === DATA_SOURCES.DOG_CULLING) {
      if (showOnlyBiteIncidents) {
        return biteIncidentData; // Only purple bite incident markers
      }
      return [...dogCullingData, ...biteIncidentData]; // Combined data
    }
    return petRegData;
  }, [dataSource, dogCullingData, biteIncidentData, petRegData, showOnlyBiteIncidents]);

  const loading = dataSource === DATA_SOURCES.DOG_CULLING
    ? (dogCullingLoading || biteIncidentLoading)
    : petRegLoading;
  const error = dataSource === DATA_SOURCES.DOG_CULLING
    ? (dogCullingError || biteIncidentError)
    : petRegError;
  const isPetRegistration = dataSource === DATA_SOURCES.PET_REGISTRATION;

  // Check if a record is recent (within last 24 hours)
  const isRecentRecord = (record) => {
    if (!record.date) return false;
    const now = new Date();
    const recordDate = new Date(record.date);
    const hoursDiff = (now - recordDate) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  // Filter data with valid coordinates, status, and date range
  const markersData = useMemo(() => {
    let filtered = firebaseData.filter(
      record => record.latitude && record.longitude &&
        !isNaN(record.latitude) && !isNaN(record.longitude)
    );

    // Filter by status
    if (selectedStatus) {
      if (isPetRegistration) {
        // For Pet Registration, map display status to vaccinationStatus values
        const statusMap = {
          'Registered': 'registered',
          'First Shot': 'first_shot',
          'Vaccinated': 'vaccinated',
          'Expired': 'expired'
        };
        const targetStatus = statusMap[selectedStatus] || selectedStatus.toLowerCase();
        filtered = filtered.filter(record => record.vaccinationStatus === targetStatus);
      } else {
        // For Dog Culling, use regular status
        filtered = filtered.filter(record => record.status === selectedStatus);
      }
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(record => record.date && record.date >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(record => record.date && record.date <= end);
    }

    // Apply legend visibility filters
    filtered = filtered.filter(record => {
      const isRecent = isRecentRecord(record);

      // If it's recent and recent is hidden, hide it regardless of type
      if (isRecent && !showRecent) return false;

      // Filter by type
      if (record.status === STATUS_TYPES.PENDING && !showPending) return false;
      if (record.dogType === DOG_TYPES.STRAY && !showStray) return false;
      if (record.dogType === DOG_TYPES.PET && !showPet) return false;

      return true;
    });

    return filtered;
  }, [firebaseData, selectedStatus, startDate, endDate, showStray, showPet, showPending, showRecent, isPetRegistration]);

  // Extended Statistics - different for each data source
  const stats = useMemo(() => {
    // Use all data for stats, not filtered by legend
    const allData = firebaseData.filter(
      record => record.latitude && record.longitude &&
        !isNaN(record.latitude) && !isNaN(record.longitude)
    );

    const total = allData.length;
    const recent = allData.filter(m => isRecentRecord(m)).length;
    const uniqueUCs = new Set(allData.map(m => m.ucId)).size;

    if (isPetRegistration) {
      // Pet Registration stats
      const registered = allData.filter(m => m.vaccinationStatus === 'registered').length;
      const firstShot = allData.filter(m => m.vaccinationStatus === 'first_shot').length;
      const vaccinated = allData.filter(m => m.vaccinationStatus === 'vaccinated').length;
      const expired = allData.filter(m => m.vaccinationStatus === 'expired').length;

      return {
        total,
        registered,
        firstShot,
        vaccinated,
        expired,
        recent,
        uniqueUCs,
        // For compatibility with stat cards
        stray: 0,
        pet: total,
        approved: vaccinated,
        pending: registered + firstShot,
        rejected: expired
      };
    } else {
      // Dog Culling stats
      const stray = allData.filter(m => m.dogType === DOG_TYPES.STRAY).length;
      const pet = allData.filter(m => m.dogType === DOG_TYPES.PET).length;
      const approved = allData.filter(m => m.status === STATUS_TYPES.APPROVED).length;
      const pending = allData.filter(m => m.status === STATUS_TYPES.PENDING).length;
      const rejected = allData.filter(m => m.status === STATUS_TYPES.REJECTED).length;

      return { total, stray, pet, approved, pending, rejected, recent, uniqueUCs };
    }
  }, [firebaseData, isPetRegistration]);

  // Get Union Councils from ucLookup, filtered by scope, selected District and Tahsil
  const availableUCs = useMemo(() => {
    const ucs = [];
    Object.entries(ucLookup).forEach(([ucId, ucData]) => {
      // Scope enforcement: only show UCs within available districts
      if (ucData.district && !availableDistricts.includes(ucData.district)) {
        return;
      }
      // Filter by selected district
      if (selectedDistrict && ucData.district && ucData.district !== selectedDistrict) {
        return;
      }
      // Filter by tahsil
      if (selectedTahsil) {
        if (ucData.tahsil === selectedTahsil) {
          ucs.push({ value: ucId, label: ucData.uc });
        }
      } else {
        ucs.push({ value: ucId, label: ucData.uc });
      }
    });
    return ucs.sort((a, b) => {
      const numA = parseInt(a.label?.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.label?.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [selectedTahsil, selectedDistrict, ucLookup, availableDistricts]);

  const handleResetFilters = () => {
    resetFilters(); // Reset shared context filters
    setSelectedStatus(''); // Reset map-specific filter
    setDatePreset(''); // Clear date preset
    setMapKey(Date.now());
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Get marker icon based on data source, status, and recency
  const getMarkerIcon = (record) => {
    const isRecent = isRecentRecord(record);

    // Bite Incident markers (purple) - shown with Dog Culling data
    // Check explicitly for isBiteIncident === true to ensure purple markers
    if (record.isBiteIncident === true) {
      return isRecent ? pulsingPurpleIcon : purpleBiteIcon;
    }

    // Pet Registration markers
    if (isPetRegistration) {
      switch (record.vaccinationStatus) {
        case 'vaccinated':
          return vaccinatedIcon;
        case 'first_shot':
          return firstShotIcon;
        case 'expired':
          return expiredIcon;
        default:
          return registeredIcon;
      }
    }

    // Dog Culling markers
    if (record.status === STATUS_TYPES.PENDING) {
      return isRecent ? pulsingOrangeIcon : orangeIcon;
    }
    if (record.dogType === DOG_TYPES.STRAY) {
      return isRecent ? pulsingRedIcon : redIcon;
    }
    return isRecent ? pulsingGreenIcon : greenIcon;
  };
  // Dynamic map center/zoom based on admin scope
  const { defaultCenter, defaultZoom } = useMemo(() => {
    // If a specific district is selected or locked by scope
    const district = selectedDistrict || adminScope?.district;
    if (district && DISTRICT_MAP_CONFIG[district]) {
      return {
        defaultCenter: DISTRICT_MAP_CONFIG[district].center,
        defaultZoom: DISTRICT_MAP_CONFIG[district].zoom
      };
    }
    // Division-level: show full division
    if (adminScope?.accessLevel === 'division' || !adminScope?.district) {
      return {
        defaultCenter: DIVISION_MAP_CONFIG.center,
        defaultZoom: DIVISION_MAP_CONFIG.zoom
      };
    }
    // Fallback to Vehari
    return { defaultCenter: [30.0452, 72.3489], defaultZoom: 9.3 };
  }, [adminScope, selectedDistrict]);

  // Filter boundaries based on admin scope
  const visibleBoundaries = useMemo(() => {
    if (!adminScope) return {};

    const { accessLevel, division, district, tehsil: lockedTehsil } = adminScope;

    // Super Admin / Developer: Show all boundaries
    if (accessLevel === 'province') return TEHSIL_BOUNDARIES;

    const authorizedTehsils = new Set();

    if (accessLevel === 'division') {
      const districtsInDivision = DIVISION_DISTRICTS[division] || [];
      districtsInDivision.forEach(d => {
        getTehsilsForDistrict(d).forEach(t => authorizedTehsils.add(t));
      });
    } else if (accessLevel === 'district') {
      getTehsilsForDistrict(district).forEach(t => authorizedTehsils.add(t));
    } else if (accessLevel === 'tehsil') {
      authorizedTehsils.add(lockedTehsil);
    }

    const filtered = {};
    Object.entries(TEHSIL_BOUNDARIES).forEach(([name, boundary]) => {
      if (authorizedTehsils.has(name)) {
        filtered[name] = boundary;
      }
    });

    return filtered;
  }, [adminScope]);

  const currentLayer = MAP_LAYERS[activeLayer];

  // Check if any filters are active (context filters + map-specific status)
  const hasActiveFilters = hasContextFilters || selectedStatus;

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-[9999]' : 'h-screen'} ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header Bar */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        {/* Main Filters Row */}
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Filter Icon & Label */}
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                <Filter size={16} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Filters</span>
            </div>

            {/* Data Source */}
            <div className="flex-1 min-w-[150px] max-w-[180px]">
              <div className="relative">
                <Database size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <select
                  value={dataSource}
                  onChange={(e) => {
                    setDataSource(e.target.value);
                    setSelectedStatus('');
                    setMapKey(Date.now());
                  }}
                  className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm font-medium transition-all ${darkMode
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:border-blue-400'
                    : 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300'
                    }`}
                >
                  <option value={DATA_SOURCES.DOG_CULLING}>Dog Monitoring</option>
                  <option value={DATA_SOURCES.PET_REGISTRATION}>Pet Registration</option>
                </select>
              </div>
            </div>

            {/* Tehsil */}
            <div className="flex-1 min-w-[130px] max-w-[180px]">
              <div className="relative">
                <Building2 size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <select
                  value={selectedTahsil}
                  onChange={(e) => setSelectedTahsil(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm transition-all ${darkMode
                    ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500 focus:border-blue-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300 focus:border-blue-500'
                    }`}
                >
                  <option value="">All Tehsils</option>
                  {availableTahsils.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Union Council */}
            <div className="flex-1 min-w-[130px] max-w-[180px]">
              <div className="relative">
                <MapPin size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <select
                  value={selectedUC}
                  onChange={(e) => setSelectedUC(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm transition-all ${darkMode
                    ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500 focus:border-blue-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300 focus:border-blue-500'
                    }`}
                >
                  <option value="">All UCs</option>
                  {availableUCs.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>

            {/* Dog Type - Only show for Dog Culling */}
            {!isPetRegistration && (
              <div className="flex-1 min-w-[120px] max-w-[150px]">
                <div className="relative">
                  <PawPrint size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <select
                    value={selectedDogType}
                    onChange={(e) => setSelectedDogType(e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm transition-all ${darkMode
                      ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300 focus:border-blue-500'
                      }`}
                  >
                    <option value="">All Types</option>
                    <option value={DOG_TYPES.STRAY}>{DOG_TYPES.STRAY}</option>
                    <option value={DOG_TYPES.PET}>{DOG_TYPES.PET}</option>
                  </select>
                </div>
              </div>
            )}

            {/* Status - Different options based on data source */}
            <div className="flex-1 min-w-[120px] max-w-[150px]">
              <div className="relative">
                {isPetRegistration ? (
                  <Syringe size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                ) : (
                  <CheckCircle size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                )}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm transition-all ${darkMode
                    ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500 focus:border-blue-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300 focus:border-blue-500'
                    }`}
                >
                  <option value="">All Status</option>
                  {isPetRegistration ? (
                    <>
                      <option value="Registered">Registered (Not vaccinated)</option>
                      <option value="First Shot">First Shot</option>
                      <option value="Vaccinated">Vaccinated</option>
                      <option value="Expired">Expired</option>
                    </>
                  ) : (
                    <>
                      <option value={STATUS_TYPES.APPROVED}>Approved</option>
                      <option value={STATUS_TYPES.REJECTED}>Rejected</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Quick Date Presets - Always visible */}
            <div className="hidden sm:flex items-center gap-1 border-l border-r px-2 mx-1 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => applyDatePreset(DATE_PRESETS.DAILY)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${datePreset === DATE_PRESETS.DAILY
                  ? 'bg-blue-600 text-white'
                  : darkMode
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                  }`}
                title="Today only"
              >
                Daily
              </button>
              <button
                onClick={() => applyDatePreset(DATE_PRESETS.WEEKLY)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${datePreset === DATE_PRESETS.WEEKLY
                  ? 'bg-blue-600 text-white'
                  : darkMode
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                  }`}
                title="Last 7 days"
              >
                7D
              </button>
              <button
                onClick={() => applyDatePreset(DATE_PRESETS.MONTHLY)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${datePreset === DATE_PRESETS.MONTHLY
                  ? 'bg-blue-600 text-white'
                  : darkMode
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                  }`}
                title="Last 1 month"
              >
                1M
              </button>
              <button
                onClick={() => applyDatePreset(DATE_PRESETS.YEARLY)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${datePreset === DATE_PRESETS.YEARLY
                  ? 'bg-blue-600 text-white'
                  : darkMode
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                  }`}
                title="Last 1 year"
              >
                1Y
              </button>
            </div>

            {/* More Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${showFilters
                ? 'bg-blue-600 text-white shadow-sm'
                : darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">More</span>
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Heatmap Toggle */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${showHeatmap
                ? 'bg-orange-600 text-white shadow-sm'
                : darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              title="Toggle Heatmap"
            >
              <Flame size={14} />
              <span className="hidden sm:inline">Heatmap</span>
            </button>

            {/* Bite Incidents Only Toggle - Only show for Dog Culling */}
            {!isPetRegistration && (
              <button
                onClick={() => setShowOnlyBiteIncidents(!showOnlyBiteIncidents)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${showOnlyBiteIncidents
                  ? 'bg-purple-600 text-white shadow-sm'
                  : darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                title="Show only bite incidents with action taken"
              >
                <AlertCircle size={14} />
                <span className="hidden sm:inline">Bite Only</span>
              </button>
            )}

            {/* Reset */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${darkMode
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Right Side Controls */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Layer Selector */}
              <div className="relative">
                <Layers size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <select
                  value={activeLayer}
                  onChange={(e) => setActiveLayer(e.target.value)}
                  className={`pl-8 pr-3 py-2 rounded-lg border text-sm transition-all ${darkMode
                    ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300'
                    }`}
                >
                  {Object.entries(MAP_LAYERS).map(([key, layer]) => (
                    <option key={key} value={key}>{layer.name}</option>
                  ))}
                </select>
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className={`p-2 rounded-lg transition-all ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>

          {/* Extended Filters Row - Date Range */}
          {showFilters && (
            <div className={`flex flex-wrap items-end gap-3 mt-3 pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              {/* Quick Date Preset Buttons */}
              <div className="flex-shrink-0">
                <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Clock size={12} />
                  Quick Filter
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => applyDatePreset(DATE_PRESETS.DAILY)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${datePreset === DATE_PRESETS.DAILY
                      ? 'bg-blue-600 text-white'
                      : darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => applyDatePreset(DATE_PRESETS.WEEKLY)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${datePreset === DATE_PRESETS.WEEKLY
                      ? 'bg-blue-600 text-white'
                      : darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => applyDatePreset(DATE_PRESETS.MONTHLY)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${datePreset === DATE_PRESETS.MONTHLY
                      ? 'bg-blue-600 text-white'
                      : darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    1M
                  </button>
                  <button
                    onClick={() => applyDatePreset(DATE_PRESETS.YEARLY)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${datePreset === DATE_PRESETS.YEARLY
                      ? 'bg-blue-600 text-white'
                      : darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    1Y
                  </button>
                </div>
              </div>

              {/* Start Date */}
              <div className="flex-1 min-w-[150px] max-w-[180px]">
                <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Calendar size={12} />
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset(''); // Clear preset when manually changing date
                  }}
                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-all ${darkMode
                    ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300'
                    }`}
                />
              </div>

              {/* End Date */}
              <div className="flex-1 min-w-[150px] max-w-[180px]">
                <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Calendar size={12} />
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset(''); // Clear preset when manually changing date
                  }}
                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-all ${darkMode
                    ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300'
                    }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards Row */}
        <div className={`px-3 sm:px-4 pb-3 sm:pb-4`}>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
            {/* Total */}
            <button
              onClick={() => { setSelectedDogType(''); setSelectedStatus(''); }}
              className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${!selectedDogType && !selectedStatus
                ? darkMode ? 'bg-gray-600 ring-2 ring-gray-500' : 'bg-gray-100 ring-2 ring-gray-400'
                : darkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                } border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Activity size={12} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</span>
              </div>
              <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
            </button>

            {/* Pet Registration Stats */}
            {isPetRegistration ? (
              <>
                {/* Registered */}
                <button
                  onClick={() => setSelectedStatus(selectedStatus === 'Registered' ? '' : 'Registered')}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedStatus === 'Registered'
                    ? darkMode ? 'bg-yellow-900/50 ring-2 ring-yellow-500' : 'bg-yellow-100 ring-2 ring-yellow-400'
                    : darkMode ? 'bg-yellow-900/20 hover:bg-yellow-900/40' : 'bg-yellow-50 hover:bg-yellow-100'
                    } border ${darkMode ? 'border-yellow-800/50' : 'border-yellow-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>Registered (Not vaccinated)</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>{stats.registered || 0}</p>
                </button>

                {/* First Shot */}
                <button
                  onClick={() => setSelectedStatus(selectedStatus === 'First Shot' ? '' : 'First Shot')}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedStatus === 'First Shot'
                    ? darkMode ? 'bg-purple-900/50 ring-2 ring-purple-500' : 'bg-purple-100 ring-2 ring-purple-400'
                    : darkMode ? 'bg-purple-900/20 hover:bg-purple-900/40' : 'bg-purple-50 hover:bg-purple-100'
                    } border ${darkMode ? 'border-purple-800/50' : 'border-purple-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>First Shot</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>{stats.firstShot || 0}</p>
                </button>

                {/* Vaccinated */}
                <button
                  onClick={() => setSelectedStatus(selectedStatus === 'Vaccinated' ? '' : 'Vaccinated')}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedStatus === 'Vaccinated'
                    ? darkMode ? 'bg-emerald-900/50 ring-2 ring-emerald-500' : 'bg-emerald-100 ring-2 ring-emerald-400'
                    : darkMode ? 'bg-emerald-900/20 hover:bg-emerald-900/40' : 'bg-emerald-50 hover:bg-emerald-100'
                    } border ${darkMode ? 'border-emerald-800/50' : 'border-emerald-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle size={12} className={darkMode ? 'text-emerald-400' : 'text-emerald-600'} />
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Vaccinated</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.vaccinated || 0}</p>
                </button>

                {/* Expired */}
                <button
                  onClick={() => setSelectedStatus(selectedStatus === 'Expired' ? '' : 'Expired')}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedStatus === 'Expired'
                    ? darkMode ? 'bg-red-900/50 ring-2 ring-red-500' : 'bg-red-100 ring-2 ring-red-400'
                    : darkMode ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-50 hover:bg-red-100'
                    } border ${darkMode ? 'border-red-800/50' : 'border-red-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>Expired</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{stats.expired || 0}</p>
                </button>
              </>
            ) : (
              <>
                {/* Dog Culling Stats */}
                {/* Stray */}
                <button
                  onClick={() => { setSelectedDogType(selectedDogType === DOG_TYPES.STRAY ? '' : DOG_TYPES.STRAY); setSelectedStatus(''); }}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedDogType === DOG_TYPES.STRAY
                    ? darkMode ? 'bg-red-900/50 ring-2 ring-red-500' : 'bg-red-100 ring-2 ring-red-400'
                    : darkMode ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-50 hover:bg-red-100'
                    } border ${darkMode ? 'border-red-800/50' : 'border-red-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>Stray</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{stats.stray}</p>
                </button>

                {/* Pet */}
                <button
                  onClick={() => { setSelectedDogType(selectedDogType === DOG_TYPES.PET ? '' : DOG_TYPES.PET); setSelectedStatus(''); }}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedDogType === DOG_TYPES.PET
                    ? darkMode ? 'bg-green-900/50 ring-2 ring-green-500' : 'bg-green-100 ring-2 ring-green-400'
                    : darkMode ? 'bg-green-900/20 hover:bg-green-900/40' : 'bg-green-50 hover:bg-green-100'
                    } border ${darkMode ? 'border-green-800/50' : 'border-green-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>Pet</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>{stats.pet}</p>
                </button>

                {/* Approved */}
                <button
                  onClick={() => { setSelectedStatus(selectedStatus === STATUS_TYPES.APPROVED ? '' : STATUS_TYPES.APPROVED); setSelectedDogType(''); }}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedStatus === STATUS_TYPES.APPROVED
                    ? darkMode ? 'bg-emerald-900/50 ring-2 ring-emerald-500' : 'bg-emerald-100 ring-2 ring-emerald-400'
                    : darkMode ? 'bg-emerald-900/20 hover:bg-emerald-900/40' : 'bg-emerald-50 hover:bg-emerald-100'
                    } border ${darkMode ? 'border-emerald-800/50' : 'border-emerald-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle size={12} className={darkMode ? 'text-emerald-400' : 'text-emerald-600'} />
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Approved</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.approved}</p>
                </button>

                {/* Rejected */}
                <button
                  onClick={() => { setSelectedStatus(selectedStatus === STATUS_TYPES.REJECTED ? '' : STATUS_TYPES.REJECTED); setSelectedDogType(''); }}
                  className={`p-2.5 sm:p-3 rounded-lg text-left transition-all ${selectedStatus === STATUS_TYPES.REJECTED
                    ? darkMode ? 'bg-red-900/50 ring-2 ring-red-500' : 'bg-red-100 ring-2 ring-red-400'
                    : darkMode ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-50 hover:bg-red-100'
                    } border ${darkMode ? 'border-red-800/50' : 'border-red-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <XCircle size={12} className={darkMode ? 'text-red-400' : 'text-red-600'} />
                    <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>Rejected</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{stats.rejected}</p>
                </button>
              </>
            )}

            {/* Recent 24h */}
            <div className={`p-2.5 sm:p-3 rounded-lg ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border ${darkMode ? 'border-amber-800/50' : 'border-amber-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                </div>
                <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>24h</span>
              </div>
              <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{stats.recent}</p>
            </div>

            {/* Active UCs */}
            <div className={`p-2.5 sm:p-3 rounded-lg ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'} border ${darkMode ? 'border-blue-800/50' : 'border-blue-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin size={12} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>UCs</span>
              </div>
              <p className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{stats.uniqueUCs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className={`flex-1 relative overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`} style={{ minHeight: '300px' }}>
        {loading && (
          <div className={`absolute inset-0 flex items-center justify-center z-50 ${darkMode ? 'bg-gray-900/90' : 'bg-white/90'}`}>
            <div className="text-center">
              <Loader2 className="animate-spin text-blue-600 mx-auto mb-3" size={40} />
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Loading map data...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className={`absolute inset-0 flex items-center justify-center z-40 ${darkMode ? 'bg-red-900/20' : 'bg-red-50'}`}>
            <div className="text-center">
              <AlertCircle className={`mx-auto mb-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`} size={40} />
              <p className={`text-sm font-medium ${darkMode ? 'text-red-200' : 'text-red-800'}`}>Error: {error}</p>
            </div>
          </div>
        )}

        {!loading && !error && markersData.length === 0 && (
          <div className={`absolute inset-0 flex items-center justify-center z-40 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="text-center px-4">
              <MapPin className={`mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} size={48} />
              <p className={`text-lg font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No markers to display</p>
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {selectedStatus || startDate || endDate
                  ? 'Try adjusting your filters'
                  : 'No records with valid coordinates'}
              </p>
            </div>
          </div>
        )}

        {!error && (
          <MapContainer
            key={mapKey}
            center={defaultCenter}
            zoom={defaultZoom}
            scrollWheelZoom={true}
            zoomControl={false}
            className="absolute inset-0"
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution={currentLayer.attribution}
              url={currentLayer.url}
            />

            {/* Zoom-aware district/tehsil boundaries */}
            <ZoomAwareBoundaries showBoundary={showBoundary} adminScope={adminScope} />

            {/* Map Synchronizer / Auto-Fitting */}
            <MapViewSynchronizer
              boundaries={visibleBoundaries}
              markers={markersData}
              defaultCenter={defaultCenter}
              defaultZoom={defaultZoom}
            />
            <CustomZoomControl darkMode={darkMode} />
            <ResetViewControl darkMode={darkMode} center={defaultCenter} zoom={defaultZoom} />

            {/* Heatmap Layer */}
            {showHeatmap && (
              <HeatmapLayer
                data={markersData}
                settings={heatmapSettings}
                dataSource={dataSource}
              />
            )}

            {/* Markers - show when heatmap is off OR when showMarkersWithHeatmap is enabled */}
            {(!showHeatmap || showMarkersWithHeatmap) && markersData.map((record) => (
              <Marker
                key={`marker-${record.id}-${record.isBiteIncident ? 'bite' : 'culling'}`}
                position={[record.latitude, record.longitude]}
                icon={getMarkerIcon(record)}
                eventHandlers={{
                  click: () => setSelectedMarker(record)
                }}
              />
            ))}
          </MapContainer>
        )}

        {/* Heatmap Controls Panel - show when heatmap is active */}
        {showHeatmap && (
          <HeatmapControls
            darkMode={darkMode}
            settings={heatmapSettings}
            onSettingsChange={setHeatmapSettings}
            showMarkers={showMarkersWithHeatmap}
            onToggleMarkers={() => setShowMarkersWithHeatmap(!showMarkersWithHeatmap)}
          />
        )}

        {/* Heatmap Legend - show when heatmap is active */}
        {showHeatmap && (
          <HeatmapLegend darkMode={darkMode} dataSource={dataSource} />
        )}

        {/* Showing X markers indicator */}
        <div className={`absolute bottom-3 left-3 z-[1000] px-3 py-1.5 rounded-lg text-xs font-medium ${darkMode ? 'bg-gray-800/90 text-gray-300 border border-gray-700' : 'bg-white/90 text-gray-700 border border-gray-200'} backdrop-blur-sm`}>
          {showHeatmap ? `Heatmap: ${markersData.length} data points` : `Showing ${markersData.length} of ${stats.total} markers`}
        </div>

        {/* Selected Marker Detail Panel */}
        {selectedMarker && (
          <div className={`absolute top-3 right-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-xl w-[320px] sm:w-[360px] z-[1000] max-h-[calc(100%-24px)] overflow-hidden flex flex-col`}>
            {/* Panel Header - Different for each data source */}
            <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                {isPetRegistration ? (
                  <>
                    <div className={`p-2 rounded-lg ${selectedMarker.vaccinationStatus === 'vaccinated'
                      ? darkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'
                      : selectedMarker.vaccinationStatus === 'first_shot'
                        ? darkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                        : selectedMarker.vaccinationStatus === 'expired'
                          ? darkMode ? 'bg-red-500/20' : 'bg-red-100'
                          : darkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'
                      }`}>
                      <PawPrint size={18} className={
                        selectedMarker.vaccinationStatus === 'vaccinated' ? 'text-emerald-500' :
                          selectedMarker.vaccinationStatus === 'first_shot' ? 'text-purple-500' :
                            selectedMarker.vaccinationStatus === 'expired' ? 'text-red-500' :
                              'text-yellow-500'
                      } />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedMarker.petName || 'Pet'}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedMarker.vaccinationStatus === 'vaccinated' ? 'bg-emerald-100 text-emerald-700' :
                          selectedMarker.vaccinationStatus === 'first_shot' ? 'bg-purple-100 text-purple-700' :
                            selectedMarker.vaccinationStatus === 'expired' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                          }`}>
                          {selectedMarker.status === 'Registered' ? 'Registered (Not vaccinated)' : selectedMarker.status}
                        </span>
                        {isRecentRecord(selectedMarker) && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">NEW</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`p-2 rounded-lg ${selectedMarker.dogType === DOG_TYPES.STRAY
                      ? darkMode ? 'bg-red-500/20' : 'bg-red-100'
                      : darkMode ? 'bg-green-500/20' : 'bg-green-100'
                      }`}>
                      <PawPrint size={18} className={selectedMarker.dogType === DOG_TYPES.STRAY ? 'text-red-500' : 'text-green-500'} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedMarker.dogType} Dog
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedMarker.status === STATUS_TYPES.APPROVED
                          ? 'bg-green-100 text-green-700'
                          : selectedMarker.status === STATUS_TYPES.PENDING
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                          {selectedMarker.status}
                        </span>
                        {isRecentRecord(selectedMarker) && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">NEW</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setSelectedMarker(null)}
                className={`p-1.5 rounded-lg transition-all ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Image */}
              {selectedMarker.imageUrl && (
                <div className="relative">
                  <img
                    src={selectedMarker.imageUrl}
                    alt={isPetRegistration ? (selectedMarker.petName || 'Pet') : 'Dog'}
                    className="w-full h-48 object-cover"
                    onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
              )}

              {/* Details */}
              <div className="p-4 space-y-3">
                {/* Owner/Field Team */}
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {isPetRegistration ? 'Owner' : 'Field Team'}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {isPetRegistration
                      ? (selectedMarker.ownerName || 'N/A')
                      : selectedMarker.isBiteIncident
                        ? (selectedMarker.ucMcNumber || 'N/A')
                        : (selectedMarker.uploadedBy || 'N/A')}
                  </p>
                  {isPetRegistration && selectedMarker.ownerPhone && (
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selectedMarker.ownerPhone}
                    </p>
                  )}
                </div>

                {/* Breed - only for pet registration */}
                {isPetRegistration && (
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <PawPrint size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Breed</span>
                    </div>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedMarker.breed || 'N/A'}
                    </p>
                  </div>
                )}

                {/* Location Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Tehsil</span>
                    </div>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedMarker.tahsil || 'N/A'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>District</span>
                    </div>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedMarker.isBiteIncident ? 'Vehari' : (selectedMarker.district || 'N/A')}
                    </p>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Date</span>
                    </div>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedMarker.date?.toLocaleDateString() || 'N/A'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Time</span>
                    </div>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedMarker.date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* GPS Coordinates */}
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Navigation size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>GPS Coordinates</span>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${selectedMarker.latitude},${selectedMarker.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink size={12} />
                      Open in Maps
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Latitude</span>
                      <p className={`text-xs font-mono font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedMarker.latitude?.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Longitude</span>
                      <p className={`text-xs font-mono font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedMarker.longitude?.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <p className={`text-[10px] mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    GPS coordinates represent the exact location where this record was captured
                  </p>
                </div>

                {/* View Detail Button - Only for Pet Registration */}
                {isPetRegistration && (
                  <button
                    onClick={() => navigate('/pet-registered-view', { state: { selectedPetId: selectedMarker.docId || selectedMarker.id } })}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${darkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                  >
                    <Eye size={16} />
                    View Full Details
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMap;
