// frontend/components/AdminDashboard.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  BarChart3,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  LogOut,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Type definitions
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DISPATCHER' | 'DONOR' | 'NGO';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  licenseId: string;
  createdAt: string;
}

export interface ResourceListing {
  id: string;
  title: string;
  foodType: string;
  quantityKg: number;
  servingsCount: number;
  status: 'AVAILABLE' | 'CLAIMED' | 'DELIVERED' | 'CANCELLED';
  donorName: string;
  expiryTime: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'listings' | 'analytics' | 'audit'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Mock State for Users
  const [users, setUsers] = useState<AdminUser[]>([
    {
      id: 'u-101',
      name: 'Royal Spice Caterers',
      email: 'chef.royalspice@gmail.com',
      role: 'DONOR',
      status: 'ACTIVE',
      licenseId: 'FSSAI-10019022008432',
      createdAt: '2025-11-12'
    },
    {
      id: 'u-102',
      name: 'Hope Shelter Network',
      email: 'contact.hopeshelter@gmail.com',
      role: 'NGO',
      status: 'ACTIVE',
      licenseId: 'NGO-DARPAN-DL/2021/029184',
      createdAt: '2025-11-20'
    },
    {
      id: 'u-103',
      name: 'City Banquet Hall',
      email: 'manager.citybanquet@gmail.com',
      role: 'DONOR',
      status: 'PENDING_VERIFICATION',
      licenseId: 'FSSAI-20038190012847',
      createdAt: '2026-01-05'
    },
    {
      id: 'u-104',
      name: 'Sarah Connor',
      email: 'sarah.admin@annwaste.org',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      licenseId: 'INTERNAL-EMP-001',
      createdAt: '2025-08-01'
    }
  ]);

  // Mock State for 20 Resource Listings
  const [listings, setListings] = useState<ResourceListing[]>([
    { id: 'list-501', title: '30 Servings Veg Thali', foodType: 'Cooked Meals', quantityKg: 30, servingsCount: 30, status: 'AVAILABLE', donorName: 'Royal Spice Caterers', expiryTime: 'Today, 11:30 PM' },
    { id: 'list-502', title: '15 Packed Rice Bowls', foodType: 'Cooked Meals', quantityKg: 15, servingsCount: 15, status: 'CLAIMED', donorName: 'Green Earth Bistro', expiryTime: 'Today, 10:00 PM' },
    { id: 'list-503', title: '25 Sourdough Loaves', foodType: 'Bakery & Bread', quantityKg: 25, servingsCount: 50, status: 'AVAILABLE', donorName: 'Golden Crust Bakery', expiryTime: 'Tomorrow, 09:00 AM' },
    { id: 'list-504', title: '40 Sandwich Boxes', foodType: 'Packaged Dry', quantityKg: 20, servingsCount: 40, status: 'AVAILABLE', donorName: 'TechHub Conference', expiryTime: 'Today, 09:45 PM' },
    { id: 'list-505', title: '50 Portions Paneer Butter Masala', foodType: 'Cooked Meals', quantityKg: 35, servingsCount: 50, status: 'AVAILABLE', donorName: 'Spice Symphony Kitchen', expiryTime: 'Today, 11:00 PM' },
    { id: 'list-506', title: '20 Fresh Fruit Salads & Juices', foodType: 'Raw Produce', quantityKg: 18, servingsCount: 20, status: 'AVAILABLE', donorName: 'Orchard Fresh Cafe', expiryTime: 'Today, 08:30 PM' },
    { id: 'list-507', title: '35 Hyderabadi Dum Biryani Trays', foodType: 'Cooked Meals', quantityKg: 40, servingsCount: 35, status: 'CLAIMED', donorName: 'Nizam Royal Kitchen', expiryTime: 'Today, 10:15 PM' },
    { id: 'list-508', title: '60 Assorted Dinner Rolls & Buns', foodType: 'Bakery & Bread', quantityKg: 22, servingsCount: 60, status: 'AVAILABLE', donorName: 'Daily Bread Bakehouse', expiryTime: 'Tomorrow, 11:00 AM' },
    { id: 'list-509', title: '25 Dal Makhani & Jeera Rice', foodType: 'Cooked Meals', quantityKg: 28, servingsCount: 25, status: 'AVAILABLE', donorName: 'Punjabi Rasoi', expiryTime: 'Today, 11:45 PM' },
    { id: 'list-510', title: '18 Whole Wheat Pasta Bowls', foodType: 'Cooked Meals', quantityKg: 15, servingsCount: 18, status: 'AVAILABLE', donorName: 'Bella Italia Trattoria', expiryTime: 'Tomorrow, 12:30 AM' },
    { id: 'list-511', title: '45 South Indian Idli & Sambar', foodType: 'Cooked Meals', quantityKg: 30, servingsCount: 45, status: 'CLAIMED', donorName: 'Sagar Ratna Express', expiryTime: 'Today, 09:30 PM' },
    { id: 'list-512', title: '30 Veg Hakka Noodles & Manchurian', foodType: 'Cooked Meals', quantityKg: 25, servingsCount: 30, status: 'AVAILABLE', donorName: 'Red Wok Bistro', expiryTime: 'Today, 10:45 PM' },
    { id: 'list-513', title: '22 Fresh Butter Croissants', foodType: 'Bakery & Bread', quantityKg: 14, servingsCount: 22, status: 'AVAILABLE', donorName: 'Le Petit Paris Bakery', expiryTime: 'Tomorrow, 10:00 AM' },
    { id: 'list-514', title: '55 Khichdi & Mixed Veg Bowls', foodType: 'Cooked Meals', quantityKg: 38, servingsCount: 55, status: 'AVAILABLE', donorName: 'Satvik Bhojan Kendra', expiryTime: 'Today, 11:15 PM' },
    { id: 'list-515', title: '40 Rajma Chawal Lunch Boxes', foodType: 'Cooked Meals', quantityKg: 32, servingsCount: 40, status: 'AVAILABLE', donorName: 'Delhi Delights Caterers', expiryTime: 'Today, 09:15 PM' },
    { id: 'list-516', title: '28 Stuffed Parathas with Curd', foodType: 'Cooked Meals', quantityKg: 24, servingsCount: 28, status: 'AVAILABLE', donorName: 'Highway Dhaba Kitchen', expiryTime: 'Tomorrow, 01:00 AM' },
    { id: 'list-517', title: '16 Quinoa & Roasted Veggie Bowls', foodType: 'Raw Produce', quantityKg: 12, servingsCount: 16, status: 'CLAIMED', donorName: 'Healthy Harvest Cafe', expiryTime: 'Today, 08:45 PM' },
    { id: 'list-518', title: '35 Mixed Vegetable Pulao Pots', foodType: 'Cooked Meals', quantityKg: 28, servingsCount: 35, status: 'AVAILABLE', donorName: 'Golden Spoon Banquets', expiryTime: 'Today, 11:30 PM' },
    { id: 'list-519', title: '50 Multigrain Roti & Chana Packs', foodType: 'Cooked Meals', quantityKg: 30, servingsCount: 50, status: 'AVAILABLE', donorName: 'Desi Rasoi Express', expiryTime: 'Today, 10:30 PM' },
    { id: 'list-520', title: '24 Fresh Salads & Cut Melons', foodType: 'Raw Produce', quantityKg: 16, servingsCount: 24, status: 'AVAILABLE', donorName: 'Urban Green Co.', expiryTime: 'Tomorrow, 08:00 AM' }
  ]);

  // Listings Pagination State
  const [listingsPage, setListingsPage] = useState(1);
  const listingsPerPage = 5;

  const paginatedListings = useMemo(() => {
    const start = (listingsPage - 1) * listingsPerPage;
    return listings.slice(start, start + listingsPerPage);
  }, [listings, listingsPage]);

  const totalListingsPages = Math.ceil(listings.length / listingsPerPage);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.licenseId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Actions
  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : u
      )
    );
  };

  const changeUserRole = (id: string, newRole: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
    );
  };

  const deleteListing = (id: string) => {
    if (confirm('Are you sure you want to permanently purge this listing?')) {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const exportCSV = (type: 'users' | 'listings') => {
    const data = type === 'users' ? users : listings;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ann_${type}_export_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans antialiased overflow-hidden">
      {/* 1. SIDEBAR */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <img src="/logo.png" alt="Ann Logo" className="w-10 h-10 object-contain drop-shadow" />
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1">
                Ann Admin <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">PROD</span>
              </span>
              <p className="text-[11px] text-slate-400">Enterprise Control Hub</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'overview' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('listings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'listings' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Resource Manager</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Directory</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'analytics' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics & KPI</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'audit' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security & Audit</span>
            </button>
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              SA
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">Sarah Connor</p>
              <span className="text-[10px] text-emerald-400 font-mono">SUPER_ADMIN</span>
            </div>
          </div>
          <button className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-900">
        {/* Top bar */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/80 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ann" className="w-7 h-7 object-contain drop-shadow" />
            <h1 className="text-lg font-bold text-white capitalize">
              {activeTab === 'overview' && 'System Analytics Overview'}
              {activeTab === 'listings' && 'Food Resources & Listings CRUD'}
              {activeTab === 'users' && 'User Accounts & Role Permissions'}
              {activeTab === 'analytics' && 'Environmental Impact & Distribution Metrics'}
              {activeTab === 'audit' && 'System Audit Trail & Compliance'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportCSV(activeTab === 'listings' ? 'listings' : 'users')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {activeTab === 'listings' ? 'Listings' : 'Users'}</span>
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400">Total Servings Rescued</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-white">89,450</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                      +14.2% <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400">Waste Diverted (kg)</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-white">35,780 kg</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                      +18.5% <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400">Verified Donors</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-white">580</span>
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-0.5">
                      Active Kitchens
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400">Claims Success Rate</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-emerald-400">92.1%</span>
                    <span className="text-xs font-bold text-slate-400">3,980 claims</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name, email, license..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="DONOR">Donor</option>
                    <option value="NGO">NGO Partner</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="PENDING_VERIFICATION">Pending</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-800/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="p-3.5">User / Organization</th>
                      <th className="p-3.5">Role Tier</th>
                      <th className="p-3.5">Account Status</th>
                      <th className="p-3.5">License ID</th>
                      <th className="p-3.5">Registered</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-700/30 transition">
                        <td className="p-3.5">
                          <p className="font-bold text-white">{user.name}</p>
                          <p className="text-slate-400 text-[11px] font-mono">{user.email}</p>
                        </td>
                        <td className="p-3.5">
                          <select
                            value={user.role}
                            onChange={(e) => changeUserRole(user.id, e.target.value as UserRole)}
                            className="bg-slate-900 border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-slate-300"
                          >
                            <option value="DONOR">DONOR</option>
                            <option value="NGO">NGO</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              user.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : user.status === 'SUSPENDED'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-400 text-[11px]">{user.licenseId}</td>
                        <td className="p-3.5 text-slate-400">{user.createdAt}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => toggleUserStatus(user.id)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                              user.status === 'ACTIVE'
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LISTINGS RESOURCE MANAGER */}
          {activeTab === 'listings' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-800/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="p-3.5">Food Title</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Quantity / Servings</th>
                      <th className="p-3.5">Donor Kitchen</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {paginatedListings.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-700/30 transition">
                        <td className="p-3.5 font-bold text-white">{item.title}</td>
                        <td className="p-3.5 text-slate-300">{item.foodType}</td>
                        <td className="p-3.5 text-slate-300">
                          {item.quantityKg} kg ({item.servingsCount} meals)
                        </td>
                        <td className="p-3.5 text-slate-400">{item.donorName}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status === 'AVAILABLE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : item.status === 'CLAIMED'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => deleteListing(item.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                            title="Purge Listing"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls matching exact visual design */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs">
                <span className="text-slate-400">
                  Showing <strong className="text-white">{(listingsPage - 1) * listingsPerPage + 1} - {Math.min(listingsPage * listingsPerPage, listings.length)}</strong> of <strong className="text-white">{listings.length}</strong> items
                </span>
                <div className="inline-flex items-center bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden select-none">
                  <button
                    disabled={listingsPage <= 1}
                    onClick={() => setListingsPage((p) => Math.max(1, p - 1))}
                    className={`flex items-center gap-1 px-3.5 py-2 font-bold transition border-r border-slate-200 ${
                      listingsPage <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                  {Array.from({ length: totalListingsPages }, (_, i) => i + 1).map((p) => {
                    const isActive = p === listingsPage;
                    return isActive ? (
                      <span
                        key={p}
                        className="border-x-2 border-slate-900 font-extrabold text-slate-950 bg-white px-3.5 py-2 min-w-[38px] flex items-center justify-center shadow-xs"
                      >
                        {p}
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setListingsPage(p)}
                        className="px-3 py-2 font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-50 transition min-w-[34px] flex items-center justify-center cursor-pointer"
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    disabled={listingsPage >= totalListingsPages}
                    onClick={() => setListingsPage((p) => Math.min(totalListingsPages, p + 1))}
                    className={`flex items-center gap-1 px-3.5 py-2 font-bold transition border-l border-slate-200 ${
                      listingsPage >= totalListingsPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <h3 className="font-bold text-white text-sm mb-3">Immutable Administrative Audit Log</h3>
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-emerald-400 font-bold">[USER_STATUS_CHANGE]</span>{' '}
                      <span className="text-slate-300">Actor: Sarah Connor (SUPER_ADMIN) suspended user u-103.</span>
                    </div>
                    <span className="text-slate-500 text-[11px]">Today at 20:10:00 UTC</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-amber-400 font-bold">[LISTING_DELETE]</span>{' '}
                      <span className="text-slate-300">Actor: Alex Vance (ADMIN) purged expired batch list-489.</span>
                    </div>
                    <span className="text-slate-500 text-[11px]">Today at 19:45:00 UTC</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
