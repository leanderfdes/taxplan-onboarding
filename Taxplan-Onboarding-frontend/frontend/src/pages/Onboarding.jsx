import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { completeOnboarding } from '../services/api';

const Onboarding = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        first_name: user?.first_name || '',
        middle_name: user?.middle_name || '',
        last_name: user?.last_name || '',
        age: user?.age || '',
        dob: user?.dob || '',
        phone_number: user?.phone_number || '',
        address_line1: user?.address_line1 || '',
        address_line2: user?.address_line2 || '',
        city: user?.city || '',
        state: user?.state || '',
        pincode: user?.pincode || '',
        practice_type: user?.practice_type || 'Individual',
        years_of_experience: user?.years_of_experience || '',
    });

    const calculateAge = (dob) => {
        if (!dob) return '';
        const birth = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age >= 0 ? age : '';
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'dob') {
            setFormData(prev => ({ ...prev, dob: value, age: calculateAge(value) }));
            if (errors.dob || errors.age) setErrors(prev => ({ ...prev, dob: null, age: null }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
            if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const e = {};
        if (!formData.first_name?.trim() || formData.first_name.trim().length < 2) e.first_name = 'First name required (min 2 chars)';
        if (!formData.last_name?.trim()) e.last_name = 'Last name required';
        if (!formData.dob) {
            e.dob = 'Date of birth required';
        } else {
            const age = calculateAge(formData.dob);
            if (age < 18) e.dob = 'Must be at least 18 years old';
            if (age > 100) e.dob = 'Please enter a valid date of birth';
            if (new Date(formData.dob) > new Date()) e.dob = 'Date of birth cannot be in the future';
        }
        if (!formData.phone_number?.trim() || formData.phone_number.trim().length < 10) e.phone_number = 'Valid phone number required (10+ digits)';
        if (!formData.address_line1?.trim() || formData.address_line1.trim().length < 5) e.address_line1 = 'Address required (min 5 chars)';
        if (!formData.city?.trim()) e.city = 'City required';
        if (!formData.state?.trim()) e.state = 'State required';
        if (!formData.pincode?.trim() || formData.pincode.trim().length < 6) e.pincode = 'Valid pincode required (6 digits)';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const v = validate();
        if (Object.keys(v).length > 0) { setErrors(v); return; }
        setLoading(true);
        try {
            const data = await completeOnboarding(formData);
            updateUser(data.user);
            navigate('/success');
        } catch (err) {
            console.error('Onboarding failed:', err);
            if (err.response?.data) {
                const be = {};
                Object.entries(err.response.data).forEach(([k, v]) => { be[k] = Array.isArray(v) ? v[0] : v; });
                setErrors(be);
            }
        } finally { setLoading(false); }
    };

    const indianStates = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
        'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
        'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
        'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
        'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

    const today = new Date();
    const maxDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const minDob = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()).toISOString().split('T')[0];

    const inputStyle = (hasError) => ({
        width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
        border: hasError ? '1px solid #fca5a5' : '1px solid #d1d5db',
        background: hasError ? '#fef2f2' : '#fff', outline: 'none',
        transition: 'border 0.2s',
    });

    const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 };
    const errorStyle = { fontSize: 12, color: '#ef4444', marginTop: 4 };

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Header */}
            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 30 }}>
                <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>T</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>Taxplan Advisor</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>{user?.email}</span>
                </div>
            </header>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 32px 60px' }}>
                {/* Title */}
                <div style={{ marginBottom: 28 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>Step 1 of 5</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Complete Your Profile</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Fill in your details accurately. This information is used for verification.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Personal Information */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 20px' }}>Personal Information</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            <div>
                                <label style={labelStyle}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                                <input name="first_name" value={formData.first_name} onChange={handleChange} placeholder="Enter first name" style={inputStyle(errors.first_name)} />
                                {errors.first_name && <p style={errorStyle}>{errors.first_name}</p>}
                            </div>
                            <div>
                                <label style={labelStyle}>Middle Name</label>
                                <input name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Enter middle name" style={inputStyle(false)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                                <input name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Enter last name" style={inputStyle(errors.last_name)} />
                                {errors.last_name && <p style={errorStyle}>{errors.last_name}</p>}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
                            <div>
                                <label style={labelStyle}>Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                                <input type="date" name="dob" value={formData.dob} onChange={handleChange}
                                    max={maxDob} min={minDob}
                                    style={inputStyle(errors.dob)} />
                                {errors.dob && <p style={errorStyle}>{errors.dob}</p>}
                            </div>
                            <div>
                                <label style={labelStyle}>Age</label>
                                <input value={formData.age} readOnly disabled placeholder="Auto-calculated"
                                    style={{ ...inputStyle(false), background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }} />
                            </div>
                            <div>
                                <label style={labelStyle}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                                <input name="phone_number" value={formData.phone_number} onChange={handleChange} placeholder="+91 XXXXXXXXXX" type="tel" style={inputStyle(errors.phone_number)} />
                                {errors.phone_number && <p style={errorStyle}>{errors.phone_number}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 20px' }}>Address Details</h2>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Address Line 1 <span style={{ color: '#ef4444' }}>*</span></label>
                            <input name="address_line1" value={formData.address_line1} onChange={handleChange} placeholder="Street address, building" style={inputStyle(errors.address_line1)} />
                            {errors.address_line1 && <p style={errorStyle}>{errors.address_line1}</p>}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Address Line 2</label>
                            <input name="address_line2" value={formData.address_line2} onChange={handleChange} placeholder="Apartment, suite, unit (optional)" style={inputStyle(false)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            <div>
                                <label style={labelStyle}>City <span style={{ color: '#ef4444' }}>*</span></label>
                                <input name="city" value={formData.city} onChange={handleChange} placeholder="Enter city" style={inputStyle(errors.city)} />
                                {errors.city && <p style={errorStyle}>{errors.city}</p>}
                            </div>
                            <div>
                                <label style={labelStyle}>State <span style={{ color: '#ef4444' }}>*</span></label>
                                <select name="state" value={formData.state} onChange={handleChange} style={inputStyle(errors.state)}>
                                    <option value="">Select State</option>
                                    {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {errors.state && <p style={errorStyle}>{errors.state}</p>}
                            </div>
                            <div>
                                <label style={labelStyle}>Pincode <span style={{ color: '#ef4444' }}>*</span></label>
                                <input name="pincode" value={formData.pincode} onChange={handleChange} placeholder="e.g. 560001" style={inputStyle(errors.pincode)} />
                                {errors.pincode && <p style={errorStyle}>{errors.pincode}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Practice */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 24 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 20px' }}>Practice Details</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                            <div>
                                <label style={labelStyle}>Practice Type</label>
                                <select name="practice_type" value={formData.practice_type} onChange={handleChange} style={inputStyle(false)}>
                                    <option value="Individual">Individual</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Years of Experience</label>
                                <input name="years_of_experience" value={formData.years_of_experience} onChange={handleChange} type="number" placeholder="e.g. 5" style={inputStyle(false)} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={loading} style={{
                            padding: '12px 32px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                            background: loading ? '#e5e7eb' : '#059669', color: loading ? '#9ca3af' : '#fff',
                            transition: 'background 0.2s'
                        }}>
                            {loading ? 'Submitting...' : 'Submit & Continue →'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Onboarding;
