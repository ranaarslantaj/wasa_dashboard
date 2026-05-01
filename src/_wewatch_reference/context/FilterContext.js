import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { DISTRICTS, DISTRICT_TEHSILS, getTehsilsForDistrict, getDistrictsForDivision } from '../constants';

const FilterContext = createContext(null);

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

export const FilterProvider = ({ children }) => {
  const { adminScope } = useAuth();

  // Filter states
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTahsil, setSelectedTahsil] = useState('');
  const [selectedUC, setSelectedUC] = useState('');
  const [selectedDogType, setSelectedDogType] = useState('');
  const [timeRange, setTimeRange] = useState('All Time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UC lookup data
  const [ucLookup, setUcLookup] = useState({});
  const [ucLookupLoading, setUcLookupLoading] = useState(true);

  // Auto-set locked values based on admin scope
  useEffect(() => {
    if (!adminScope) return;

    if (adminScope.accessLevel === 'district' && adminScope.district) {
      setSelectedDistrict(adminScope.district);
    } else if (adminScope.accessLevel === 'tehsil' && adminScope.district && adminScope.tehsil) {
      setSelectedDistrict(adminScope.district);
      setSelectedTahsil(adminScope.tehsil);
    }
    // Division-level: no auto-set, user can filter freely
  }, [adminScope]);

  // Available districts based on scope
  const availableDistricts = useMemo(() => {
    if (!adminScope) return DISTRICTS;
    if (adminScope.accessLevel === 'division' && adminScope.division) return getDistrictsForDivision(adminScope.division);
    if (adminScope.accessLevel === 'district' && adminScope.district) return [adminScope.district];
    if (adminScope.accessLevel === 'tehsil' && adminScope.district) return [adminScope.district];
    return DISTRICTS; // province level
  }, [adminScope]);

  // Available tehsils based on scope and selected district
  const availableTahsils = useMemo(() => {
    if (!adminScope) return [];

    // Tehsil-level user: only their tehsil
    if (adminScope.accessLevel === 'tehsil' && adminScope.tehsil) {
      return [adminScope.tehsil];
    }

    // District-level user: tehsils of their locked district
    if (adminScope.accessLevel === 'district' && adminScope.district) {
      return getTehsilsForDistrict(adminScope.district);
    }

    // Based on selected district
    if (selectedDistrict) {
      return getTehsilsForDistrict(selectedDistrict);
    }

    // Division-level user with no district selected: only tehsils within their division's districts
    if (adminScope.accessLevel === 'division' && adminScope.division) {
      return getDistrictsForDivision(adminScope.division).flatMap(d => getTehsilsForDistrict(d));
    }

    // Province-level: return all tehsils across all districts
    return Object.values(DISTRICT_TEHSILS).flat();
  }, [adminScope, selectedDistrict]);

  // Whether district filter is locked (user can't change it)
  const isDistrictLocked = useMemo(() => {
    return adminScope?.accessLevel === 'district' || adminScope?.accessLevel === 'tehsil';
  }, [adminScope]);

  // Whether tehsil filter is locked
  const isTehsilLocked = useMemo(() => {
    return adminScope?.accessLevel === 'tehsil';
  }, [adminScope]);

  // Fetch UnionCouncils for UC name lookup
  useEffect(() => {
    const fetchUCLookup = async () => {
      try {
        const ucSnapshot = await getDocs(collection(db, 'UnionCouncils'));
        const lookup = {};
        ucSnapshot.forEach((doc) => {
          const ucData = doc.data();
          const ucId = ucData.uid || doc.id;
          if (ucId && ucData.uc) {
            lookup[ucId] = {
              uc: ucData.uc,
              name: ucData.name,
              tahsil: ucData.tahsil,
              district: ucData.district || 'Vehari'
            };
          }
        });
        setUcLookup(lookup);
      } catch (err) {
        console.error('Error fetching UC lookup:', err);
      } finally {
        setUcLookupLoading(false);
      }
    };
    fetchUCLookup();
  }, []);

  // Get UC name from lookup
  const getUCName = (ucId) => {
    return ucLookup[ucId]?.uc || ucId;
  };

  // Handle District change - reset tahsil and UC
  const handleDistrictChange = useCallback((value) => {
    if (isDistrictLocked) return; // Don't allow changing if locked
    setSelectedDistrict(value);
    setSelectedTahsil('');
    setSelectedUC('');
  }, [isDistrictLocked]);

  // Handle Tahsil change - reset UC when tahsil changes
  const handleTahsilChange = useCallback((value) => {
    if (isTehsilLocked) return; // Don't allow changing if locked
    setSelectedTahsil(value);
    setSelectedUC('');
  }, [isTehsilLocked]);

  // Handle Time Range change - automatically set dates
  const handleTimeRangeChange = (value) => {
    setTimeRange(value);

    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

    switch (value) {
      case 'This Week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        setStartDate(formatDate(startOfWeek));
        setEndDate(formatDate(today));
        break;
      }
      case 'This Month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(formatDate(startOfMonth));
        setEndDate(formatDate(today));
        break;
      }
      case 'Last Month': {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(formatDate(startOfLastMonth));
        setEndDate(formatDate(endOfLastMonth));
        break;
      }
      case 'Custom':
        // Keep existing dates for custom
        break;
      case 'All Time':
      default:
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  // Reset all filters (respects scope locks)
  const resetFilters = useCallback(() => {
    if (!isDistrictLocked) setSelectedDistrict('');
    if (!isTehsilLocked) setSelectedTahsil('');
    setSelectedUC('');
    setSelectedDogType('');
    setTimeRange('All Time');
    setStartDate('');
    setEndDate('');
  }, [isDistrictLocked, isTehsilLocked]);

  // Check if any filter is active (beyond scope-locked defaults)
  const hasActiveFilters = useMemo(() => {
    const hasDistrictFilter = !isDistrictLocked && selectedDistrict;
    const hasTahsilFilter = !isTehsilLocked && selectedTahsil;
    return hasDistrictFilter || hasTahsilFilter || selectedUC || selectedDogType || startDate || endDate;
  }, [selectedDistrict, selectedTahsil, selectedUC, selectedDogType, startDate, endDate, isDistrictLocked, isTehsilLocked]);

  // Filters object for passing to hooks (includes district)
  const filters = useMemo(() => ({
    district: selectedDistrict,
    tahsil: selectedTahsil,
    uc: selectedUC,
    dogType: selectedDogType,
    startDate,
    endDate
  }), [selectedDistrict, selectedTahsil, selectedUC, selectedDogType, startDate, endDate]);

  const value = {
    // Filter values
    selectedDistrict,
    selectedTahsil,
    selectedUC,
    selectedDogType,
    timeRange,
    startDate,
    endDate,
    filters,
    hasActiveFilters,

    // Available options (scope-aware)
    availableDistricts,
    availableTahsils,
    isDistrictLocked,
    isTehsilLocked,

    // Setters
    setSelectedDistrict: handleDistrictChange,
    setSelectedTahsil: handleTahsilChange,
    setSelectedUC,
    setSelectedDogType,
    setTimeRange: handleTimeRangeChange,
    setStartDate,
    setEndDate,
    resetFilters,

    // UC lookup
    ucLookup,
    ucLookupLoading,
    getUCName
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

export default FilterContext;
