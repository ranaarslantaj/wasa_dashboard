import React, { useMemo } from 'react';
import { Filter, Building2, MapPin, PawPrint, Clock, Calendar, RotateCcw, Globe } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { DOG_TYPES } from '../constants';

const Filters = ({ darkMode, firebaseData = [] }) => {
  const {
    selectedDistrict,
    selectedTahsil,
    selectedUC,
    selectedDogType,
    timeRange,
    startDate,
    endDate,
    hasActiveFilters,
    availableDistricts,
    availableTahsils,
    isDistrictLocked,
    isTehsilLocked,
    setSelectedDistrict,
    setSelectedTahsil,
    setSelectedUC,
    setSelectedDogType,
    setTimeRange,
    setStartDate,
    setEndDate,
    resetFilters,
    ucLookup
  } = useFilters();

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
  }, [selectedDistrict, selectedTahsil, ucLookup, availableDistricts]);

  const selectClass = `w-full px-3 py-2.5 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-blue-500/20 ${
    darkMode
      ? 'bg-gray-700/50 border-gray-600 text-white hover:border-gray-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300'
  }`;

  const disabledSelectClass = `w-full px-3 py-2.5 rounded-lg border text-sm cursor-not-allowed opacity-60 ${
    darkMode
      ? 'bg-gray-700/30 border-gray-600 text-gray-400'
      : 'bg-gray-100 border-gray-200 text-gray-500'
  }`;

  const labelClass = `flex items-center gap-1.5 text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`;

  // Show district filter when there are multiple districts available or when locked to a district
  const showDistrictFilter = availableDistricts.length > 1 || isDistrictLocked;

  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} rounded-xl shadow-sm border p-4 sm:p-5 lg:p-6 mb-4 sm:mb-6`}>
      {/* Filter Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/50' : 'bg-blue-50'}`}>
            <Filter size={16} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
          </div>
          <span className={`font-medium text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <RotateCcw size={12} />
            Clear All
          </button>
        )}
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-3 ${showDistrictFilter ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-3 sm:gap-4`}>
        {/* District */}
        {showDistrictFilter && (
          <div className="space-y-1.5">
            <label className={labelClass}>
              <Globe size={12} />
              District
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className={isDistrictLocked ? disabledSelectClass : selectClass}
              disabled={isDistrictLocked}
            >
              <option value="">All Districts</option>
              {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {/* Tehsil */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            <Building2 size={12} />
            Tehsil
          </label>
          <select
            value={selectedTahsil}
            onChange={(e) => setSelectedTahsil(e.target.value)}
            className={isTehsilLocked ? disabledSelectClass : selectClass}
            disabled={isTehsilLocked}
          >
            <option value="">All Tehsils</option>
            {availableTahsils.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Union Council */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            <MapPin size={12} />
            Union Council
          </label>
          <select
            value={selectedUC}
            onChange={(e) => setSelectedUC(e.target.value)}
            className={selectClass}
          >
            <option value="">All UCs</option>
            {availableUCs.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>

        {/* Dog Type */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            <PawPrint size={12} />
            Dog Type
          </label>
          <select
            value={selectedDogType}
            onChange={(e) => setSelectedDogType(e.target.value)}
            className={selectClass}
          >
            <option value="">All Types</option>
            <option value={DOG_TYPES.STRAY}>{DOG_TYPES.STRAY}</option>
            <option value={DOG_TYPES.PET}>{DOG_TYPES.PET}</option>
          </select>
        </div>

        {/* Time Range */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            <Clock size={12} />
            Time Range
          </label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className={selectClass}
          >
            <option value="All Time">All Time</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            <Calendar size={12} />
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={selectClass}
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            <Calendar size={12} />
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={selectClass}
          />
        </div>
      </div>
    </div>
  );
};

export default Filters;
