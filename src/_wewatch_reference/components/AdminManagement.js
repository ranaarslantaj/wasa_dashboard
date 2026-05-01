import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Shield, UserPlus, Eye, EyeOff, Loader2, AlertCircle,
  Trash2, X, CheckCircle, Users, AlertTriangle, Mail,
  MapPin, Clock, Building2, ChevronRight, Edit3, ChevronLeft,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import useAdmin from '../hooks/useAdmin';
import { useAuth } from '../context/AuthContext';
import {
  DIVISION, getTehsilsForDistrict, ACCESS_LEVELS,
  PROVINCES, getDivisionsForProvince, getDistrictsForDivision
} from '../constants';

const ITEMS_PER_PAGE = 10;

const AdminManagement = () => {
  const { darkMode } = useOutletContext();
  const { admin: currentAdmin } = useAuth();
  const { createAdmin, updateAdmin, deleteAdmin, loading: hookLoading } = useAdmin();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // Edit state
  const [adminToEdit, setAdminToEdit] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accessLevel: 'district',
    province: 'Punjab',
    division: 'Multan',
    district: '',
    tehsil: '',
    status: 'active'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const formDivisions = useMemo(() => {
    return formData.province ? getDivisionsForProvince(formData.province) : [];
  }, [formData.province]);

  const formDistricts = useMemo(() => {
    return formData.division ? getDistrictsForDivision(formData.division) : [];
  }, [formData.division]);

  const formTehsils = useMemo(() => {
    return formData.district ? getTehsilsForDistrict(formData.district) : [];
  }, [formData.district]);

  // Pagination calculations
  const totalPages = Math.ceil(admins.length / ITEMS_PER_PAGE);
  const paginatedAdmins = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return admins.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [admins, currentPage]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'Admins'));
      const adminsList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        adminsList.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || null,
          lastLogin: data.lastLogin?.toDate?.() || null
        });
      });
      // Sort by createdAt descending (latest first)
      adminsList.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt - a.createdAt;
      });
      setAdmins(adminsList);
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Reset page when admins change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleAccessLevelChange = (level) => {
    setFormData({
      ...formData,
      accessLevel: level,
      division: level === 'province' ? '' : (formData.division || 'Multan'),
      district: (level === 'province' || level === 'division') ? '' : formData.district,
      tehsil: level === 'tehsil' ? formData.tehsil : ''
    });
  };

  const handleProvinceChange = (province) => {
    setFormData({
      ...formData,
      province,
      division: '',
      district: '',
      tehsil: ''
    });
  };

  const handleDivisionChange = (division) => {
    setFormData({
      ...formData,
      division,
      district: '',
      tehsil: ''
    });
  };

  const handleDistrictChange = (district) => {
    setFormData({ ...formData, district, tehsil: '' });
  };

  const resetForm = () => {
    setFormData({
      firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
      accessLevel: 'district', province: 'Punjab', division: 'Multan', district: '', tehsil: '',
      status: 'active'
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  // Edit handlers
  const openEditModal = (admin) => {
    setAdminToEdit(admin);
    setFormData({
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      email: admin.email || '',
      password: '',
      confirmPassword: '',
      accessLevel: admin.accessLevel || 'division',
      province: admin.province || 'Punjab',
      division: admin.division || 'Multan',
      district: admin.district || '',
      tehsil: admin.tehsil || '',
      status: admin.status || 'active'
    });
    setError('');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setAdminToEdit(null);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Valid email is required');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.accessLevel === 'division' && !formData.division) {
      setError('Please select a division');
      return;
    }
    if (formData.accessLevel === 'district' && !formData.district) {
      setError('Please select a district');
      return;
    }
    if (formData.accessLevel === 'tehsil' && (!formData.district || !formData.tehsil)) {
      setError('Please select both district and tehsil');
      return;
    }

    const adminData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      role: formData.accessLevel === 'province' ? 'Super Admin' :
        formData.accessLevel === 'division' ? 'Divisional Admin' :
          formData.accessLevel === 'district' ? 'District Admin' : 'Tehsil Admin',
      accessLevel: formData.accessLevel,
      province: formData.province,
      division: formData.division
    };

    if (formData.accessLevel === 'district' || formData.accessLevel === 'tehsil') {
      adminData.district = formData.district;
    }
    if (formData.accessLevel === 'tehsil') {
      adminData.tehsil = formData.tehsil;
    }

    const result = await createAdmin(adminData);

    if (result.success) {
      setSuccess('Admin created successfully!');
      closeCreateModal();
      fetchAdmins();
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setError(result.error || 'Failed to create admin');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!adminToEdit) return;

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Valid email is required');
      return;
    }
    if (formData.accessLevel === 'division' && !formData.division) {
      setError('Please select a division');
      return;
    }
    if (formData.accessLevel === 'district' && !formData.district) {
      setError('Please select a district');
      return;
    }
    if (formData.accessLevel === 'tehsil' && (!formData.district || !formData.tehsil)) {
      setError('Please select both district and tehsil');
      return;
    }

    setEditLoading(true);

    const updateData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: adminToEdit.email, // Keep original email (cannot be changed)
      phoneNumber: formData.phoneNumber || '',
      accessLevel: formData.accessLevel,
      role: formData.accessLevel === 'province' ? 'Super Admin' :
        formData.accessLevel === 'division' ? 'Divisional Admin' :
          formData.accessLevel === 'district' ? 'District Admin' : 'Tehsil Admin',
      province: formData.province,
      division: formData.division,
      district: formData.district,
      tehsil: formData.tehsil,
      status: formData.status,
      originalEmail: adminToEdit.email
    };

    const result = await updateAdmin(
      adminToEdit.id,
      updateData,
      null,
      null
    );

    setEditLoading(false);

    if (result.success) {
      setSuccess('Admin updated successfully!');
      closeEditModal();
      fetchAdmins();
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setError(result.error || 'Failed to update admin');
    }
  };

  const handleDeleteClick = (admin) => {
    if (admin.id === currentAdmin?.id) {
      setError("You can't delete your own account");
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (admin.email === 'dev@team.com') {
      setError("The master admin account cannot be deleted");
      setTimeout(() => setError(''), 3000);
      return;
    }
    setAdminToDelete(admin);
    setDeletePassword('');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!adminToDelete) return;

    if (!deletePassword) {
      setError('Please enter the admin password');
      return;
    }

    setDeleteLoading(true);
    setError('');

    try {
      const result = await deleteAdmin(adminToDelete.id, adminToDelete.email, deletePassword);

      if (result.success) {
        setSuccess('Admin deleted successfully');
        setShowDeleteModal(false);
        setAdminToDelete(null);
        setDeletePassword('');
        fetchAdmins();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(result.error || 'Failed to delete admin');
      }
    } catch (err) {
      setError('Failed to delete admin: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setAdminToDelete(null);
    setDeletePassword('');
    setError('');
  };

  const getScopeLabel = (admin) => {
    const level = admin.accessLevel || 'division';
    if (level === 'tehsil') return `${admin.tehsil}, ${admin.district}`;
    if (level === 'district') return `${admin.district} District`;
    if (level === 'division') return `${admin.division || DIVISION} Division`;
    return `${admin.province || 'Punjab'} Province`;
  };

  const getAccessLevelIcon = (level) => {
    if (level === 'tehsil') return <MapPin size={12} />;
    if (level === 'district') return <Building2 size={12} />;
    return <Shield size={12} />;
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${darkMode
    ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
    }`;

  const selectClass = `w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer ${darkMode
    ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
    }`;

  // Pagination component
  const Pagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4);
        if (totalPages > 4) pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        if (totalPages > 4) pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1, currentPage, currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return (
      <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, admins.length)} of {admins.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
          >
            <ChevronLeft size={16} />
          </button>

          <div className="hidden sm:flex items-center gap-1 mx-2">
            {pages.map((page, index) => (
              page === '...' ? (
                <span key={`ellipsis-${index}`} className={`px-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${currentPage === page
                    ? 'bg-blue-600 text-white'
                    : darkMode
                      ? 'hover:bg-gray-700 text-gray-300'
                      : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          <span className={`sm:hidden px-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${darkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
            <Shield size={24} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Admin Management
            </h1>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Manage administrator accounts and permissions
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
        >
          <UserPlus size={18} />
          <span>Add Admin</span>
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className={`flex items-center gap-3 p-4 mb-6 rounded-xl ${darkMode ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
          <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
          <p className={`text-sm font-medium ${darkMode ? 'text-green-400' : 'text-green-700'}`}>{success}</p>
          <button onClick={() => setSuccess('')} className="ml-auto p-1 rounded-lg hover:bg-green-500/10">
            <X size={16} className="text-green-500" />
          </button>
        </div>
      )}
      {error && !showCreateModal && !showEditModal && !showDeleteModal && (
        <div className={`flex items-center gap-3 p-4 mb-6 rounded-xl ${darkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className={`text-sm font-medium ${darkMode ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
          <button onClick={() => setError('')} className="ml-auto p-1 rounded-lg hover:bg-red-500/10">
            <X size={16} className="text-red-500" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</span>
          </div>
          <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{admins.length}</p>
        </div>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-purple-500" />
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Super Admin</span>
          </div>
          <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {admins.filter(a => a.accessLevel === 'province').length}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-blue-500" />
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Division</span>
          </div>
          <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {admins.filter(a => a.accessLevel === 'division').length}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-blue-500" />
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>District</span>
          </div>
          <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {admins.filter(a => a.accessLevel === 'district').length}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={16} className="text-green-500" />
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Tehsil</span>
          </div>
          <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {admins.filter(a => a.accessLevel === 'tehsil').length}
          </p>
        </div>
      </div>

      {/* Admins List */}
      <div className={`rounded-2xl overflow-hidden ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100 shadow-sm'}`}>
        <div className={`px-4 sm:px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <Users size={18} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
            <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Administrators</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              {admins.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-3" />
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading administrators...</p>
          </div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Users size={24} className={darkMode ? 'text-gray-500' : 'text-gray-400'} />
            </div>
            <p className={`font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No administrators yet</p>
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Add your first admin to get started</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {paginatedAdmins.map((adminItem) => (
                <div
                  key={adminItem.id}
                  className={`p-4 sm:px-6 transition-all ${darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    {/* Avatar */}
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${adminItem.role === 'Super Admin'
                      ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                      : 'bg-gradient-to-br from-blue-500 to-blue-700'
                      }`}>
                      {adminItem.firstName?.[0]?.toUpperCase()}{adminItem.lastName?.[0]?.toUpperCase() || ''}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <h4 className={`font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {adminItem.firstName} {adminItem.lastName}
                          {adminItem.id === currentAdmin?.id && (
                            <span className={`ml-2 text-xs font-normal ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(You)</span>
                          )}
                        </h4>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium w-fit ${adminItem.role === 'Super Admin'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                          }`}>
                          {adminItem.role === 'Super Admin' ? <Shield size={10} /> : null}
                          {adminItem.role || 'Admin'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${adminItem.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                          }`}>
                          {adminItem.status || 'active'}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                        <div className={`flex items-center gap-1.5 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <Mail size={12} />
                          <span className="truncate">{adminItem.email}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {getAccessLevelIcon(adminItem.accessLevel)}
                          <span>{getScopeLabel(adminItem)}</span>
                        </div>
                      </div>

                      {/* Mobile: Show last login */}
                      <div className={`sm:hidden flex items-center gap-1.5 mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <Clock size={12} />
                        <span>Last login: {formatDate(adminItem.lastLogin)}{adminItem.lastLogin ? ` at ${formatTime(adminItem.lastLogin)}` : ''}</span>
                      </div>
                    </div>

                    {/* Desktop: Last Login & Actions */}
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="text-right mr-2">
                        <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {formatDate(adminItem.lastLogin)}
                        </p>
                        <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {adminItem.lastLogin ? formatTime(adminItem.lastLogin) : 'Never logged in'}
                        </p>
                      </div>
                      <button
                        onClick={() => openEditModal(adminItem)}
                        className={`p-2.5 rounded-xl transition-all ${darkMode
                          ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10'
                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                        title="Edit admin"
                      >
                        <Edit3 size={18} />
                      </button>
                      {adminItem.id !== currentAdmin?.id && adminItem.email !== 'dev@team.com' && (
                        <button
                          onClick={() => handleDeleteClick(adminItem)}
                          className={`p-2.5 rounded-xl transition-all ${darkMode
                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          title="Delete admin"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>

                    {/* Mobile: Actions */}
                    <div className="sm:hidden flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(adminItem)}
                        className={`p-2 rounded-lg transition-all ${darkMode
                          ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10'
                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                      >
                        <Edit3 size={18} />
                      </button>
                      {adminItem.id !== currentAdmin?.id && adminItem.email !== 'dev@team.com' && (
                        <button
                          onClick={() => handleDeleteClick(adminItem)}
                          className={`p-2 rounded-lg transition-all ${darkMode
                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination />
          </>
        )}
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className={`w-full max-w-lg m-auto rounded-2xl shadow-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`sticky top-0 z-10 px-6 py-4 border-b rounded-t-2xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${darkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <UserPlus size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Add New Admin</h2>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Create administrator account</p>
                  </div>
                </div>
                <button onClick={closeCreateModal} className={`p-2 rounded-xl transition-all ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${darkMode ? 'bg-red-900/20 border border-red-800 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>First Name</label>
                  <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={inputClass} placeholder="John" disabled={hookLoading} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Last Name</label>
                  <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={inputClass} placeholder="Doe" disabled={hookLoading} />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email Address</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder="admin@example.com" disabled={hookLoading} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={`${inputClass} pr-11`} placeholder="Min 6 characters" disabled={hookLoading} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} className={`${inputClass} pr-11`} placeholder="Confirm password" disabled={hookLoading} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Access Level</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: ACCESS_LEVELS.PROVINCE, label: 'Province', icon: Shield, desc: 'Full Province' },
                    { value: ACCESS_LEVELS.DIVISION, label: 'Division', icon: Building2, desc: 'One Division' },
                    { value: ACCESS_LEVELS.DISTRICT, label: 'District', icon: Building2, desc: 'One District' },
                    { value: ACCESS_LEVELS.TEHSIL, label: 'Tehsil', icon: MapPin, desc: 'One Tehsil' }
                  ].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => handleAccessLevelChange(opt.value)} disabled={hookLoading}
                      className={`p-3 rounded-xl border text-center transition-all ${formData.accessLevel === opt.value ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20' : darkMode ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <opt.icon size={18} className={`mx-auto mb-1 ${formData.accessLevel === opt.value ? 'text-blue-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      <p className={`text-sm font-medium ${formData.accessLevel === opt.value ? 'text-blue-500' : darkMode ? 'text-gray-200' : 'text-gray-900'}`}>{opt.label}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Province</label>
                <div className="relative">
                  <select value={formData.province} onChange={(e) => handleProvinceChange(e.target.value)} className={selectClass} disabled={hookLoading}>
                    <option value="">Select Province</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
              </div>

              {(formData.accessLevel === 'division' || formData.accessLevel === 'district' || formData.accessLevel === 'tehsil') && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Division</label>
                  <div className="relative">
                    <select value={formData.division} onChange={(e) => handleDivisionChange(e.target.value)} className={selectClass} disabled={hookLoading || !formData.province}>
                      <option value="">Select Division</option>
                      {formDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                </div>
              )}

              {(formData.accessLevel === 'district' || formData.accessLevel === 'tehsil') && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>District</label>
                  <div className="relative">
                    <select value={formData.district} onChange={(e) => handleDistrictChange(e.target.value)} className={selectClass} disabled={hookLoading || !formData.division}>
                      <option value="">Select District</option>
                      {formDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                </div>
              )}

              {formData.accessLevel === 'tehsil' && formData.district && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Tehsil</label>
                  <div className="relative">
                    <select value={formData.tehsil} onChange={(e) => setFormData({ ...formData, tehsil: e.target.value })} className={selectClass} disabled={hookLoading}>
                      <option value="">Select Tehsil</option>
                      {formTehsils.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                </div>
              )}

              <div className={`flex flex-col-reverse sm:flex-row items-center gap-3 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <button type="button" onClick={closeCreateModal} disabled={hookLoading} className={`w-full sm:w-auto px-5 py-3 text-sm font-medium rounded-xl transition-all ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>Cancel</button>
                <button type="submit" disabled={hookLoading} className="w-full sm:flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {hookLoading ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : <><UserPlus size={18} /> Create Admin</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditModal && adminToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className={`w-full max-w-lg m-auto rounded-2xl shadow-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`sticky top-0 z-10 px-6 py-4 border-b rounded-t-2xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${darkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <Edit3 size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Edit Admin</h2>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{adminToEdit.email}</p>
                  </div>
                </div>
                <button onClick={closeEditModal} className={`p-2 rounded-xl transition-all ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              {error && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${darkMode ? 'bg-red-900/20 border border-red-800 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>First Name</label>
                  <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={inputClass} placeholder="John" disabled={editLoading} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Last Name</label>
                  <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={inputClass} placeholder="Doe" disabled={editLoading} />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className={`${inputClass} cursor-not-allowed opacity-60`}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Email cannot be changed. Delete and recreate admin if needed.
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Access Level</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: ACCESS_LEVELS.PROVINCE, label: 'Province', icon: Shield, desc: 'Full Province' },
                    { value: ACCESS_LEVELS.DIVISION, label: 'Division', icon: Building2, desc: 'One Division' },
                    { value: ACCESS_LEVELS.DISTRICT, label: 'District', icon: Building2, desc: 'One District' },
                    { value: ACCESS_LEVELS.TEHSIL, label: 'Tehsil', icon: MapPin, desc: 'One Tehsil' }
                  ].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => handleAccessLevelChange(opt.value)}
                      disabled={editLoading || adminToEdit?.email === 'dev@team.com'}
                      className={`p-3 rounded-xl border text-center transition-all ${formData.accessLevel === opt.value ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20' : darkMode ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'} ${adminToEdit?.email === 'dev@team.com' ? 'opacity-60 cursor-not-allowed' : ''}`}>
                      <opt.icon size={18} className={`mx-auto mb-1 ${formData.accessLevel === opt.value ? 'text-blue-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      <p className={`text-sm font-medium ${formData.accessLevel === opt.value ? 'text-blue-500' : darkMode ? 'text-gray-200' : 'text-gray-900'}`}>{opt.label}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Province</label>
                <div className="relative">
                  <select value={formData.province} onChange={(e) => handleProvinceChange(e.target.value)} className={selectClass} disabled={editLoading}>
                    <option value="">Select Province</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
              </div>

              {(formData.accessLevel === 'division' || formData.accessLevel === 'district' || formData.accessLevel === 'tehsil') && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Division</label>
                  <div className="relative">
                    <select value={formData.division} onChange={(e) => handleDivisionChange(e.target.value)} className={selectClass} disabled={editLoading || !formData.province}>
                      <option value="">Select Division</option>
                      {formDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                </div>
              )}

              {(formData.accessLevel === 'district' || formData.accessLevel === 'tehsil') && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>District</label>
                  <div className="relative">
                    <select value={formData.district} onChange={(e) => handleDistrictChange(e.target.value)} className={selectClass} disabled={editLoading || !formData.division}>
                      <option value="">Select District</option>
                      {formDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                </div>
              )}

              {formData.accessLevel === 'tehsil' && formData.district && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Tehsil</label>
                  <div className="relative">
                    <select value={formData.tehsil} onChange={(e) => setFormData({ ...formData, tehsil: e.target.value })} className={selectClass} disabled={editLoading}>
                      <option value="">Select Tehsil</option>
                      {formTehsils.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronRight size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                </div>
              )}

              {/* Status Toggle - Hidden for master admin account */}
              {adminToEdit?.email !== 'dev@team.com' && (
                <div className={`p-4 rounded-xl border ${darkMode ? 'border-gray-700 bg-gray-700/30' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Account Status</h3>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formData.status === 'active' ? 'Account is active and can log in' : 'Account is deactivated and cannot log in'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${formData.status === 'active' ? 'bg-blue-600' : 'bg-gray-400'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              <div className={`flex flex-col-reverse sm:flex-row items-center gap-3 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <button type="button" onClick={closeEditModal} disabled={editLoading} className={`w-full sm:w-auto px-5 py-3 text-sm font-medium rounded-xl transition-all ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>Cancel</button>
                <button type="submit" disabled={editLoading} className="w-full sm:flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {editLoading ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><CheckCircle size={18} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && adminToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className={`w-full max-w-md m-auto rounded-2xl shadow-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-xl ${darkMode ? 'bg-red-500/10' : 'bg-red-50'}`}>
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Delete Administrator</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This action cannot be undone</p>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-xl mb-4 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
                  {adminToDelete.firstName?.[0]}{adminToDelete.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{adminToDelete.firstName} {adminToDelete.lastName}</p>
                  <p className={`text-sm truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{adminToDelete.email}</p>
                </div>
              </div>

              <div className={`p-3 rounded-xl mb-4 ${darkMode ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-sm ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  Enter the admin's password to delete from Firebase Authentication and database.
                </p>
              </div>

              {error && (
                <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm ${darkMode ? 'bg-red-900/20 border border-red-800 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Admin's Password</label>
                <div className="relative">
                  <input type={showDeletePassword ? 'text' : 'password'} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter password to confirm"
                    className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20 ${darkMode ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-red-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-red-500'}`}
                    disabled={deleteLoading} />
                  <button type="button" onClick={() => setShowDeletePassword(!showDeletePassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                    {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className={`flex flex-col-reverse sm:flex-row items-center gap-3 px-6 py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <button onClick={handleCloseDeleteModal} disabled={deleteLoading} className={`w-full sm:w-auto px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>Cancel</button>
              <button onClick={handleConfirmDelete} disabled={deleteLoading || !deletePassword} className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {deleteLoading ? <><Loader2 size={16} className="animate-spin" /> Deleting...</> : <><Trash2 size={16} /> Delete Admin</>}
              </button>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
};

export default AdminManagement;
