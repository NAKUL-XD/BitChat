import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaCommentDots, FaQuestionCircle, FaMoon } from 'react-icons/fa';
import useThemeStore from '../../store/themeStore';
import { logoutUser } from '../../services/user.service';
import useUserStore from '../../store/useUserStore';
import { toast } from 'react-toastify';
import Layout from '../../components/Layout';

const Setting = () => {
    const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
    const { theme, setTheme } = useThemeStore();
    const { user, clearUser } = useUserStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logoutUser();
            clearUser();
            toast.success("User logged out successfully");
        } catch (error) {
            console.error("Failed to logout", error);
        }
    };

    const menuItemClasses = `flex items-center gap-3 px-4 py-3 cursor-pointer 
        hover:bg-[rgba(255,255,255,0.05)] transition-colors`;

    return (
        <Layout>
            <div
                className={`flex h-screen ${
                    theme === "dark"
                        ? "bg-[rgb(17,27,33)] text-white"
                        : "bg-white text-black"
                }`}
            >
                {/* Sidebar */}
                <div
                    className={`w-80 border-r ${
                        theme === 'dark'
                            ? "border-gray-700 bg-[rgb(24,34,41)]"
                            : "border-gray-200 bg-gray-50"
                    } flex flex-col`}
                >
                    {/* Search bar */}
                    <div className="p-4">
                        <input
                            type="text"
                            placeholder="Search settings"
                            className={`w-full px-3 py-2 rounded-lg outline-none ${
                                theme === 'dark'
                                    ? 'bg-gray-800 text-white placeholder-gray-400'
                                    : 'bg-gray-200 text-black placeholder-gray-600'
                            }`}
                        />
                    </div>

                    {/* Profile section */}
                    <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold">
                            {user?.name?.[0] || 'U'}
                        </div>
                        <span className="font-medium">{user?.name || "User"}</span>
                    </div>

                    {/* Menu items */}
                    <div className="mt-4">
                        <div
                            className={menuItemClasses}
                            onClick={() => navigate('/userDetails')}
                        >
                            <FaUser />
                            <span>Account</span>
                        </div>

                        <div className={menuItemClasses}>
                            <FaCommentDots />
                            <span>Chats</span>
                        </div>

                        <div
                            className={menuItemClasses}
                            onClick={() => navigate('/help')}
                        >
                            <FaQuestionCircle />
                            <span>Help</span>
                        </div>

                        <div
                            className={`${menuItemClasses} justify-between`}
                            onClick={() => setIsThemeDialogOpen(true)}
                        >
                            <div className="flex items-center gap-3">
                                <FaMoon />
                                <span>Theme</span>
                            </div>
                            <span className="opacity-60 capitalize">{theme}</span>
                        </div>
                    </div>

                    {/* Logout button */}
                    <div className="mt-auto border-t border-gray-500/20">
                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-3 text-left text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex-1 p-6">
                    <h2 className="text-xl font-semibold mb-4">
                        Settings Overview
                    </h2>
                    <p className="opacity-70">
                        Choose an option from the left menu to view and update settings.
                    </p>
                </div>

                {/* Theme Popup */}
                {isThemeDialogOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div
                            className={`rounded-xl shadow-lg w-80 p-5 ${
                                theme === 'dark'
                                    ? 'bg-[rgb(24,34,41)] text-white'
                                    : 'bg-white text-black'
                            }`}
                        >
                            <h3 className="text-lg font-semibold mb-4">Choose a theme</h3>

                            {['light', 'dark'].map((mode) => (
                                <label
                                    key={mode}
                                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-200/20"
                                >
                                    <input
                                        type="radio"
                                        name="theme"
                                        value={mode}
                                        checked={theme === mode}
                                        onChange={() => setTheme(mode)}
                                    />
                                    <span className="capitalize">{mode}</span>
                                </label>
                            ))}

                            <button
                                onClick={() => setIsThemeDialogOpen(false)}
                                className="mt-4 w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Setting;
