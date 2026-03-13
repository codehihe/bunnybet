import React, { useState, useEffect } from 'react'
import { Row, Col, Button, Table, Form, Modal, Card, Spinner, Container, Badge } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
    faEdit, faTrash, faPlus, faSave, faCheckCircle, faExclamationCircle, 
    faStore, faTicketAlt, faGift, faMoneyBillWave, faUniversity, faShieldAlt,
    faTachometerAlt, faCog, faSync, faChevronRight, faBars, faTimes
} from '@fortawesome/free-solid-svg-icons'
import { getData, postData, getCurrencySymbol, isNumber } from '../../../utils/utils'
import Header from '../../partials/header'
import Footer from '../../partials/footer'
import Panel from '../../games/sidebar/panel'
import '../../../css/admin.css'

function Admin(props) {
    const { settings, user } = props
    const { lang, theme, currency } = settings
    const [activeTab, setActiveTab] = useState('market')
    const [isLoading, setIsLoading] = useState(true)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    
    // State management
    const [market, setMarket] = useState([])
    const [coupons, setCoupons] = useState([])
    const [config, setConfig] = useState({
        WELCOME_BONUS: '',
        WITHDRAWAL_CURRENCIES: '',
        DONATION_BANK_TITLE: '',
        DONATION_BANK_TEXT: ''
    })
    
    // UI states
    const [showCouponModal, setShowCouponModal] = useState(false)
    const [currentCoupon, setCurrentCoupon] = useState({ name: '', discount: 0 })
    const [originalCouponName, setOriginalCouponName] = useState(null)
    const [password, setPassword] = useState({ new: '', confirm: '' })
    const [showMarketModal, setShowMarketModal] = useState(false)
    const [newMarketItem, setNewMarketItem] = useState({ id: '', name_eng: '', price: 0, value: 0 })
    const [savingItems, setSavingItems] = useState({})
    const [globalSaving, setGlobalSaving] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [debounceTimers, setDebounceTimers] = useState({})

    useEffect(() => {
        // Cleanup timers on unmount
        return () => {
            Object.values(debounceTimers).forEach(timer => clearTimeout(timer))
        }
    }, [debounceTimers])

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            try {
                const [marketData, couponData, configData] = await Promise.all([
                    getData('/api/admin/market'),
                    getData('/api/admin/coupons'),
                    getData('/api/admin/config')
                ])
                
                if (marketData) setMarket(marketData)
                if (couponData) setCoupons(couponData)
                if (configData) setConfig(configData)
            } catch (error) {
                console.error("Error fetching admin data:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }))
    }

    const saveConfig = async (key) => {
        setGlobalSaving(true)
        try {
            const res = await postData('/api/admin/config/update', { key, value: config[key] })
            if (res.success) {
                showToast('Success', `${key.replace(/_/g, ' ')} updated successfully!`)
            } else {
                showToast('Error', `Failed to update ${key.replace(/_/g, ' ')}.`)
            }
        } catch (error) {
            showToast('Error', 'A server error occurred.')
        } finally {
            setGlobalSaving(false)
        }
    }

    const showToast = (title, message) => {
        // We could implement a real toast here, but for now using standard alerts
        // since we want to avoid adding more dependencies like react-toastify
        alert(`${title}: ${message}`)
    }

    // Market functions
    const updateMarketItem = async (id, field, value) => {
        setSavingItems(prev => ({ ...prev, [id]: 'saving' }))
        
        const itemToUpdate = market.find(item => item.id === id)
        if (!itemToUpdate) return

        const updatedItem = { ...itemToUpdate, [field]: (field === 'price' || field === 'value') ? (value === '' ? 0 : parseFloat(value)) : value }

        try {
            const res = await postData('/api/admin/market/update', { market: [updatedItem] })
            if (res.success) {
                setSavingItems(prev => ({ ...prev, [id]: 'success' }))
                setTimeout(() => {
                    setSavingItems(prev => {
                        const next = { ...prev }
                        delete next[id]
                        return next
                    })
                }, 2000)
            } else {
                setSavingItems(prev => ({ ...prev, [id]: 'error' }))
            }
        } catch {
            setSavingItems(prev => ({ ...prev, [id]: 'error' }))
        }
    }

    const handleMarketFieldChange = (id, field, value) => {
        if ((field === 'price' || field === 'value') && value !== '' && !isNumber(value)) return
        
        const updatedMarket = market.map(item =>
            item.id === id ? { ...item, [field]: (field === 'price' || field === 'value') ? (value === '' ? 0 : parseFloat(value)) : value } : item
        )
        setMarket(updatedMarket)
        
        // Debounce individual saves
        if (debounceTimers[id]) {
            clearTimeout(debounceTimers[id])
        }
        
        const newTimer = setTimeout(() => {
            updateMarketItem(id, field, value)
            setDebounceTimers(prev => {
                const next = { ...prev }
                delete next[id]
                return next
            })
        }, 800) // 800ms debounce
        
        setDebounceTimers(prev => ({ ...prev, [id]: newTimer }))
    }

    const saveAllMarketChanges = async () => {
        setGlobalSaving(true)
        try {
            const res = await postData('/api/admin/market/update', { market })
            if (res.success) showToast('Success', 'Market prices updated successfully!')
            else showToast('Error', 'Failed to update market prices.')
        } finally {
            setGlobalSaving(false)
        }
    }

    const handleDeleteMarketItem = async (id) => {
        if (window.confirm(`Delete market item ${id}?`)) {
            const res = await postData('/api/admin/market/delete', { id })
            if (res.success) {
                const data = await getData('/api/admin/market')
                if (data) setMarket(data)
            } else showToast('Error', 'Failed to delete market item.')
        }
    }

    const handleAddMarketSave = async () => {
        const { id, name_eng, price, value } = newMarketItem
        if (!id || !name_eng) {
            showToast('Warning', 'Please fill ID and Name')
            return
        }
        
        if (!isNumber(price) || !isNumber(value)) {
            showToast('Warning', 'Price and Value must be valid numbers')
            return
        }

        try {
            setIsActionLoading(true)
            console.log('[ADMIN] Sending request to add market item:', { id, name_eng, price, value })
            const res = await postData('/api/admin/market/add', { id, name_eng, price, value })
            console.log('[ADMIN] Add market item response:', res)
            if (res.success) {
                setShowMarketModal(false)
                setNewMarketItem({ id: '', name_eng: '', price: 0, value: 0 }) // Reset form
                showToast('Success', 'Market item added successfully!')
                const data = await getData('/api/admin/market')
                if (data) setMarket(data)
            } else {
                console.error('[ADMIN] Failed to add market item:', res.message)
                showToast('Error', res.message || 'Failed to add market item.')
            }
        } catch (error) {
            console.error('[ADMIN] Error in handleAddMarketSave:', error)
            showToast('Error', 'An error occurred while adding market item: ' + error.message)
        } finally {
            setIsActionLoading(false)
        }
    }

    // Coupon functions
    const saveCoupon = async () => {
        if (!currentCoupon.name) {
            showToast('Warning', 'Please fill coupon name')
            return
        }
        
        const action = originalCouponName ? 'update' : 'add'
        const payload = originalCouponName 
            ? { originalName: originalCouponName, coupon: currentCoupon } 
            : currentCoupon

        try {
            setIsActionLoading(true)
            console.log(`[ADMIN] Sending request to ${action} coupon:`, payload)
            const res = await postData(`/api/admin/coupons/${action}`, payload)
            console.log(`[ADMIN] ${action} coupon response:`, res)
            if (res.success) {
                setShowCouponModal(false)
                setCurrentCoupon({ name: '', discount: 0 }) // Reset form
                setOriginalCouponName(null)
                showToast('Success', `Coupon ${action === 'add' ? 'created' : 'updated'} successfully!`)
                const data = await getData('/api/admin/coupons')
                if (data) setCoupons(data)
            } else {
                console.error(`[ADMIN] Failed to ${action} coupon:`, res.message)
                showToast('Error', res.message || `Failed to ${action} coupon.`)
            }
        } catch (error) {
            console.error(`[ADMIN] Error in saveCoupon (${action}):`, error)
            showToast('Error', `An error occurred while ${action === 'add' ? 'creating' : 'updating'} coupon: ` + error.message)
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleDeleteCoupon = async (name) => {
        if (window.confirm(`Are you sure you want to delete coupon ${name}?`)) {
            const res = await postData('/api/admin/coupons/delete', { name })
            if (res.success) {
                const data = await getData('/api/admin/coupons')
                if (data) setCoupons(data)
            } else showToast('Error', 'Failed to delete coupon.')
        }
    }

    // Password
    const handleChangePassword = async () => {
        if (password.new !== password.confirm) {
            showToast('Warning', "Passwords do not match!")
            return
        }
        if (user && user.email) {
            const res = await postData('/api/admin/change_password', { email: user.email, newPassword: password.new })
            if (res.success) {
                showToast('Success', 'Password changed successfully!')
                setPassword({ new: '', confirm: '' })
            } else showToast('Error', 'Failed to change password.')
        } else showToast('Error', 'User email not found.')
    }

    const renderMarketTab = () => (
        <div className="fade-in">
            <Card className="admin-card">
                <Card.Header className="admin-card-header">
                    <div className="d-flex justify-content-between align-items-center">
                        <h3 className="admin-card-title">
                            <FontAwesomeIcon icon={faStore} /> Market Items Management
                        </h3>
                        <div className="d-flex align-items-center gap-3">
                            <Badge bg="info">Total Items: {market.length}</Badge>
                            <Badge bg="info">Currency: {currency} ({getCurrencySymbol(currency)})</Badge>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body>
                    <div className="mb-4 d-flex justify-content-between align-items-center">
                        <div className="admin-search-container" style={{ maxWidth: '300px' }}>
                            <Form.Control 
                                type="text" 
                                placeholder="Search items by ID or Name..." 
                                className="admin-form-control"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="d-flex gap-2">
                            <Button className="admin-btn-primary" onClick={() => {
                                setNewMarketItem({ id: '', name_eng: '', price: 0, value: 0 })
                                setShowMarketModal(true)
                            }}>
                                <FontAwesomeIcon icon={faPlus} /> Add New Item
                            </Button>
                        </div>
                    </div>
                    <div className="table-responsive admin-table-container">
                        <Table className="admin-table" hover>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Value (Carrots)</th>
                                    <th>Price ({currency})</th>
                                    <th className="text-center">Status</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {market.filter(item => 
                                    item.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    item.name_eng.toLowerCase().includes(searchTerm.toLowerCase())
                                ).map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold">{item.id}</td>
                                        <td>
                                            <Form.Control 
                                                className="admin-form-control"
                                                type="text" 
                                                value={item.name_eng} 
                                                onChange={(e) => handleMarketFieldChange(item.id, 'name_eng', e.target.value)} 
                                            />
                                        </td>
                                        <td>
                                            <Form.Control 
                                                className="admin-form-control"
                                                type="number" 
                                                value={item.value} 
                                                onChange={(e) => handleMarketFieldChange(item.id, 'value', e.target.value)} 
                                            />
                                        </td>
                                        <td>
                                            <Form.Control 
                                                className="admin-form-control"
                                                type="number" 
                                                value={item.price}
                                                onChange={(e) => handleMarketFieldChange(item.id, 'price', e.target.value)} 
                                            />
                                        </td>
                                        <td className="text-center">
                                            <div className="admin-status-indicator">
                                                {savingItems[item.id] === 'saving' && <Spinner animation="border" size="sm" variant="warning" />}
                                                {savingItems[item.id] === 'success' && <FontAwesomeIcon icon={faCheckCircle} className="text-success" />}
                                                {savingItems[item.id] === 'error' && <FontAwesomeIcon icon={faExclamationCircle} className="text-danger" />}
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteMarketItem(item.id)}>
                                                <FontAwesomeIcon icon={faTrash} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                    <div className="mt-4 d-flex gap-3">
                        <Button className="admin-btn-secondary" onClick={saveAllMarketChanges} disabled={globalSaving}>
                            {globalSaving ? <Spinner size="sm" animation="border" /> : <FontAwesomeIcon icon={faSave} />} Save All Changes
                        </Button>
                    </div>
                </Card.Body>
            </Card>
        </div>
    )

    const renderCouponsTab = () => (
        <div className="fade-in">
            <Card className="admin-card">
                <Card.Header className="admin-card-header">
                    <div className="d-flex justify-content-between align-items-center">
                        <h3 className="admin-card-title">
                            <FontAwesomeIcon icon={faTicketAlt} /> Coupon Codes
                        </h3>
                        <Button className="admin-btn-primary" size="sm" onClick={() => {
                            setCurrentCoupon({ name: '', discount: 0 })
                            setOriginalCouponName(null)
                            setShowCouponModal(true)
                        }}>
                            <FontAwesomeIcon icon={faPlus} /> Create Coupon
                        </Button>
                    </div>
                </Card.Header>
                <Card.Body>
                    <div className="table-responsive admin-table-container">
                        <Table className="admin-table" hover>
                            <thead>
                                <tr>
                                    <th>Coupon Code</th>
                                    <th>Discount Amount</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map((coupon) => (
                                    <tr key={coupon.name}>
                                        <td className="fw-bold"><Badge bg="dark" className="p-2 border border-warning text-warning">{coupon.name}</Badge></td>
                                        <td>
                                            <span className="fs-5 text-success fw-bold">{coupon.discount}%</span>
                                        </td>
                                        <td className="text-center">
                                            <div className="d-flex justify-content-center gap-2">
                                                <Button variant="outline-info" size="sm" onClick={() => {
                                                    setCurrentCoupon(coupon)
                                                    setOriginalCouponName(coupon.name)
                                                    setShowCouponModal(true)
                                                }}>
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDeleteCoupon(coupon.name)}>
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {coupons.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="text-center py-4 text-muted">No coupons found. Click "Create Coupon" to add one.</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>
        </div>
    )

    const renderConfigTab = () => (
        <div className="fade-in">
            <Row>
                <Col lg={6}>
                    <Card className="admin-card h-100">
                        <Card.Header className="admin-card-header">
                            <h3 className="admin-card-title"><FontAwesomeIcon icon={faGift} /> Welcome Bonus</h3>
                        </Card.Header>
                        <Card.Body>
                            <Form.Group className="mb-4">
                                <Form.Label>Bonus Amount (Carrots)</Form.Label>
                                <Form.Control 
                                    className="admin-form-control"
                                    type="number" 
                                    value={config.WELCOME_BONUS} 
                                    onChange={(e) => handleConfigChange('WELCOME_BONUS', e.target.value)} 
                                />
                                <Form.Text className="text-muted">Amount given to new users upon registration.</Form.Text>
                            </Form.Group>
                            <Button className="admin-btn-primary" onClick={() => saveConfig('WELCOME_BONUS')}>
                                <FontAwesomeIcon icon={faSave} /> Update Bonus
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={6}>
                    <Card className="admin-card h-100">
                        <Card.Header className="admin-card-header">
                            <h3 className="admin-card-title"><FontAwesomeIcon icon={faMoneyBillWave} /> Withdrawal Currencies</h3>
                        </Card.Header>
                        <Card.Body>
                            <Form.Group className="mb-4">
                                <Form.Label>Allowed Currencies</Form.Label>
                                <Form.Control 
                                    className="admin-form-control"
                                    type="text" 
                                    placeholder="e.g., INR,USD,EUR"
                                    value={config.WITHDRAWAL_CURRENCIES} 
                                    onChange={(e) => handleConfigChange('WITHDRAWAL_CURRENCIES', e.target.value)} 
                                />
                                <Form.Text className="text-muted">Comma-separated list of supported currencies.</Form.Text>
                            </Form.Group>
                            <Button className="admin-btn-primary" onClick={() => saveConfig('WITHDRAWAL_CURRENCIES')}>
                                <FontAwesomeIcon icon={faSave} /> Update Currencies
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="admin-card mt-4">
                <Card.Header className="admin-card-header">
                    <h3 className="admin-card-title"><FontAwesomeIcon icon={faUniversity} /> Bank Donations Configuration</h3>
                </Card.Header>
                <Card.Body>
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Bank Donation Title</Form.Label>
                                <Form.Control 
                                    className="admin-form-control"
                                    type="text" 
                                    value={config.DONATION_BANK_TITLE} 
                                    onChange={(e) => handleConfigChange('DONATION_BANK_TITLE', e.target.value)} 
                                />
                            </Form.Group>
                            <Button className="admin-btn-primary mb-3" onClick={() => saveConfig('DONATION_BANK_TITLE')}>
                                <FontAwesomeIcon icon={faSave} /> Update Title
                            </Button>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Bank Donation Text/Details</Form.Label>
                                <Form.Control 
                                    className="admin-form-control"
                                    as="textarea" rows={5}
                                    value={config.DONATION_BANK_TEXT} 
                                    onChange={(e) => handleConfigChange('DONATION_BANK_TEXT', e.target.value)} 
                                />
                            </Form.Group>
                            <Button className="admin-btn-primary" onClick={() => saveConfig('DONATION_BANK_TEXT')}>
                                <FontAwesomeIcon icon={faSave} /> Update Details
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        </div>
    )

    const renderSecurityTab = () => (
        <div className="fade-in">
            <Card className="admin-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <Card.Header className="admin-card-header">
                    <h3 className="admin-card-title"><FontAwesomeIcon icon={faShieldAlt} /> Security Settings</h3>
                </Card.Header>
                <Card.Body>
                    <Form>
                        <Form.Group className="mb-4">
                            <Form.Label>New Admin Password</Form.Label>
                            <Form.Control 
                                className="admin-form-control"
                                type="password" 
                                value={password.new} 
                                onChange={(e) => setPassword({ ...password, new: e.target.value })} 
                            />
                        </Form.Group>
                        <Form.Group className="mb-4">
                            <Form.Label>Confirm New Password</Form.Label>
                            <Form.Control 
                                className="admin-form-control"
                                type="password" 
                                value={password.confirm} 
                                onChange={(e) => setPassword({ ...password, confirm: e.target.value })} 
                            />
                        </Form.Group>
                        <Button variant="warning" className="w-100 fw-bold py-2" onClick={handleChangePassword}>
                            <FontAwesomeIcon icon={faSync} className="me-2" /> Change Administrator Password
                        </Button>
                    </Form>
                    <div className="mt-4 p-3 border border-warning rounded bg-dark text-warning small">
                        <FontAwesomeIcon icon={faExclamationCircle} className="me-2" />
                        Changing the admin password will take effect immediately. Please ensure you have noted the new password.
                    </div>
                </Card.Body>
            </Card>
        </div>
    )

    return (
        <div className="content_wrap">
            <Header template="page" details="Admin" lang={lang} theme={theme} />
            
            <div className="admin-wrapper">
                {/* Mobile Toggle Button */}
                <button className="admin-mobile-toggle d-lg-none" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                    <FontAwesomeIcon icon={isSidebarOpen ? faTimes : faBars} />
                </button>

                {/* Sidebar Navigation */}
                <aside className={`admin-sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
                    <div className="admin-sidebar-header">
                        <h2 className="admin-sidebar-title">Admin Panel</h2>
                        <small className="text-muted">Welcome, {user.username || 'Admin'}</small>
                    </div>
                    
                    <nav className="admin-nav">
                        <div className={`admin-nav-item ${activeTab === 'market' ? 'active' : ''}`} onClick={() => {
                            setActiveTab('market')
                            setIsSidebarOpen(false)
                        }}>
                            <FontAwesomeIcon icon={faStore} className="admin-nav-icon" />
                            <span>Market Management</span>
                            {activeTab === 'market' && <FontAwesomeIcon icon={faChevronRight} className="ms-auto small opacity-50" />}
                        </div>
                        <div className={`admin-nav-item ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => {
                            setActiveTab('coupons')
                            setIsSidebarOpen(false)
                        }}>
                            <FontAwesomeIcon icon={faTicketAlt} className="admin-nav-icon" />
                            <span>Promo Coupons</span>
                            {activeTab === 'coupons' && <FontAwesomeIcon icon={faChevronRight} className="ms-auto small opacity-50" />}
                        </div>
                        <div className={`admin-nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => {
                            setActiveTab('config')
                            setIsSidebarOpen(false)
                        }}>
                            <FontAwesomeIcon icon={faCog} className="admin-nav-icon" />
                            <span>Global Config</span>
                            {activeTab === 'config' && <FontAwesomeIcon icon={faChevronRight} className="ms-auto small opacity-50" />}
                        </div>
                        <div className={`admin-nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => {
                            setActiveTab('security')
                            setIsSidebarOpen(false)
                        }}>
                            <FontAwesomeIcon icon={faShieldAlt} className="admin-nav-icon" />
                            <span>Security</span>
                            {activeTab === 'security' && <FontAwesomeIcon icon={faChevronRight} className="ms-auto small opacity-50" />}
                        </div>
                    </nav>
                </aside>

                {/* Sidebar Overlay (Mobile Only) */}
                {isSidebarOpen && <div className="admin-sidebar-overlay d-lg-none" onClick={() => setIsSidebarOpen(false)}></div>}

                {/* Main Content Area */}
                <main className="admin-main-content">
                    {isLoading ? (
                        <div className="d-flex flex-column align-items-center justify-content-center h-100 text-warning">
                            <Spinner animation="border" size="xl" className="mb-3" />
                            <h4>Loading Dashboard Data...</h4>
                        </div>
                    ) : (
                        <Container fluid>
                            <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-dark pb-3">
                                <h2 className="m-0" style={{ color: 'var(--color)', fontFamily: 'Grenadier' }}>
                                    {activeTab === 'market' && 'Marketplace Management'}
                                    {activeTab === 'coupons' && 'Promotional Coupons'}
                                    {activeTab === 'config' && 'Global Configuration'}
                                    {activeTab === 'security' && 'Security Settings'}
                                </h2>
                                <Badge bg="dark" className="border border-warning text-warning p-2">
                                    <FontAwesomeIcon icon={faTachometerAlt} className="me-2" /> Admin Dashboard
                                </Badge>
                            </div>

                            {activeTab === 'market' && renderMarketTab()}
                            {activeTab === 'coupons' && renderCouponsTab()}
                            {activeTab === 'config' && renderConfigTab()}
                            {activeTab === 'security' && renderSecurityTab()}
                        </Container>
                    )}
                </main>
            </div>

            {/* Modals */}
            <Modal show={showCouponModal} onHide={() => setShowCouponModal(false)} centered contentClassName="admin-modal-content" className="admin-modal" backdropClassName="admin-modal-backdrop">
                <Modal.Header closeButton className="admin-modal-header">
                    <Modal.Title className="admin-card-title">
                        {originalCouponName ? 'Edit Coupon Code' : 'Create New Coupon'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-4">
                                    <Form.Label>Coupon Name / Code</Form.Label>
                                    <Form.Control 
                                        className="admin-form-control"
                                        type="text" 
                                        placeholder="e.g. WELCOME2024"
                                        value={currentCoupon.name} 
                                        onChange={(e) => setCurrentCoupon({ ...currentCoupon, name: e.target.value.toUpperCase() })} 
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Discount Percentage (%)</Form.Label>
                                    <Form.Control 
                                        className="admin-form-control"
                                        type="number" 
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={currentCoupon.discount} 
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setCurrentCoupon({ ...currentCoupon, discount: val === '' ? 0 : parseInt(val) })
                                        }} 
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="admin-modal-footer">
                    <Button variant="secondary" className="admin-btn-secondary" onClick={() => setShowCouponModal(false)} disabled={isActionLoading}>
                        Cancel
                    </Button>
                    <Button className="admin-btn-primary" onClick={saveCoupon} disabled={isActionLoading}>
                        {isActionLoading ? <Spinner size="sm" animation="border" className="me-2" /> : null}
                        {originalCouponName ? 'Update Coupon' : 'Create Coupon'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showMarketModal} onHide={() => setShowMarketModal(false)} centered contentClassName="admin-modal-content" className="admin-modal" backdropClassName="admin-modal-backdrop">
                <Modal.Header closeButton className="admin-modal-header">
                    <Modal.Title className="admin-card-title">Add New Market Item</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Item ID (Unique)</Form.Label>
                            <Form.Control 
                                className="admin-form-control"
                                type="text" 
                                placeholder="e.g. rabbit_toy"
                                value={newMarketItem.id} 
                                onChange={(e) => setNewMarketItem({ ...newMarketItem, id: e.target.value })} 
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Item Name (English)</Form.Label>
                            <Form.Control 
                                className="admin-form-control"
                                type="text" 
                                placeholder="e.g. Rabbit Toy"
                                value={newMarketItem.name_eng} 
                                onChange={(e) => setNewMarketItem({ ...newMarketItem, name_eng: e.target.value })} 
                            />
                        </Form.Group>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Value (Carrots)</Form.Label>
                                    <Form.Control 
                                        className="admin-form-control"
                                        type="number" 
                                        step="1"
                                        value={newMarketItem.value} 
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setNewMarketItem({ ...newMarketItem, value: val === '' ? 0 : parseInt(val) })
                                        }} 
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Price ({currency})</Form.Label>
                                    <Form.Control 
                                        className="admin-form-control"
                                        type="number" 
                                        step="0.01"
                                        value={newMarketItem.price} 
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setNewMarketItem({ ...newMarketItem, price: val === '' ? 0 : parseFloat(val) })
                                        }} 
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="admin-modal-footer">
                    <Button variant="secondary" className="admin-btn-secondary" onClick={() => setShowMarketModal(false)} disabled={isActionLoading}>
                        Cancel
                    </Button>
                    <Button className="admin-btn-primary" onClick={handleAddMarketSave} disabled={isActionLoading}>
                        {isActionLoading ? <Spinner size="sm" animation="border" className="me-2" /> : null}
                        Add Item
                    </Button>
                </Modal.Footer>
            </Modal>

            <Footer {...props} />
            <Panel {...props} />
        </div>
    )
}

export default Admin
