import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, initAnalyticsWithIds, trackPageView, setRuntimeConfig } from '@/lib/analytics';
import axios from 'axios';

export default function AnalyticsTracker() {
  const location = useLocation();

  // Initialize analytics once on mount
  useEffect(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    let cancelled = false;

    async function setup() {
      try {
        if (backendUrl) {
          const { data } = await axios.get(`${backendUrl}/api/analytics/config`);
          if (!cancelled && data) {
            setRuntimeConfig(data);
            if (data.ga_measurement_id || data.meta_pixel_id) {
              initAnalyticsWithIds(data.ga_measurement_id, data.meta_pixel_id);
              return;
            }
          }
        }
      } catch (err) {
        // ignore errors and fallback
      }
      if (!cancelled) initAnalytics();
    }

    setup();
    return () => { cancelled = true; };
  }, []);

  // Track page views on location changes
  useEffect(() => {
    const path = location.pathname + location.search;
    const title = document.title;
    trackPageView(path, title);
  }, [location.pathname, location.search]);

  return null;
}