import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  Navigation,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Compass,
} from 'lucide-react';
import { toast } from 'sonner';

// Fallback open raster style for guaranteed rendering if mapbox token is restricted/unavailable
const OPEN_STREET_STYLE: any = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const DEFAULT_MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? '';
const HAS_VALID_ENV_TOKEN = DEFAULT_MAPBOX_TOKEN.startsWith('pk.');

interface MapboxLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAddress?: string;
  initialLandmark?: string;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (location: {
    address: string;
    landmark: string;
    latitude: number;
    longitude: number;
  }) => void;
}

interface GeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
}

export const MapboxLocationModal: React.FC<MapboxLocationModalProps> = ({
  open,
  onOpenChange,
  initialAddress = '',
  initialLandmark = '',
  initialLat,
  initialLng,
  onConfirm,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Default coordinates: Pune / India or provided initial
  const defaultLat = initialLat && !isNaN(initialLat) ? initialLat : 18.5204;
  const defaultLng = initialLng && !isNaN(initialLng) ? initialLng : 73.8567;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });
  const [address, setAddress] = useState(initialAddress);
  const [landmark, setLandmark] = useState(initialLandmark);

  // Search autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Sync state on open
  useEffect(() => {
    if (open) {
      setAddress(initialAddress || '');
      setLandmark(initialLandmark || '');
      const validLat = initialLat && !isNaN(initialLat) ? initialLat : 18.5204;
      const validLng = initialLng && !isNaN(initialLng) ? initialLng : 73.8567;
      setCoords({ lat: validLat, lng: validLng });
      setMapError(null);
      setMapLoading(true);
    }
  }, [open, initialAddress, initialLandmark, initialLat, initialLng]);

  // Reverse geocoding helper using Mapbox API or fallback geocoding
  const reverseGeocode = async (lng: number, lat: number) => {
    try {
      if (HAS_VALID_ENV_TOKEN) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${DEFAULT_MAPBOX_TOKEN}&types=address,poi,neighborhood,locality`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const top = data.features[0];
            setAddress(top.place_name);
            if (data.features[1] && !landmark) {
              setLandmark(data.features[1].text);
            }
            return;
          }
        }
      }

      // Fallback reverse geocoding via OpenStreetMap Nominatim
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const nomRes = await fetch(nomUrl, {
        headers: { 'Accept-Language': 'en' },
      });
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (nomData.display_name) {
          setAddress(nomData.display_name);
          const road = nomData.address?.road || nomData.address?.suburb || nomData.address?.neighbourhood;
          if (road && !landmark) {
            setLandmark(road);
          }
        }
      }
    } catch {
      // Graceful error handling
    }
  };

  // Initialize Mapbox map
  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

    let mapInstance: mapboxgl.Map | null = null;
    let usingFallbackStyle = !HAS_VALID_ENV_TOKEN;

    try {
      mapboxgl.accessToken = DEFAULT_MAPBOX_TOKEN;

      const mapStyle = HAS_VALID_ENV_TOKEN
        ? 'mapbox://styles/mapbox/streets-v12'
        : OPEN_STREET_STYLE;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: [coords.lng, coords.lat],
        zoom: 15,
        attributionControl: false,
      });

      mapInstance = map;

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.once('load', () => {
        setMapLoading(false);
        map.resize();
      });

      // Create draggable custom marker
      const marker = new mapboxgl.Marker({
        draggable: true,
        color: '#dc2626', // PrintOn24 Crimson red
      })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const newCoords = { lat: Number(lngLat.lat.toFixed(6)), lng: Number(lngLat.lng.toFixed(6)) };
        setCoords(newCoords);
        reverseGeocode(newCoords.lng, newCoords.lat);
      });

      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        const newCoords = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
        marker.setLngLat([lng, lat]);
        setCoords(newCoords);
        reverseGeocode(newCoords.lng, newCoords.lat);
      });

      map.on('error', (e) => {
        const message = e.error?.message || 'Map tiles could not be loaded.';
        const mapboxAuthError =
          /401|403|unauthorized|forbidden|access token/i.test(message);
        if (!usingFallbackStyle && mapboxAuthError && mapInstance) {
          usingFallbackStyle = true;
          setMapError('Mapbox could not load. Switching to OpenStreetMap…');
          mapInstance.setStyle(OPEN_STREET_STYLE);
        } else if (usingFallbackStyle) {
          setMapLoading(false);
          setMapError('The live map could not be loaded. Check your internet connection and try again.');
        }
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Clean resize on modal display and observe container size transitions
      const t1 = setTimeout(() => {
        map.resize();
      }, 80);
      const t2 = setTimeout(() => {
        map.resize();
      }, 300);

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          map.resize();
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
      };
    } catch (err: any) {
      setMapLoading(false);
      setMapError(err?.message || 'Failed to initialize Mapbox view.');
    }
  }, [open]);

  // Geocoding search autocomplete
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        if (HAS_VALID_ENV_TOKEN) {
          const token = DEFAULT_MAPBOX_TOKEN;
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            searchQuery.trim()
          )}.json?access_token=${token}&autocomplete=true&limit=5`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              setSearchResults(data.features || []);
              setShowResults(true);
              setSearching(false);
              return;
            }
          }
        }

        // Fallback geocoding search via OpenStreetMap Nominatim
        const nomSearchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          searchQuery.trim()
        )}&limit=5`;
        const nomRes = await fetch(nomSearchUrl, {
          headers: { 'Accept-Language': 'en' },
        });
        if (nomRes.ok) {
          const list = await nomRes.json();
          const mapped: GeocodingFeature[] = list.map((item: any) => ({
            id: String(item.place_id),
            place_name: item.display_name,
            text: item.name || item.display_name.split(',')[0],
            center: [Number(item.lon), Number(item.lat)],
          }));
          setSearchResults(mapped);
          setShowResults(true);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle address select from search
  const handleSelectSearchResult = (feature: GeocodingFeature) => {
    const [lng, lat] = feature.center;
    const newCoords = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    setCoords(newCoords);
    setAddress(feature.place_name);
    setSearchQuery('');
    setShowResults(false);

    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 16, essential: true });
      markerRef.current.setLngLat([lng, lat]);
    }
  };

  // Device current geolocation
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocating(false);
        const { latitude, longitude } = pos.coords;
        const newCoords = {
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6)),
        };
        setCoords(newCoords);

        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 16, essential: true });
          markerRef.current.setLngLat([longitude, latitude]);
        }
        reverseGeocode(newCoords.lng, newCoords.lat);
        toast.success('Centered to your device current location');
      },
      (error) => {
        setGeolocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location permission was denied. Please allow location access or pick manually on the map.');
        } else {
          toast.error('Unable to retrieve current location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleConfirmLocation = () => {
    if (!address.trim()) {
      toast.error('Physical address cannot be empty');
      return;
    }
    onConfirm({
      address: address.trim(),
      landmark: landmark.trim(),
      latitude: coords.lat,
      longitude: coords.lng,
    });
    onOpenChange(false);
    toast.success('Location coordinates & address updated successfully!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto p-4 md:p-6 font-sans">
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="text-base font-heading font-bold text-foreground flex items-center gap-2 uppercase">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Mapbox Shop Geolocation &amp; Address</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-sans">
            Search your address, drag the marker, or tap the map to pin exact GPS coordinates for nearby customer routing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search bar & Current location button */}
          <div className="flex flex-col sm:flex-row gap-2 relative">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search street, area, college, or landmark..."
                className="pl-9 pr-8 text-xs h-9 rounded-lg"
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-primary animate-spin absolute right-3 top-2.5" />
              )}

              {/* Autocomplete Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-10 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto text-xs">
                  {searchResults.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelectSearchResult(f)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-start gap-2 border-b border-border/50 last:border-b-0 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{f.text}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{f.place_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCurrentLocation}
              disabled={geolocating}
              className="text-xs h-9 rounded-lg gap-1.5 shrink-0 border-border text-primary hover:bg-muted"
            >
              {geolocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-primary" />
              )}
              <span>Current Device Location</span>
            </Button>
          </div>

          {mapError && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{mapError}</span>
            </div>
          )}

          {/* Mapbox Canvas Container */}
          <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden border border-border shadow-inner bg-muted/40">
            <div ref={mapContainerRef} className="w-full h-full" />
            {mapLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/70 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                Loading live map…
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm border border-border px-2 py-1 rounded text-[10px] font-mono text-muted-foreground z-10 flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-primary" />
              <span>
                Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
              </span>
            </div>
          </div>

          {/* Address & Landmark Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Physical Address <span className="text-destructive">*</span>
              </Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No., Street Name, Area"
                className="text-xs h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Nearby Landmark
              </Label>
              <Input
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Opposite University Gate, Near Metro Station"
                className="text-xs h-9 rounded-lg"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmLocation}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold h-9 px-4 rounded-lg gap-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm &amp; Apply Location</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
