import { createContext, useContext, useState, useEffect } from 'react';
import { getUserProfile, logout as logoutApi } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [stepFlags, setStepFlags] = useState({});
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const data = await getUserProfile();
            setUser(data.user);
            setStepFlags({
                has_identity_doc: data.has_identity_doc || false,
                has_passed_assessment: data.has_passed_assessment || false,
                has_documents: data.has_documents || false,
                has_accepted_declaration: data.has_accepted_declaration || false,
            });
            setIsAuthenticated(true);
        } catch (error) {
            setUser(null);
            setStepFlags({});
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const login = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
    };

    const updateUser = (userData) => {
        setUser(userData);
    };

    const updateStepFlags = (flags) => {
        setStepFlags(prev => ({ ...prev, ...flags }));
    };

    const logout = async () => {
        try {
            await logoutApi();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setStepFlags({});
            setIsAuthenticated(false);
        }
    };

    const value = {
        user,
        stepFlags,
        loading,
        isAuthenticated,
        login,
        logout,
        updateUser,
        updateStepFlags,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
