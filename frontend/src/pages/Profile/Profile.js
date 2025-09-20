import React, { useState } from 'react';
import { Tab } from '@headlessui/react';
import {
  UserIcon,
  CogIcon,
  CreditCardIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import clsx from 'clsx';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [selectedTab, setSelectedTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Preferences state
  const [preferences, setPreferences] = useState({
    notifications: user?.preferences?.notifications ?? true,
    theme: user?.preferences?.theme || 'light',
    language: user?.preferences?.language || 'en',
  });

  const tabs = [
    { name: 'Profile', icon: UserIcon },
    { name: 'Security', icon: ShieldCheckIcon },
    { name: 'Preferences', icon: CogIcon },
    { name: 'Subscription', icon: CreditCardIcon },
  ];

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateProfile(profileData);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateProfile({ preferences });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your account settings and preferences.
        </p>
      </div>

      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <div className="flex flex-col lg:flex-row lg:space-x-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <Tab.List className="flex lg:flex-col space-x-1 lg:space-x-0 lg:space-y-1 rounded-xl bg-blue-900/20 p-1 lg:bg-transparent lg:p-0">
              {tabs.map((tab, index) => (
                <Tab
                  key={tab.name}
                  className={({ selected }) =>
                    clsx(
                      'w-full rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-colors',
                      'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                      selected
                        ? 'bg-white text-blue-700 shadow lg:bg-primary-50 lg:text-primary-700'
                        : 'text-blue-100 hover:bg-white/[0.12] hover:text-white lg:text-gray-600 lg:hover:bg-gray-50 lg:hover:text-gray-900'
                    )
                  }
                >
                  <div className="flex items-center justify-center lg:justify-start">
                    <tab.icon className="h-5 w-5 mr-0 lg:mr-3" />
                    <span className="hidden lg:block">{tab.name}</span>
                  </div>
                </Tab>
              ))}
            </Tab.List>
          </div>

          {/* Content */}
          <div className="flex-1 mt-6 lg:mt-0">
            <Tab.Panels>
              {/* Profile Tab */}
              <Tab.Panel>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Profile Information</h3>
                  <form onSubmit={handleProfileSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="name" className="form-label">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="form-label">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary"
                      >
                        {isLoading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </Tab.Panel>

              {/* Security Tab */}
              <Tab.Panel>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Change Password</h3>
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="currentPassword" className="form-label">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="form-label">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="form-label">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary"
                      >
                        {isLoading ? <LoadingSpinner size="sm" /> : 'Change Password'}
                      </button>
                    </div>
                  </form>
                </div>
              </Tab.Panel>

              {/* Preferences Tab */}
              <Tab.Panel>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Preferences</h3>
                  <form onSubmit={handlePreferencesSubmit} className="space-y-6">
                    <div>
                      <label className="form-label">Notifications</label>
                      <div className="mt-2">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={preferences.notifications}
                            onChange={(e) => setPreferences({ ...preferences, notifications: e.target.checked })}
                            className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Receive email notifications about document analysis
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="theme" className="form-label">
                        Theme
                      </label>
                      <select
                        id="theme"
                        value={preferences.theme}
                        onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                        className="form-input"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="language" className="form-label">
                        Language
                      </label>
                      <select
                        id="language"
                        value={preferences.language}
                        onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                        className="form-input"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                      </select>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary"
                      >
                        {isLoading ? <LoadingSpinner size="sm" /> : 'Save Preferences'}
                      </button>
                    </div>
                  </form>
                </div>
              </Tab.Panel>

              {/* Subscription Tab */}
              <Tab.Panel>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Subscription</h3>
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 capitalize">
                            {user?.subscription?.type} Plan
                          </h4>
                          <p className="text-sm text-gray-500">
                            {user?.subscription?.documentsLimit} documents per month
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {user?.documentsAnalyzed || 0} / {user?.subscription?.documentsLimit || 0}
                          </p>
                          <p className="text-xs text-gray-500">Documents used</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                ((user?.documentsAnalyzed || 0) / (user?.subscription?.documentsLimit || 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {user?.subscription?.type === 'free' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">
                          Upgrade to Premium
                        </h4>
                        <p className="text-sm text-blue-700 mb-3">
                          Get unlimited document analysis, comparison features, and priority support.
                        </p>
                        <button className="btn-primary btn-sm">
                          Upgrade Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </div>
        </div>
      </Tab.Group>
    </div>
  );
};

export default Profile;
